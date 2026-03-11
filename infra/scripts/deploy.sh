#!/bin/bash
# ============================================================================
# Clinical Decision Support System - Azure Infrastructure Deployment
# ============================================================================
#
# Usage:
#   ./deploy.sh <environment> <resource-group> [location] [prod-public-api]
#
# Examples:
#   ./deploy.sh dev cdss-dev-rg eastus2
#   ./deploy.sh staging cdss-staging-rg eastus2
#   ./deploy.sh prod cdss-prod-rg eastus2
#   ./deploy.sh prod cdss-prod-rg eastus2 true
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
PROD_PUBLIC_API_OVERRIDE="${4:-${PROD_PUBLIC_API:-}}"

if [[ -z "$ENVIRONMENT" || -z "$RESOURCE_GROUP" ]]; then
    echo "Usage: $0 <environment> <resource-group> [location] [prod-public-api]"
    echo ""
    echo "Arguments:"
    echo "  environment     Target environment: dev, staging, or prod"
    echo "  resource-group  Azure resource group name"
    echo "  location        Azure region (default: eastus2)"
    echo "  prod-public-api Optional true/false override for prod API exposure"
    echo ""
    echo "Examples:"
    echo "  $0 dev cdss-dev-rg"
    echo "  $0 prod cdss-prod-rg westus2"
    echo "  $0 prod cdss-prod-rg eastus2 true"
    echo ""
    echo "Environment variable alternative:"
    echo "  PROD_PUBLIC_API=true $0 prod cdss-prod-rg"
    exit 1
fi

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Must be one of: dev, staging, prod"
    exit 1
fi

if [[ -n "$PROD_PUBLIC_API_OVERRIDE" && "$PROD_PUBLIC_API_OVERRIDE" != "true" && "$PROD_PUBLIC_API_OVERRIDE" != "false" ]]; then
    log_error "Invalid prod-public-api value: $PROD_PUBLIC_API_OVERRIDE. Must be true or false."
    exit 1
fi

if [[ "$ENVIRONMENT" != "prod" && -n "$PROD_PUBLIC_API_OVERRIDE" ]]; then
    log_warn "Ignoring prod-public-api override for non-prod environment: ${ENVIRONMENT}"
fi

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BICEP_DIR="${SCRIPT_DIR}/../bicep"
BICEP_FILE="${BICEP_DIR}/main.bicep"
PARAMS_FILE="${BICEP_DIR}/parameters.${ENVIRONMENT}.json"
DEPLOYMENT_NAME="cdss-${ENVIRONMENT}-$(date +%Y%m%d%H%M%S)"
EXTRA_BICEP_PARAMS=""
OPENAI_RESTORE_ENABLED="false"
DOCINTEL_RESTORE_ENABLED="false"

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
    if [[ -n "$PROD_PUBLIC_API_OVERRIDE" ]]; then
        if [[ "$PROD_PUBLIC_API_OVERRIDE" == "true" ]]; then
            log_warn "API Exposure:   PUBLIC (override)"
        else
            log_warn "API Exposure:   PRIVATE (override)"
        fi
    fi
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
refresh_extra_bicep_params() {
    EXTRA_BICEP_PARAMS=""

    if [[ "$OPENAI_RESTORE_ENABLED" == "true" ]]; then
        EXTRA_BICEP_PARAMS="${EXTRA_BICEP_PARAMS} openaiRestore=true"
    fi

    if [[ "$DOCINTEL_RESTORE_ENABLED" == "true" ]]; then
        EXTRA_BICEP_PARAMS="${EXTRA_BICEP_PARAMS} docIntelRestore=true"
    fi

    if [[ "$ENVIRONMENT" == "prod" && -n "$PROD_PUBLIC_API_OVERRIDE" ]]; then
        EXTRA_BICEP_PARAMS="${EXTRA_BICEP_PARAMS} prodPublicApi=${PROD_PUBLIC_API_OVERRIDE}"
    fi

    EXTRA_BICEP_PARAMS="$(echo "$EXTRA_BICEP_PARAMS" | xargs)"
}

