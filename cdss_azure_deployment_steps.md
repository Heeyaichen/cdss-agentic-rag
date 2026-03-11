# CDSS Azure Deployment Step-by-Step Guide

This document provides comprehensive instructions for deploying the CDSS application to Azure, incorporating all fixes and lessons learned from troubleshooting sessions.

## Prerequisites

- Azure CLI installed and logged in (`az login`)
- Docker Desktop installed and running
- Python 3.12+ with virtual environment
- Active Azure subscription with appropriate permissions

---

## Phase 1: Infrastructure Deployment

### Step 1.1: Deploy Azure Infrastructure

```bash
# Deploy to production environment
./infra/scripts/deploy.sh prod cdss-prod-rg

# Answer 'yes' to confirmation prompts
```

**Note:** If you encounter Azure internal validation error (715-123420), the deployment script will automatically proceed anyway. This error is a known Azure platform issue that doesn't affect actual deployment.

### Step 1.2: Handle Partial Deployment Failures

If the Bicep deployment fails with network-related errors, run these remediation steps:

```bash
# Enable public access on Key Vault temporarily
az keyvault update --name cdssprodkvjfv6ku4wuty3w --resource-group cdss-prod-rg --public-network-access Enabled

# Add your IP to Key Vault firewall
MY_IP=$(curl -s https://api.ipify.org)
az keyvault network-rule add --name cdssprodkvjfv6ku4wuty3w --ip-address "${MY_IP}/32"

# Grant yourself Key Vault Secrets Officer role
az role assignment create \
  --role "Key Vault Secrets Officer" \
  --assignee "surbhi@k21academy.com" \
  --scope /subscriptions/35914a7e-ca5b-4df1-a613-603e700a7ce1/resourceGroups/cdss-prod-rg/providers/Microsoft.KeyVault/vaults/cdssprodkvjfv6ku4wuty3w

# Wait for RBAC propagation
sleep 60

# Create storage connection string secret if missing
STORAGE_KEY=$(az storage account keys list --account-name cdssprodstjfv6ku4wuty3w --resource-group cdss-prod-rg --query "[0].value" -o tsv)
STORAGE_CONN="DefaultEndpointsProtocol=https;AccountName=cdssprodstjfv6ku4wuty3w;AccountKey=${STORAGE_KEY};EndpointSuffix=core.windows.net"
az keyvault secret set --vault-name cdssprodkvjfv6ku4wuty3w --name storage-connection-string --value "$STORAGE_CONN"
```

### Step 1.3: Grant AcrPull Permission to Managed Identity

```bash
# Get managed identity principal ID
IDENTITY_PRINCIPAL_ID=$(az identity show --name cdss-prod-identity --resource-group cdss-prod-rg --query principalId -o tsv)

# Get ACR resource ID
ACR_ID=$(az acr show --name cdssacr --resource-group cdss-prod-rg --query id -o tsv)

# Grant AcrPull role
az role assignment create \
  --role "AcrPull" \
  --assignee-object-id "$IDENTITY_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --scope "$ACR_ID"
```

### Step 1.4: Configure Key Vault Access for Container App

```bash
# Grant Key Vault Secrets User role to managed identity
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id "$IDENTITY_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --scope /subscriptions/35914a7e-ca5b-4df1-a613-603e700a7ce1/resourceGroups/cdss-prod-rg/providers/Microsoft.KeyVault/vaults/cdssprodkvjfv6ku4wuty3w

# Configure Key Vault to bypass Azure services
az keyvault update --name cdssprodkvjfv6ku4wuty3w --resource-group cdss-prod-rg --bypass AzureServices
```

---

## Phase 2: Container Image Build & Deploy

### Step 2.1: Login to Azure Container Registry

```bash
# Login to ACR
az acr login --name cdssacr
```

### Step 2.2: Build Docker Image

