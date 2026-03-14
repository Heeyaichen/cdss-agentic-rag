#!/bin/bash
# Seed sample data from inside Azure Container App network boundary.
#
# This script executes a Python payload inside the deployed Container App so
# Cosmos DB and Storage private-network restrictions do not block seeding.
#
# Usage:
#   ./infra/scripts/seed-data-infra-network.sh <resource-group> [container-app-name]
#
# Example:
#   ./infra/scripts/seed-data-infra-network.sh cdss-prod-rg

set -euo pipefail

RESOURCE_GROUP="${1:-cdss-prod-rg}"
CONTAINER_APP_NAME="${2:-}"

log_info() {
    echo "[INFO] $1"
}

log_warn() {
    echo "[WARN] $1"
}

log_error() {
    echo "[ERROR] $1"
}

if ! command -v az >/dev/null 2>&1; then
    log_error "Azure CLI is required."
    exit 1
fi

if ! az account show >/dev/null 2>&1; then
    log_error "Not logged in to Azure CLI. Run: az login"
    exit 1
fi

if [[ -z "${CONTAINER_APP_NAME}" ]]; then
    CONTAINER_APP_NAME="$(az containerapp list --resource-group "${RESOURCE_GROUP}" --query "[?contains(name, '-api')].name | [0]" -o tsv)"
fi

if [[ -z "${CONTAINER_APP_NAME}" ]]; then
    log_error "Could not resolve a Container App name in resource group ${RESOURCE_GROUP}."
    log_error "Pass it explicitly as the second argument."
    exit 1
fi

log_info "Using Container App: ${CONTAINER_APP_NAME}"
log_info "Preparing compact in-network seeding payload..."

KEYVAULT_NAME="$(az keyvault list --resource-group "${RESOURCE_GROUP}" --query "[0].name" -o tsv 2>/dev/null || true)"
MANAGED_IDENTITY_ID="$(az containerapp show --resource-group "${RESOURCE_GROUP}" --name "${CONTAINER_APP_NAME}" --query "keys(identity.userAssignedIdentities)[0]" -o tsv 2>/dev/null || true)"

if [[ -n "${KEYVAULT_NAME}" && -n "${MANAGED_IDENTITY_ID}" ]]; then
    KEYVAULT_ID="$(az keyvault show --name "${KEYVAULT_NAME}" --resource-group "${RESOURCE_GROUP}" --query id -o tsv 2>/dev/null || true)"
    MANAGED_IDENTITY_PRINCIPAL_ID="$(az identity show --ids "${MANAGED_IDENTITY_ID}" --query principalId -o tsv 2>/dev/null || true)"

    if [[ -n "${KEYVAULT_ID}" && -n "${MANAGED_IDENTITY_PRINCIPAL_ID}" ]]; then
        KV_ROLE_COUNT="$(az role assignment list \
            --assignee-object-id "${MANAGED_IDENTITY_PRINCIPAL_ID}" \
            --scope "${KEYVAULT_ID}" \
            --query "[?roleDefinitionName=='Key Vault Secrets User'] | length(@)" \
            -o tsv 2>/dev/null || true)"

        if [[ "${KV_ROLE_COUNT}" == "0" || -z "${KV_ROLE_COUNT}" ]]; then
            log_info "Assigning Key Vault Secrets User role to Container App managed identity..."
            if az role assignment create \
                --assignee-object-id "${MANAGED_IDENTITY_PRINCIPAL_ID}" \
                --assignee-principal-type ServicePrincipal \
                --role "Key Vault Secrets User" \
                --scope "${KEYVAULT_ID}" \
                --only-show-errors \
                --output none 2>/tmp/cdss_seed_network_error.log; then
                log_info "Role assignment created. Waiting for RBAC propagation..."
                sleep 20
            else
                log_warn "Could not assign Key Vault role automatically: $(cat /tmp/cdss_seed_network_error.log 2>/dev/null || true)"
            fi
        fi
    fi
fi

# Resolve a runnable revision for `az containerapp exec`.
ACTIVE_REVISION="$(az containerapp show \
    --resource-group "${RESOURCE_GROUP}" \
    --name "${CONTAINER_APP_NAME}" \
    --query "properties.latestReadyRevisionName" \
    -o tsv 2>/dev/null || true)"

if [[ -z "${ACTIVE_REVISION}" || "${ACTIVE_REVISION}" == "null" ]]; then
    ACTIVE_REVISION="$(az containerapp show \
        --resource-group "${RESOURCE_GROUP}" \
        --name "${CONTAINER_APP_NAME}" \
        --query "properties.latestRevisionName" \
        -o tsv 2>/dev/null || true)"
fi

