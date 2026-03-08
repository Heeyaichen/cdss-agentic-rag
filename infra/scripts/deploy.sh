#!/bin/bash
# ============================================================================
# Clinical Decision Support System - Azure Infrastructure Deployment
# ============================================================================
#
# Usage:
#   ./deploy.sh <environment> <resource-group> [location]
#
# Examples:
#   ./deploy.sh dev cdss-dev-rg eastus2
#   ./deploy.sh staging cdss-staging-rg eastus2
#   ./deploy.sh prod cdss-prod-rg eastus2
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Sufficient permissions to create resources in the subscription
#   - Bicep CLI installed (comes with Azure CLI >= 2.20.0)
#
# ============================================================================

set -euo pipefail

# --- Color output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# --- Parse arguments ---
ENVIRONMENT="${1:-}"
RESOURCE_GROUP="${2:-}"
LOCATION="${3:-eastus2}"

if [[ -z "$ENVIRONMENT" || -z "$RESOURCE_GROUP" ]]; then
    echo "Usage: $0 <environment> <resource-group> [location]"
    echo ""
    echo "Arguments:"
    echo "  environment     Target environment: dev, staging, or prod"
    echo "  resource-group  Azure resource group name"
    echo "  location        Azure region (default: eastus2)"
    echo ""
    echo "Examples:"
    echo "  $0 dev cdss-dev-rg"
    echo "  $0 prod cdss-prod-rg westus2"
    exit 1
fi

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be one of: dev, staging, prod"
    exit 1
fi

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BICEP_DIR="${SCRIPT_DIR}/../bicep"
BICEP_FILE="${BICEP_DIR}/main.bicep"
PARAMS_FILE="${BICEP_DIR}/parameters.${ENVIRONMENT}.json"
DEPLOYMENT_NAME="cdss-${ENVIRONMENT}-$(date +%Y%m%d%H%M%S)"

# --- Preflight checks ---
log_info "Running preflight checks..."

# Check Azure CLI
if ! command -v az &> /dev/null; then
    log_error "Azure CLI is not installed. Please install it: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
ACCOUNT=$(az account show --query "name" -o tsv 2>/dev/null || true)
if [[ -z "$ACCOUNT" ]]; then
    log_error "Not logged into Azure CLI. Please run: az login"
    exit 1
fi
log_info "Azure account: ${ACCOUNT}"

# Check subscription
SUBSCRIPTION_ID=$(az account show --query "id" -o tsv)
SUBSCRIPTION_NAME=$(az account show --query "name" -o tsv)
log_info "Subscription: ${SUBSCRIPTION_NAME} (${SUBSCRIPTION_ID})"

# Check Bicep file exists
if [[ ! -f "$BICEP_FILE" ]]; then
    log_error "Bicep template not found: ${BICEP_FILE}"
    exit 1
fi

# Check parameters file exists
if [[ ! -f "$PARAMS_FILE" ]]; then
    log_warn "Parameters file not found: ${PARAMS_FILE}"
    log_warn "Proceeding with default parameters only."
    PARAMS_FILE=""
fi

# --- Confirmation for production ---
if [[ "$ENVIRONMENT" == "prod" ]]; then
    echo ""
    log_warn "============================================"
    log_warn "  PRODUCTION DEPLOYMENT"
    log_warn "============================================"
    log_warn "Environment:    ${ENVIRONMENT}"
    log_warn "Resource Group: ${RESOURCE_GROUP}"
    log_warn "Location:       ${LOCATION}"
    log_warn "Subscription:   ${SUBSCRIPTION_NAME}"
    echo ""
    read -p "Are you sure you want to deploy to PRODUCTION? (yes/no): " CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
        log_info "Deployment cancelled."
        exit 0
    fi
fi

# --- Create resource group if it does not exist ---
log_info "Checking resource group: ${RESOURCE_GROUP}..."
RG_EXISTS=$(az group exists --name "$RESOURCE_GROUP")
if [[ "$RG_EXISTS" == "false" ]]; then
    log_info "Creating resource group: ${RESOURCE_GROUP} in ${LOCATION}..."
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --tags "project=cdss-agentic-rag" "environment=${ENVIRONMENT}" "managedBy=bicep" \
        --output none
    log_success "Resource group created: ${RESOURCE_GROUP}"
else
    log_info "Resource group already exists: ${RESOURCE_GROUP}"
fi

# --- Validate Bicep template ---
log_info "Validating Bicep template..."
VALIDATE_CMD="az deployment group validate \
    --resource-group ${RESOURCE_GROUP} \
    --template-file ${BICEP_FILE} \
    --parameters environment=${ENVIRONMENT} location=${LOCATION}"

if [[ -n "${PARAMS_FILE}" ]]; then
    VALIDATE_CMD="${VALIDATE_CMD} --parameters @${PARAMS_FILE}"
fi

if eval "$VALIDATE_CMD" --output none 2>&1; then
    log_success "Template validation passed."
else
    log_error "Template validation failed. Fix the errors above and retry."
    exit 1
fi

# --- Run What-If (preview changes) ---
log_info "Running what-if analysis..."
WHATIF_CMD="az deployment group what-if \
    --resource-group ${RESOURCE_GROUP} \
    --template-file ${BICEP_FILE} \
    --parameters environment=${ENVIRONMENT} location=${LOCATION}"