```bash
# Build for linux/amd64 platform (required for Azure Container Apps)
docker build --platform linux/amd64 -t cdssacr.azurecr.io/cdss-api:latest .
```

### Step 2.3: Push Image to ACR

```bash
docker push cdssacr.azurecr.io/cdss-api:latest
```

### Step 2.4: Configure ACR Authentication for Container App

```bash
# Get managed identity resource ID
MANAGED_IDENTITY_ID=$(az identity show --name cdss-prod-identity --resource-group cdss-prod-rg --query id -o tsv)

# Configure registry authentication
az containerapp registry set \
  --name cdss-prod-api \
  --resource-group cdss-prod-rg \
  --server cdssacr.azurecr.io \
  --identity "$MANAGED_IDENTITY_ID"
```

### Step 2.5: Update Container App with New Image

```bash
# Wait for RBAC propagation (if just created role assignment)
sleep 60

# Update container app with environment variables and image
az containerapp update \
  --name cdss-prod-api \
  --resource-group cdss-prod-rg \
  --image cdssacr.azurecr.io/cdss-api:latest
```

---

## Phase 3: Environment Configuration

### Step 3.1: Populate Local Environment Files

```bash
# Populate .env and .env.azure files from Azure resources
./infra/scripts/populate-env.sh cdss-prod-rg
```

**What this script does:**
- Fetches all Azure resource names and endpoints
- Attempts to retrieve API keys (may fail in network-isolated environments)
- Creates `.env` file with CDSS_* prefixed environment variables
- Creates `.env.azure` file for seeding scripts
- Enables Entra ID authentication when keys are unavailable

### Step 3.2: Verify Environment Variables

```bash
# Check key environment variables
grep -E "CDSS_AZURE_COSMOS_ENDPOINT|CDSS_AZURE_SEARCH_ENDPOINT|CDSS_AZURE_OPENAI_ENDPOINT" .env
```

### Step 3.3: Manual Environment Variable Fix (if needed)

If the Container App has wrong environment variable prefixes (AZURE_ instead of CDSS_), run:

```bash
az containerapp update \
  --name cdss-prod-api \
  --resource-group cdss-prod-rg \
  --image cdssacr.azurecr.io/cdss-api:latest \
  --set-env-vars \
    "CDSS_AZURE_OPENAI_ENDPOINT=https://cdssprodoaijfv6ku4wuty3w.openai.azure.com/" \
    "CDSS_AZURE_OPENAI_GPT4O_DEPLOYMENT=gpt-4o" \
    "CDSS_AZURE_OPENAI_GPT4O_MINI_DEPLOYMENT=gpt-4o-mini" \
    "CDSS_AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large" \
    "CDSS_AZURE_SEARCH_ENDPOINT=https://cdss-prod-search-jfv6ku4wuty3w.search.windows.net" \
    "CDSS_AZURE_COSMOS_ENDPOINT=https://cdssprodcosmosjfv6ku4wuty3w.documents.azure.com:443/" \
    "CDSS_AZURE_COSMOS_DATABASE=cdss-db" \
    "CDSS_AZURE_DOC_INTELLIGENCE_ENDPOINT=https://cdss-prod-docintel-jfv6ku4wuty3w.cognitiveservices.azure.com/" \
    "CDSS_AZURE_BLOB_ENDPOINT=https://cdssprodstjfv6ku4wuty3w.blob.core.windows.net/" \
    "CDSS_AZURE_BLOB_USE_ENTRA_ID=true" \
    "CDSS_DEBUG=false" \
    "CDSS_LOG_LEVEL=INFO"
```

---

## Phase 4: Verification

### Step 4.1: Verify Container App Status

```bash
# Check provisioning state
az containerapp show \
  --name cdss-prod-api \
  --resource-group cdss-prod-rg \
  --query "{name:name, provisioningState:properties.provisioningState, fqdn:properties.configuration.ingress.fqdn}" \
  -o table
```

### Step 4.2: Get Container App URL

