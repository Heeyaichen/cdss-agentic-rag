#!/bin/bash
# ============================================================================
# CDSS first-run bootstrap deploy
# Creates RG/ACR, builds linux/amd64 image, deploys infra+app, bootstraps search.
# ============================================================================

set -euo pipefail

ENVIRONMENT="${1:-}"
RESOURCE_GROUP="${2:-}"
LOCATION="${3:-eastus2}"

if [[ -z "${ENVIRONMENT}" || -z "${RESOURCE_GROUP}" ]]; then
  echo "Usage: $0 <environment> <resource-group> [location]"
  echo "Example: $0 prod cdss-prod-rg eastus2"
  echo "Optional env vars:"
  echo "  ACR_NAME=<acr-name>"
  echo "  IMAGE_TAG=<tag>"
  echo "  CONTAINER_IMAGE=<acr>.azurecr.io/cdss-api:<tag>"
  echo "  PROD_PUBLIC_API=true|false (default: true)"
  echo "  SKIP_IMAGE_BUILD=true|false (default: false)"
  echo "  SKIP_SEARCH_BOOTSTRAP=true|false (default: false)"
  echo "  SKIP_AUTH_SETUP=true|false (default: true)"
  exit 1
fi

if [[ "${ENVIRONMENT}" != "dev" && "${ENVIRONMENT}" != "staging" && "${ENVIRONMENT}" != "prod" ]]; then
  echo "[ERROR] environment must be one of: dev, staging, prod"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/deploy.sh"
INDEX_SCRIPT="${SCRIPT_DIR}/create-search-indexes.sh"
AUTH_SCRIPT="${SCRIPT_DIR}/setup-entra-spa-auth.sh"
POPULATE_ENV_SCRIPT="${SCRIPT_DIR}/populate-env.sh"

PROD_PUBLIC_API="${PROD_PUBLIC_API:-true}"
SKIP_IMAGE_BUILD="${SKIP_IMAGE_BUILD:-false}"
SKIP_SEARCH_BOOTSTRAP="${SKIP_SEARCH_BOOTSTRAP:-false}"
SKIP_AUTH_SETUP="${SKIP_AUTH_SETUP:-true}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y.%m.%d.%H%M%S)}"
CONTAINER_IMAGE="${CONTAINER_IMAGE:-}"
ACR_NAME="${ACR_NAME:-}"

log_info() { echo "[INFO] $1"; }
log_warn() { echo "[WARN] $1"; }
log_error() { echo "[ERROR] $1"; }
log_success() { echo "[SUCCESS] $1"; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log_error "Required command not found: $1"
    exit 1
  fi
}

wait_for_search_state() {
  local rg="$1"
  local name="$2"
  local expected_pna="$3"
  local timeout_seconds="${4:-600}"
  local started_at now elapsed state pna

  started_at="$(date +%s)"
  while true; do
    state="$(az search service show -g "${rg}" -n "${name}" --query provisioningState -o tsv 2>/dev/null || echo "Unknown")"
    pna="$(az search service show -g "${rg}" -n "${name}" --query publicNetworkAccess -o tsv 2>/dev/null || echo "Unknown")"

    if [[ "${state}" == "succeeded" && "${pna}" == "${expected_pna}" ]]; then
      return 0
    fi

    now="$(date +%s)"
    elapsed=$((now - started_at))
    if (( elapsed >= timeout_seconds )); then
      log_error "Timed out waiting for Search service '${name}' to reach state='succeeded' pna='${expected_pna}'. Last: state=${state}, pna=${pna}"
      return 1
    fi

    log_info "Waiting for Search service update (state=${state}, pna=${pna})..."
    sleep 15
  done
}

create_or_resolve_acr_name() {
  local rg="$1"
  if [[ -n "${ACR_NAME}" ]]; then
    echo "${ACR_NAME}"
    return 0
  fi

  local existing
  existing="$(az acr list -g "${rg}" --query "[0].name" -o tsv 2>/dev/null || true)"
  if [[ -n "${existing}" ]]; then
    echo "${existing}"
    return 0
  fi

  # Deterministic, globally unique-ish ACR name per subscription+resource group.
  python - "${SUBSCRIPTION_ID}" "${rg}" <<'PY'
import hashlib
import os
import re
import sys

sub = sys.argv[1]
rg = sys.argv[2]
base = re.sub(r"[^a-z0-9]", "", rg.lower())
base = (base[:24] or "cdss")
suffix = hashlib.sha1(f"{sub}:{rg}".encode()).hexdigest()[:8]
name = f"{base}acr{suffix}"[:50]
if not name[0].isalpha():
    name = f"cdss{name}"[:50]
print(name)
PY
}

require_cmd az
require_cmd docker
require_cmd bash

if ! az account show >/dev/null 2>&1; then
  log_error "Not logged in to Azure CLI. Run: az login"
  exit 1
fi

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
SUBSCRIPTION_NAME="$(az account show --query name -o tsv)"
log_info "Subscription: ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})"

log_info "Ensuring resource group exists: ${RESOURCE_GROUP}"
az group create -n "${RESOURCE_GROUP}" -l "${LOCATION}" --output none