run_validate() {
    local cmd="az deployment group validate \
        --resource-group ${RESOURCE_GROUP} \
        --template-file ${BICEP_FILE} \
        --parameters environment=${ENVIRONMENT} location=${LOCATION}"

    if [[ -n "${PARAMS_FILE}" ]]; then
        cmd="${cmd} --parameters @${PARAMS_FILE}"
    fi

    if [[ -n "${EXTRA_BICEP_PARAMS}" ]]; then
        cmd="${cmd} --parameters ${EXTRA_BICEP_PARAMS}"
    fi

    eval "$cmd" --output none 2>&1
}

refresh_extra_bicep_params
for _ in 1 2 3; do
    set +e
    VALIDATE_OUTPUT=$(run_validate)
    VALIDATE_STATUS=$?
    set -e

    if [[ $VALIDATE_STATUS -eq 0 ]]; then
        break
    fi

    if [[ "$VALIDATE_OUTPUT" != *"FlagMustBeSetForRestore"* ]]; then
        break
    fi

    if [[ "$VALIDATE_OUTPUT" == *"docintel"* || "$VALIDATE_OUTPUT" == *"FormRecognizer"* ]]; then
        if [[ "$DOCINTEL_RESTORE_ENABLED" != "true" ]]; then
            log_warn "Detected a soft-deleted Document Intelligence account with the same name."
            log_warn "Retrying validation with docIntelRestore=true..."
            DOCINTEL_RESTORE_ENABLED="true"
            refresh_extra_bicep_params
            continue
        fi
    fi

    if [[ "$VALIDATE_OUTPUT" == *"oai"* || "$VALIDATE_OUTPUT" == *"OpenAI"* ]]; then
        if [[ "$OPENAI_RESTORE_ENABLED" != "true" ]]; then
            log_warn "Detected a soft-deleted Azure OpenAI account with the same name."
            log_warn "Retrying validation with openaiRestore=true..."
            OPENAI_RESTORE_ENABLED="true"
            refresh_extra_bicep_params
            continue
        fi
    fi

    if [[ "$OPENAI_RESTORE_ENABLED" != "true" ]]; then
        log_warn "Detected a soft-deleted AI account. Retrying validation with openaiRestore=true..."
        OPENAI_RESTORE_ENABLED="true"
        refresh_extra_bicep_params
        continue
    fi

    if [[ "$DOCINTEL_RESTORE_ENABLED" != "true" ]]; then
        log_warn "Detected a soft-deleted AI account. Retrying validation with docIntelRestore=true..."
        DOCINTEL_RESTORE_ENABLED="true"
        refresh_extra_bicep_params
        continue
    fi

    break
done

if [[ $VALIDATE_STATUS -eq 0 ]]; then
    log_success "Template validation passed."
elif [[ "$VALIDATE_OUTPUT" == *"715-123420"* ]]; then
    log_warn "Azure template validation returned internal error 715-123420."
    log_warn "Proceeding with deployment anyway (resources may already exist)."
else
    echo "$VALIDATE_OUTPUT"
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

if [[ -n "${EXTRA_BICEP_PARAMS}" ]]; then
    WHATIF_CMD="${WHATIF_CMD} --parameters ${EXTRA_BICEP_PARAMS}"
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

if [[ -n "${EXTRA_BICEP_PARAMS}" ]]; then
    DEPLOY_CMD="${DEPLOY_CMD} --parameters ${EXTRA_BICEP_PARAMS}"
fi

set +e
DEPLOY_OUTPUT=$(eval "$DEPLOY_CMD" --output json 2>&1)
DEPLOY_STATUS=$?
set -e

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
if [[ "$OPENAI_RESTORE_ENABLED" == "true" ]]; then
    log_warn "Azure OpenAI was deployed in restore mode due to soft-delete detection."
fi
if [[ "$DOCINTEL_RESTORE_ENABLED" == "true" ]]; then
    log_warn "Document Intelligence was deployed in restore mode due to soft-delete detection."
fi

# --- Fetch resource details directly from Azure ---
log_info "Fetching deployed resource details..."