```bash
CONTAINER_APP_URL=$(az containerapp show \
  --name cdss-prod-api \
  --resource-group cdss-prod-rg \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

echo "API URL: https://$CONTAINER_APP_URL"
```

### Step 4.3: Test Health Endpoint

```bash
# Test health endpoint (may take 1-2 minutes after update)
curl -s -o /dev/null -w "%{http_code}" "https://$CONTAINER_APP_URL/api/v1/health"

# Expected output: 200
```

### Step 4.4: View Application Logs

```bash
# Check application logs for errors
az containerapp logs show \
  --name cdss-prod-api \
  --resource-group cdss-prod-rg \
  --tail 50
```

### Step 4.5: Check Revision Status

```bash
# List all revisions
az containerapp revision list \
  --name cdss-prod-api \
  --resource-group cdss-prod-rg \
  --query "[].{name:name, active:properties.active, status:properties.runningState.status, trafficWeight:properties.trafficWeight}" \
  -o table
```

---

## Phase 5: Seed Sample Data (Optional)

### Step 5.1: Activate Virtual Environment

```bash
source .venv/bin/activate
```

### Step 5.2: Run Seed Script

```bash
# Seed data using Python script with Entra ID authentication
python infra/scripts/seed_data.py --environment prod
```

**Note:** This script uses `DefaultAzureCredential` which works with:
- `az login` for local development
- Managed Identity when running in Azure

---

## Phase 6: Test End-to-End

### Step 6.1: Test API Documentation

```bash
# Open API docs in browser
open "https://$CONTAINER_APP_URL/docs"
```

### Step 6.2: Test Clinical Query

```bash
# Submit a clinical query
curl -X POST "https://$CONTAINER_APP_URL/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What are the treatment options for a 65-year-old male with Type 2 Diabetes and CKD Stage 3?",
    "patient_id": "patient_12345"
  }'
```

---

## Troubleshooting Guide

### Issue: Container App Failed State

**Symptoms:**
- `provisioningState: Failed`
- No healthy revisions

**Solution:**
```bash
# 1. Check Key Vault secret access
az keyvault secret list --vault-name cdssprodkvjfv6ku4wuty3w -o tsv

# 2. Verify managed identity has Secrets User role
az role assignment list \
  --assignee $(az identity show --name cdss-prod-identity --resource-group cdss-prod-rg --query principalId -o tsv) \
  --scope /subscriptions/35914a7e-ca5b-4df1-a613-603e700a7ce1/resourceGroups/cdss-prod-rg/providers/Microsoft.KeyVault/vaults/cdssprodkvjfv6ku4wuty3w \
  -o table

# 3. Enable Key Vault public access temporarily
az keyvault update --name cdssprodkvjfv6ku4wuty3w --resource-group cdss-prod-rg --public-network-access Enabled

# 4. Add your IP to firewall
MY_IP=$(curl -s https://api.ipify.org)
az keyvault network-rule add --name cdssprodkvjfv6ku4wuty3w --ip-address "${MY_IP}/32"

# 5. Retry container app update
az containerapp update --name cdss-prod-api --resource-group cdss-prod-rg --image cdssacr.azurecr.io/cdss-api:latest
```

### Issue: ACR Authentication Failed

**Symptoms:**
- `UNAUTHORIZED: authentication required`

**Solution:**
```bash
# 1. Verify AcrPull role assignment
ACR_ID=$(az acr show --name cdssacr --resource-group cdss-prod-rg --query id -o tsv)
IDENTITY_PRINCIPAL_ID=$(az identity show --name cdss-prod-identity --resource-group cdss-prod-rg --query principalId -o tsv)

az role assignment create \
  --role "AcrPull" \
  --assignee-object-id "$IDENTITY_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --scope "$ACR_ID"

# 2. Wait for RBAC propagation
sleep 60

# 3. Configure container app registry
MANAGED_IDENTITY_ID=$(az identity show --name cdss-prod-identity --resource-group cdss-prod-rg --query id -o tsv)

az containerapp registry set \
  --name cdss-prod-api \
  --resource-group cdss-prod-rg \
  --server cdssacr.azurecr.io \
  --identity "$MANAGED_IDENTITY_ID"

# 4. Retry container app update
az containerapp update --name cdss-prod-api --resource-group cdss-prod-rg --image cdssacr.azurecr.io/cdss-api:latest
```