if [[ -z "${CONTAINER_IMAGE}" ]]; then
  ACR_NAME="$(create_or_resolve_acr_name "${RESOURCE_GROUP}")"

  if ! az acr show -n "${ACR_NAME}" -g "${RESOURCE_GROUP}" >/dev/null 2>&1; then
    log_info "Creating ACR: ${ACR_NAME}"
    az acr create -n "${ACR_NAME}" -g "${RESOURCE_GROUP}" -l "${LOCATION}" --sku Standard --output none
  else
    log_info "Using existing ACR: ${ACR_NAME}"
  fi

  CONTAINER_IMAGE="${ACR_NAME}.azurecr.io/cdss-api:${IMAGE_TAG}"

  if [[ "${SKIP_IMAGE_BUILD}" != "true" ]]; then
    log_info "Logging in to ACR: ${ACR_NAME}"
    az acr login -n "${ACR_NAME}" --output none

    log_info "Preparing docker buildx builder"
    docker buildx create --name cdssbuilder --use >/dev/null 2>&1 || docker buildx use cdssbuilder >/dev/null
    docker buildx inspect --bootstrap >/dev/null

    log_info "Building and pushing backend image: ${CONTAINER_IMAGE}"
    docker buildx build --platform linux/amd64 -t "${CONTAINER_IMAGE}" --push .
  else
    log_warn "SKIP_IMAGE_BUILD=true, expecting image already exists: ${CONTAINER_IMAGE}"
  fi

  log_info "Verifying image tag in ACR"
  az acr repository show --name "${ACR_NAME}" --image "cdss-api:${IMAGE_TAG}" --output none
else
  if [[ -z "${ACR_NAME}" ]]; then
    ACR_NAME="${CONTAINER_IMAGE%%/*}"
    ACR_NAME="${ACR_NAME%%.azurecr.io}"
  fi
  log_info "Using pre-supplied container image: ${CONTAINER_IMAGE}"
fi

log_info "Deploying infrastructure and app via deploy.sh"
CONTAINER_IMAGE="${CONTAINER_IMAGE}" \
ACR_NAME="${ACR_NAME}" \
"${DEPLOY_SCRIPT}" "${ENVIRONMENT}" "${RESOURCE_GROUP}" "${LOCATION}" "${PROD_PUBLIC_API}"

if [[ "${SKIP_SEARCH_BOOTSTRAP}" != "true" ]]; then
  SEARCH_NAME="$(az search service list -g "${RESOURCE_GROUP}" --query "[0].name" -o tsv 2>/dev/null || true)"
  if [[ -n "${SEARCH_NAME}" ]]; then
    ORIGINAL_PNA="$(az search service show -g "${RESOURCE_GROUP}" -n "${SEARCH_NAME}" --query publicNetworkAccess -o tsv 2>/dev/null || echo "disabled")"
    NEED_DISABLE="false"

    if [[ "${ORIGINAL_PNA}" != "Enabled" ]]; then
      log_warn "Temporarily enabling Search public network access for index bootstrap"
      az search service update -g "${RESOURCE_GROUP}" -n "${SEARCH_NAME}" --public-network-access enabled --output none
      wait_for_search_state "${RESOURCE_GROUP}" "${SEARCH_NAME}" "Enabled"
      NEED_DISABLE="true"
    fi

    log_info "Creating/updating Search indexes"
    "${INDEX_SCRIPT}" "${RESOURCE_GROUP}" "${SEARCH_NAME}"

    if [[ "${NEED_DISABLE}" == "true" ]]; then
      log_info "Restoring Search public network access to disabled"
      az search service update -g "${RESOURCE_GROUP}" -n "${SEARCH_NAME}" --public-network-access disabled --output none
      wait_for_search_state "${RESOURCE_GROUP}" "${SEARCH_NAME}" "Disabled"
    fi
  else
    log_warn "No Search service found; skipping index bootstrap"
  fi
else
  log_warn "Skipping Search bootstrap by request"
fi

if [[ -x "${POPULATE_ENV_SCRIPT}" ]]; then
  log_info "Generating local env files from Azure resources"
  "${POPULATE_ENV_SCRIPT}" "${RESOURCE_GROUP}" || log_warn "populate-env.sh failed; continue manually if needed."
fi

APP_NAME="$(az containerapp list -g "${RESOURCE_GROUP}" --query "[?contains(name,'-api')].name | [0]" -o tsv 2>/dev/null || true)"
if [[ "${SKIP_AUTH_SETUP}" != "true" && -n "${APP_NAME}" ]]; then
  log_info "Running Entra SPA auth setup"
  "${AUTH_SCRIPT}" --resource-group "${RESOURCE_GROUP}" --container-app-name "${APP_NAME}" || \
    log_warn "setup-entra-spa-auth.sh failed; run it manually if tenant permissions are restricted."
else
  log_info "Skipping Entra SPA auth setup (SKIP_AUTH_SETUP=${SKIP_AUTH_SETUP})"
fi

API_FQDN=""
if [[ -n "${APP_NAME}" ]]; then
  API_FQDN="$(az containerapp show -g "${RESOURCE_GROUP}" -n "${APP_NAME}" --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || true)"
fi

log_success "Bootstrap deployment completed"
echo ""
echo "Next steps:"
echo "  1) Frontend auth setup (if skipped): ./infra/scripts/setup-entra-spa-auth.sh --resource-group ${RESOURCE_GROUP} --container-app-name ${APP_NAME:-<api-app-name>}"
echo "  2) Start frontend: cd frontend && npm install && npm run dev"
if [[ -n "${API_FQDN}" ]]; then
  echo "  3) API docs: https://${API_FQDN}/docs"
fi