if [[ -z "${ACTIVE_REVISION}" || "${ACTIVE_REVISION}" == "null" ]]; then
    ACTIVE_REVISION="$(az containerapp revision list \
        --resource-group "${RESOURCE_GROUP}" \
        --name "${CONTAINER_APP_NAME}" \
        --query "sort_by(@, &properties.createdTime)[-1].name" \
        -o tsv 2>/dev/null || true)"
fi

if [[ -z "${ACTIVE_REVISION}" || "${ACTIVE_REVISION}" == "null" ]]; then
    log_warn "No revision found. Attempting to trigger a fresh revision..."
    PROBE_VALUE="$(date +%s)"
    if az containerapp update \
        --resource-group "${RESOURCE_GROUP}" \
        --name "${CONTAINER_APP_NAME}" \
        --set-env-vars "SEED_PROBE_TS=${PROBE_VALUE}" \
        --output none 2>/tmp/cdss_seed_network_error.log; then
        log_info "Container App update submitted. Waiting for revision provisioning..."
        sleep 20
    else
        log_warn "Container App update failed: $(cat /tmp/cdss_seed_network_error.log 2>/dev/null || true)"
    fi

    ACTIVE_REVISION="$(az containerapp show \
        --resource-group "${RESOURCE_GROUP}" \
        --name "${CONTAINER_APP_NAME}" \
        --query "properties.latestReadyRevisionName" \
        -o tsv 2>/dev/null || true)"

    if [[ -z "${ACTIVE_REVISION}" || "${ACTIVE_REVISION}" == "null" ]]; then
        ACTIVE_REVISION="$(az containerapp revision list \
            --resource-group "${RESOURCE_GROUP}" \
            --name "${CONTAINER_APP_NAME}" \
            --query "sort_by(@, &properties.createdTime)[-1].name" \
            -o tsv 2>/dev/null || true)"
    fi

    if [[ -z "${ACTIVE_REVISION}" || "${ACTIVE_REVISION}" == "null" ]]; then
        PROVISIONING_STATE="$(az containerapp show --resource-group "${RESOURCE_GROUP}" --name "${CONTAINER_APP_NAME}" --query "properties.provisioningState" -o tsv 2>/dev/null || true)"
        log_error "No Container App revision found for ${CONTAINER_APP_NAME}."
        log_error "Check revision status with:"
        log_error "  az containerapp revision list -g ${RESOURCE_GROUP} -n ${CONTAINER_APP_NAME} -o table"
        log_error "  az containerapp show -g ${RESOURCE_GROUP} -n ${CONTAINER_APP_NAME} --query properties.provisioningState -o tsv"
        if [[ "${PROVISIONING_STATE}" == "Failed" ]]; then
            log_error "Container App provisioning is Failed. Apply latest infra fixes and recreate a revision:"
            log_error "  ./infra/scripts/deploy.sh prod ${RESOURCE_GROUP}"
        fi
        exit 1
    fi
fi

log_info "Using revision: ${ACTIVE_REVISION}"

REMOTE_COMMAND="python -c \"import os;from datetime import datetime,timezone;from azure.cosmos import CosmosClient;from azure.identity import DefaultAzureCredential;from azure.storage.blob import BlobServiceClient;cred=DefaultAzureCredential();db=CosmosClient(os.environ['CDSS_AZURE_COSMOS_ENDPOINT'],cred).get_database_client(os.getenv('CDSS_AZURE_COSMOS_DATABASE_NAME','cdss-db'));now=datetime.now(timezone.utc).isoformat();patient={'id':'patient_12345','patient_id':'patient_12345','name':'Jane Doe','conditions':['T2DM','CKD3'],'medications':['Metformin','Lisinopril'],'created_at':now,'updated_at':now};db.get_container_client('patient-profiles').upsert_item(patient);blob=BlobServiceClient(account_url=os.environ['CDSS_AZURE_BLOB_ENDPOINT'],credential=cred);blob.get_blob_client(container='treatment-protocols',blob='ENDO-DM-CKD-2025-v3.md').upload_blob('Protocol seed content',overwrite=True);blob.get_blob_client(container='staging-documents',blob='lab_report_patient_12345_20260128.txt').upload_blob('HbA1c 8.4; eGFR 42; UACR 110',overwrite=True);print('Seeding completed')\""
REMOTE_COMMAND_LENGTH=${#REMOTE_COMMAND}
log_info "Remote command length: ${REMOTE_COMMAND_LENGTH} characters"

log_info "Executing seeding payload inside Container App network..."
az containerapp exec \
    --resource-group "${RESOURCE_GROUP}" \
    --name "${CONTAINER_APP_NAME}" \
    --revision "${ACTIVE_REVISION}" \
    --command "${REMOTE_COMMAND}"

log_info "Done."