if [[ -n "${PARAMS_FILE}" ]]; then
    WHATIF_CMD="${WHATIF_CMD} --parameters @${PARAMS_FILE}"
fi

eval "$WHATIF_CMD" 2>&1 || true

echo ""
if [[ "$ENVIRONMENT" != "dev" ]]; then
    read -p "Review the changes above. Proceed with deployment? (yes/no): " PROCEED
    if [[ "$PROCEED" != "yes" ]]; then
        log_info "Deployment cancelled."
        exit 0
    fi
fi

# --- Deploy ---
log_info "Starting deployment: ${DEPLOYMENT_NAME}..."
log_info "This may take 15-30 minutes..."

DEPLOY_CMD="az deployment group create \
    --name ${DEPLOYMENT_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --template-file ${BICEP_FILE} \
    --parameters environment=${ENVIRONMENT} location=${LOCATION}"

if [[ -n "${PARAMS_FILE}" ]]; then
    DEPLOY_CMD="${DEPLOY_CMD} --parameters @${PARAMS_FILE}"
fi

DEPLOY_OUTPUT=$(eval "$DEPLOY_CMD" --output json 2>&1)
DEPLOY_STATUS=$?

if [[ $DEPLOY_STATUS -ne 0 ]]; then
    log_error "Deployment failed!"
    echo "$DEPLOY_OUTPUT"

    # Show deployment operations for debugging
    log_info "Fetching deployment error details..."
    az deployment group show \
        --name "$DEPLOYMENT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "properties.error" \
        --output json 2>/dev/null || true

    az deployment operation group list \
        --name "$DEPLOYMENT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "[?properties.provisioningState=='Failed'].{resource:properties.targetResource.resourceName, status:properties.statusMessage.error}" \
        --output table 2>/dev/null || true

    exit 1
fi

log_success "Deployment completed successfully!"

# --- Extract outputs ---
log_info "Extracting deployment outputs..."

COSMOS_ENDPOINT=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['properties']['outputs']['cosmosEndpoint']['value'])" 2>/dev/null || echo "N/A")
SEARCH_ENDPOINT=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['properties']['outputs']['searchEndpoint']['value'])" 2>/dev/null || echo "N/A")
OPENAI_ENDPOINT=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['properties']['outputs']['openaiEndpoint']['value'])" 2>/dev/null || echo "N/A")
KEY_VAULT_URI=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['properties']['outputs']['keyVaultUri']['value'])" 2>/dev/null || echo "N/A")
CONTAINER_APP_URL=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['properties']['outputs']['containerAppUrl']['value'])" 2>/dev/null || echo "N/A")
APP_INSIGHTS_KEY=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['properties']['outputs']['appInsightsKey']['value'])" 2>/dev/null || echo "N/A")
MANAGED_IDENTITY_ID=$(echo "$DEPLOY_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['properties']['outputs']['managedIdentityClientId']['value'])" 2>/dev/null || echo "N/A")

echo ""
log_success "============================================"
log_success "  CDSS Deployment Summary"
log_success "============================================"
echo ""
echo "  Environment:          ${ENVIRONMENT}"
echo "  Resource Group:       ${RESOURCE_GROUP}"
echo "  Location:             ${LOCATION}"
echo "  Deployment Name:      ${DEPLOYMENT_NAME}"
echo ""
echo "  Cosmos DB Endpoint:   ${COSMOS_ENDPOINT}"
echo "  AI Search Endpoint:   ${SEARCH_ENDPOINT}"
echo "  OpenAI Endpoint:      ${OPENAI_ENDPOINT}"
echo "  Key Vault URI:        ${KEY_VAULT_URI}"
echo "  Container App URL:    ${CONTAINER_APP_URL}"
echo "  App Insights Key:     ${APP_INSIGHTS_KEY}"
echo "  Managed Identity ID:  ${MANAGED_IDENTITY_ID}"
echo ""
log_success "============================================"

# --- Write .env file for local development ---
if [[ "$ENVIRONMENT" == "dev" ]]; then
    ENV_FILE="${SCRIPT_DIR}/../../.env.azure"
    log_info "Writing Azure configuration to ${ENV_FILE}..."

    cat > "$ENV_FILE" <<EOF
# Auto-generated by deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Environment: ${ENVIRONMENT}
# Resource Group: ${RESOURCE_GROUP}

ENVIRONMENT=${ENVIRONMENT}
AZURE_COSMOS_ENDPOINT=${COSMOS_ENDPOINT}
AZURE_COSMOS_DATABASE=cdss-db
AZURE_SEARCH_ENDPOINT=${SEARCH_ENDPOINT}
AZURE_OPENAI_ENDPOINT=${OPENAI_ENDPOINT}
AZURE_OPENAI_GPT4O_DEPLOYMENT=gpt-4o
AZURE_OPENAI_GPT4O_MINI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
AZURE_KEY_VAULT_URI=${KEY_VAULT_URI}
APPLICATIONINSIGHTS_CONNECTION_STRING=
AZURE_CLIENT_ID=${MANAGED_IDENTITY_ID}
EOF

    log_success "Azure configuration written to ${ENV_FILE}"
    log_warn "NOTE: Secrets (API keys, connection strings) are stored in Key Vault."
    log_warn "      Use 'az keyvault secret list --vault-name <vault>' to view available secrets."
fi

log_success "Deployment complete! Your CDSS infrastructure is ready."
