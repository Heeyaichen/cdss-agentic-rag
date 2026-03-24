#!/bin/bash
# ============================================================================
# Configure PubMed credentials for deployed CDSS backend (production-safe).
# Stores values in Key Vault and wires Container App env vars via secretRef.
#
# Usage:
#   CDSS_PUBMED_API_KEY=<key> CDSS_PUBMED_EMAIL=<email> \
#     ./infra/scripts/configure-pubmed-prod.sh <resource-group> [container-app-name] [key-vault-name]
# ============================================================================

set -euo pipefail

RESOURCE_GROUP="${1:-}"
CONTAINER_APP_NAME="${2:-}"
KEY_VAULT_NAME="${3:-}"
PUBMED_API_KEY="${CDSS_PUBMED_API_KEY:-${PUBMED_API_KEY:-}}"
PUBMED_EMAIL="${CDSS_PUBMED_EMAIL:-${PUBMED_EMAIL:-}}"
PUBMED_BASE_URL="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"

log_info() { echo "[INFO] $1"; }
log_warn() { echo "[WARN] $1"; }
log_error() { echo "[ERROR] $1"; }
log_success() { echo "[SUCCESS] $1"; }

if [[ -z "${RESOURCE_GROUP}" ]]; then
  log_error "Usage: $0 <resource-group> [container-app-name] [key-vault-name]"
  exit 1
fi

if [[ -z "${PUBMED_API_KEY}" || -z "${PUBMED_EMAIL}" ]]; then
  log_error "CDSS_PUBMED_API_KEY and CDSS_PUBMED_EMAIL are required."
  log_error "Example:"
  log_error "  CDSS_PUBMED_API_KEY=<key> CDSS_PUBMED_EMAIL=<email> $0 ${RESOURCE_GROUP}"
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  log_error "Azure CLI is required."
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  log_error "Not logged in to Azure CLI. Run: az login"
  exit 1
fi

if [[ -z "${CONTAINER_APP_NAME}" ]]; then
  CONTAINER_APP_NAME="$(az containerapp list -g "${RESOURCE_GROUP}" --query "[?contains(name,'-api')].name | [0]" -o tsv 2>/dev/null || true)"
fi
if [[ -z "${CONTAINER_APP_NAME}" ]]; then
  log_error "Could not resolve backend Container App in resource group ${RESOURCE_GROUP}."
  exit 1
fi

if [[ -z "${KEY_VAULT_NAME}" ]]; then
  KEY_VAULT_NAME="$(az keyvault list -g "${RESOURCE_GROUP}" --query "[0].name" -o tsv 2>/dev/null || true)"
fi
if [[ -z "${KEY_VAULT_NAME}" ]]; then
  log_error "Could not resolve Key Vault in resource group ${RESOURCE_GROUP}."
  exit 1
fi

MANAGED_IDENTITY_ID="$(az containerapp show \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${CONTAINER_APP_NAME}" \
  --query "keys(identity.userAssignedIdentities)[0]" \
  -o tsv 2>/dev/null || true)"
if [[ -z "${MANAGED_IDENTITY_ID}" ]]; then
  log_error "Container App does not have a user-assigned managed identity."
  exit 1
fi

MANAGED_IDENTITY_PRINCIPAL_ID="$(az identity show --ids "${MANAGED_IDENTITY_ID}" --query principalId -o tsv)"
KEY_VAULT_ID="$(az keyvault show --name "${KEY_VAULT_NAME}" --resource-group "${RESOURCE_GROUP}" --query id -o tsv)"
KEY_VAULT_URI="$(az keyvault show --name "${KEY_VAULT_NAME}" --resource-group "${RESOURCE_GROUP}" --query properties.vaultUri -o tsv)"

log_info "Ensuring Key Vault Secrets User role for Container App identity..."
KV_ROLE_COUNT="$(az role assignment list \
  --assignee-object-id "${MANAGED_IDENTITY_PRINCIPAL_ID}" \
  --scope "${KEY_VAULT_ID}" \
  --query "[?roleDefinitionName=='Key Vault Secrets User'] | length(@)" \
  -o tsv 2>/dev/null || echo "0")"

if [[ "${KV_ROLE_COUNT}" == "0" ]]; then
  az role assignment create \
    --assignee-object-id "${MANAGED_IDENTITY_PRINCIPAL_ID}" \
    --assignee-principal-type ServicePrincipal \
    --role "Key Vault Secrets User" \
    --scope "${KEY_VAULT_ID}" \
    --only-show-errors \
    --output none
  log_info "Role assignment created. Waiting for RBAC propagation..."
  sleep 20
else
  log_info "Role assignment already present."
fi

log_info "Writing PubMed secrets to Key Vault..."
az keyvault secret set --vault-name "${KEY_VAULT_NAME}" --name "pubmed-api-key" --value "${PUBMED_API_KEY}" --output none
az keyvault secret set --vault-name "${KEY_VAULT_NAME}" --name "pubmed-email" --value "${PUBMED_EMAIL}" --output none

log_info "Binding Key Vault-backed secrets to Container App..."
az containerapp secret set \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${CONTAINER_APP_NAME}" \
  --secrets \
    "pubmed-api-key=keyvaultref:${KEY_VAULT_URI}secrets/pubmed-api-key,identityref:${MANAGED_IDENTITY_ID}" \
    "pubmed-email=keyvaultref:${KEY_VAULT_URI}secrets/pubmed-email,identityref:${MANAGED_IDENTITY_ID}" \
  --only-show-errors \
  --output none

log_info "Updating backend runtime env vars to use secretRef..."
az containerapp update \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${CONTAINER_APP_NAME}" \
  --set-env-vars \
    "CDSS_PUBMED_API_KEY=secretref:pubmed-api-key" \
    "CDSS_PUBMED_EMAIL=secretref:pubmed-email" \
    "CDSS_PUBMED_BASE_URL=${PUBMED_BASE_URL}" \
  --only-show-errors \
  --output none

log_success "PubMed production configuration applied."

echo ""
echo "Configured backend env vars:"
az containerapp show \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${CONTAINER_APP_NAME}" \
  --query "properties.template.containers[0].env[?name=='CDSS_PUBMED_API_KEY'||name=='CDSS_PUBMED_EMAIL'||name=='CDSS_PUBMED_BASE_URL'].{name:name,secretRef:secretRef,value:value}" \
  -o table