# Get resource names
COSMOS_NAME=$(az cosmosdb list -g "$RESOURCE_GROUP" --query "[0].name" -o tsv 2>/dev/null || echo "")
SEARCH_NAME=$(az search service list -g "$RESOURCE_GROUP" --query "[0].name" -o tsv 2>/dev/null || echo "")
OPENAI_NAME=$(az cognitiveservices account list -g "$RESOURCE_GROUP" --query "[?kind=='OpenAI'].name" -o tsv 2>/dev/null || echo "")
DOCINTEL_NAME=$(az cognitiveservices account list -g "$RESOURCE_GROUP" --query "[?kind=='FormRecognizer'].name" -o tsv 2>/dev/null || echo "")
STORAGE_NAME=$(az storage account list -g "$RESOURCE_GROUP" --query "[?tags.project=='cdss-agentic-rag'].name" -o tsv 2>/dev/null | head -1 || echo "")

# Get endpoints
COSMOS_ENDPOINT=$(az cosmosdb show -n "$COSMOS_NAME" -g "$RESOURCE_GROUP" --query documentEndpoint -o tsv 2>/dev/null || echo "N/A")
SEARCH_ENDPOINT="https://${SEARCH_NAME}.search.windows.net"
OPENAI_ENDPOINT=$(az cognitiveservices account show -n "$OPENAI_NAME" -g "$RESOURCE_GROUP" --query properties.endpoint -o tsv 2>/dev/null || echo "N/A")
DOCINTEL_ENDPOINT=$(az cognitiveservices account show -n "$DOCINTEL_NAME" -g "$RESOURCE_GROUP" --query properties.endpoint -o tsv 2>/dev/null || echo "N/A")

# Get keys
COSMOS_KEY=$(az cosmosdb keys list -n "$COSMOS_NAME" -g "$RESOURCE_GROUP" --query primaryMasterKey -o tsv 2>/dev/null || echo "")
SEARCH_KEY=$(az search admin-key show --service-name "$SEARCH_NAME" -g "$RESOURCE_GROUP" --query primaryKey -o tsv 2>/dev/null || echo "")
OPENAI_KEY=$(az cognitiveservices account keys list -n "$OPENAI_NAME" -g "$RESOURCE_GROUP" --query key1 -o tsv 2>/dev/null || echo "")
DOCINTEL_KEY=$(az cognitiveservices account keys list -n "$DOCINTEL_NAME" -g "$RESOURCE_GROUP" --query key1 -o tsv 2>/dev/null || echo "")
STORAGE_CONN=$(az storage account show-connection-string -n "$STORAGE_NAME" -g "$RESOURCE_GROUP" --query connectionString -o tsv 2>/dev/null || echo "")

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

# --- Write .env files for local development (Create .env.azure for seed-data.sh) ---
if [[ "$ENVIRONMENT" == "dev" ]]; then
    ENV_AZURE="${SCRIPT_DIR}/../../.env.azure"
    ENV_FILE="${SCRIPT_DIR}/../../.env"
    
    log_info "Writing .env.azure for seed-data.sh..."
    cat > "$ENV_AZURE" <<EOF
ENVIRONMENT=${ENVIRONMENT}
AZURE_COSMOS_ENDPOINT=${COSMOS_ENDPOINT}
AZURE_COSMOS_DATABASE=cdss-db
AZURE_SEARCH_ENDPOINT=${SEARCH_ENDPOINT}
AZURE_OPENAI_ENDPOINT=${OPENAI_ENDPOINT}
AZURE_OPENAI_GPT4O_DEPLOYMENT=gpt-4o
AZURE_OPENAI_GPT4O_MINI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
EOF
    log_success "Created ${ENV_AZURE}"
    
# Create .env (for Python app)
    log_info "Writing .env with full credentials for Python app..."
    cat > "$ENV_FILE" <<'ENVEOF'
    
# ═══════════════════════════════════════════════════════════════════════════════
# CDSS Agentic RAG - Environment Configuration (Auto-generated)
# ═══════════════════════════════════════════════════════════════════════════════