### Issue: Health Check Failing (404)

**Symptoms:**
- `/health` returns 404
- Container keeps restarting

**Root Cause:**
- Dockerfile health check uses `/health` but app uses `/api/v1/health`

**Solution:**
The Dockerfile has been fixed to use `/api/v1/health`. Rebuild and redeploy:

```bash
# Rebuild image
docker build --platform linux/amd64 -t cdssacr.azurecr.io/cdss-api:latest .

# Push to ACR
docker push cdssacr.azurecr.io/cdss-api:latest

# Update container app
az containerapp update --name cdss-prod-api --resource-group cdss-prod-rg --image cdssacr.azurecr.io/cdss-api:latest
```

### Issue: Environment Variables Not Working

**Symptoms:**
- CosmosClient initialization fails with "Invalid URL scheme"
- OpenAI endpoint is empty

**Root Cause:**
- Environment variables use `AZURE_` prefix but code expects `CDSS_` prefix

**Solution:**
See Step 3.3 for manual environment variable fix.

---

## Quick Reference: Resource Names

| Resource Type | Name Pattern | Example |
|--------------|-------------|---------|
| Resource Group | `cdss-prod-rg` | - |
| Container App | `cdss-prod-api` | `cdss-prod-api.livelycoast-1e8f2dc8.eastus2.azurecontainerapps.io` |
| Key Vault | `cdssprodkv<suffix>` | `cdssprodkvjfv6ku4wuty3w` |
| Cosmos DB | `cdssprodcosmos<suffix>` | `cdssprodcosmosjfv6ku4wuty3w` |
| AI Search | `cdss-prod-search-<suffix>` | `cdss-prod-search-jfv6ku4wuty3w` |
| OpenAI | `cdssprodoai<suffix>` | `cdssprodoaijfv6ku4wuty3w` |
| Redis | `cdss-prod-redis-<suffix>` | `cdss-prod-redis-jfv6ku4wuty3w` |
| Storage | `cdssprodst<suffix>` | `cdssprodstjfv6ku4wuty3w` |
| Managed Identity | `cdss-prod-identity` | - |
| Container Registry | `cdssacr` | `cdssacr.azurecr.io` |

---

## Architecture Notes

### Network Isolation (Production)

In production, the following services have public network access **disabled**:
- Key Vault
- Cosmos DB
- OpenAI
- AI Search
- Redis
- Document Intelligence
- Storage

This requires:
1. Service endpoints on VNet subnets for `Microsoft.Storage` and `Microsoft.KeyVault`
2. Private endpoints for data services
3. Managed identity for authentication
4. Entra ID (Azure AD) authentication instead of API keys

### Entra ID Authentication

The application supports Entra ID authentication for:
- **Cosmos DB**: Set `CDSS_AZURE_COSMOS_USE_ENTRA_ID=true`
- **Blob Storage**: Set `CDSS_AZURE_BLOB_USE_ENTRA_ID=true`
- **Key Vault**: Always uses Entra ID (no key-based auth)

When Entra ID is enabled, the application uses `DefaultAzureCredential` which supports:
- Visual Studio / VS Code authentication
- Azure CLI authentication (`az login`)
- Managed Identity (in Azure)
- Environment variables (service principal)

---

## Support

For issues not covered in this guide:
1. Check Azure Portal for resource health
2. Review Application Insights for application errors
3. Check Container App logs
4. Verify network connectivity and firewall rules