# ── Azure OpenAI ──────────────────────────────────────────────────────────────
ENVEOF
    cat >> "$ENV_FILE" <<EOF
CDSS_AZURE_OPENAI_ENDPOINT=${OPENAI_ENDPOINT}
CDSS_AZURE_OPENAI_API_KEY=${OPENAI_KEY}
CDSS_AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
CDSS_AZURE_OPENAI_MINI_DEPLOYMENT_NAME=gpt-4o-mini
CDSS_AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
CDSS_AZURE_OPENAI_API_VERSION=2024-12-01-preview

# ── Azure AI Search ───────────────────────────────────────────────────────────
CDSS_AZURE_SEARCH_ENDPOINT=${SEARCH_ENDPOINT}
CDSS_AZURE_SEARCH_API_KEY=${SEARCH_KEY}
CDSS_AZURE_SEARCH_PATIENT_RECORDS_INDEX=patient-records
CDSS_AZURE_SEARCH_TREATMENT_PROTOCOLS_INDEX=treatment-protocols
CDSS_AZURE_SEARCH_MEDICAL_LITERATURE_INDEX=medical-literature

# ── Azure Cosmos DB ───────────────────────────────────────────────────────────
CDSS_AZURE_COSMOS_ENDPOINT=${COSMOS_ENDPOINT}
CDSS_AZURE_COSMOS_KEY=${COSMOS_KEY}
CDSS_AZURE_COSMOS_USE_ENTRA_ID=false
CDSS_AZURE_COSMOS_DATABASE_NAME=cdss-db
CDSS_AZURE_COSMOS_PATIENT_PROFILES_CONTAINER=patient-profiles
CDSS_AZURE_COSMOS_CONVERSATION_HISTORY_CONTAINER=conversation-history
CDSS_AZURE_COSMOS_EMBEDDING_CACHE_CONTAINER=embedding-cache
CDSS_AZURE_COSMOS_AUDIT_LOG_CONTAINER=audit-log
CDSS_AZURE_COSMOS_AGENT_STATE_CONTAINER=agent-state

# ── Azure Document Intelligence ──────────────────────────────────────────────
CDSS_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=${DOCINTEL_ENDPOINT}
CDSS_AZURE_DOCUMENT_INTELLIGENCE_KEY=${DOCINTEL_KEY}

# ── Azure Blob Storage ───────────────────────────────────────────────────────
CDSS_AZURE_BLOB_CONNECTION_STRING=${STORAGE_CONN}
CDSS_AZURE_BLOB_PROTOCOLS_CONTAINER=protocols

# ── PubMed / NCBI Entrez ─────────────────────────────────────────────────────
CDSS_PUBMED_API_KEY=
CDSS_PUBMED_EMAIL=
CDSS_PUBMED_BASE_URL=https://eutils.ncbi.nlm.nih.gov/entrez/eutils/

# ── OpenFDA ──────────────────────────────────────────────────────────────────
CDSS_OPENFDA_BASE_URL=https://api.fda.gov

# ── RxNorm ───────────────────────────────────────────────────────────────────
CDSS_RXNORM_BASE_URL=https://rxnav.nlm.nih.gov/REST

# ── DrugBank ─────────────────────────────────────────────────────────────────
CDSS_DRUGBANK_API_KEY=
CDSS_DRUGBANK_BASE_URL=https://api.drugbank.com/v1

# ── Redis ────────────────────────────────────────────────────────────────────
CDSS_REDIS_URL=redis://localhost:6379/0

# ── Application Settings ─────────────────────────────────────────────────────
CDSS_DEBUG=false
CDSS_LOG_LEVEL=INFO
CDSS_CORS_ORIGINS=["http://localhost:3000"]
CDSS_MAX_CONCURRENT_AGENTS=10
CDSS_RESPONSE_TIMEOUT_SECONDS=30
CDSS_CONFIDENCE_THRESHOLD=0.6
EOF
    log_success "Created ${ENV_FILE}"
    log_warn "NOTE: Add your PubMed API key to CDSS_PUBMED_API_KEY in .env"
fi

log_success "Deployment complete! Your CDSS infrastructure is ready."
