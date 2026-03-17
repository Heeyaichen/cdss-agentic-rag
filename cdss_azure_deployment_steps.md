# CDSS Azure Deployment Runbook (First-Run Safe)

This runbook is the canonical deployment flow for new environments.
It replaces older manual command sequences that required repeated troubleshooting.

## Prerequisites

- Azure CLI logged in: `az login`
- Docker Desktop running
- Buildx available: `docker buildx version`
- Azure subscription with permission to create resource groups, ACR, Container Apps, OpenAI, Search, Cosmos, Key Vault

## 1) One-command bootstrap deploy

```bash
# Example: production
./infra/scripts/bootstrap-deploy.sh prod cdss-prod-rg eastus2
```

What this command now automates:

- creates resource group if missing
- creates/uses ACR
- builds and pushes `linux/amd64` backend image
- deploys Bicep infra + Container App
- retries transient Cognitive provisioning race conditions (`Accepted` state)
- bootstraps Search indexes (temporary public enable/disable)
- generates local `.env` and `.env.azure`

By default, bootstrap deploys prod with public API ingress to simplify browser-based validation.
To keep ingress private:

```bash
PROD_PUBLIC_API=false ./infra/scripts/bootstrap-deploy.sh prod cdss-prod-rg eastus2
```

Optional environment flags:

```bash
# Use a pre-pushed image
CONTAINER_IMAGE=<acr>.azurecr.io/cdss-api:<tag> SKIP_IMAGE_BUILD=true \
./infra/scripts/bootstrap-deploy.sh prod cdss-prod-rg eastus2

# Also run Entra SPA auth setup during bootstrap
SKIP_AUTH_SETUP=false ./infra/scripts/bootstrap-deploy.sh prod cdss-prod-rg eastus2
```

## 2) Verify backend deployment

```bash
RG=cdss-prod-rg
APP=$(az containerapp list -g "$RG" --query "[?contains(name,'-api')].name | [0]" -o tsv)
API_FQDN=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)

az containerapp show -g "$RG" -n "$APP" \
  --query "{state:properties.provisioningState,fqdn:properties.configuration.ingress.fqdn}" -o table

curl -s -o /dev/null -w "%{http_code}\n" "https://$API_FQDN/api/v1/health"
```

Expected health status code: `200`

## 3) Configure Entra SPA auth + frontend env

```bash
./infra/scripts/setup-entra-spa-auth.sh --resource-group "$RG" --container-app-name "$APP"
```

What this script automates:

- SPA app discovery/creation
- localhost redirect URI setup (`3000`/`3001`)
- API app discovery/creation and scope setup
- delegated permission and admin consent attempt
- backend audience alignment (`CDSS_AUTH_AUDIENCE`)
- `frontend/.env.local` generation

## 4) Seed sample data from inside Azure network

```bash
./infra/scripts/seed-data-infra-network.sh "$RG" "$APP"
```

This now executes a short in-container module (`python -m cdss.tools.seed_sample_data`) to avoid the Azure CLI websocket `414 URI Too Long` issue.

## 5) Allow local frontend origins (for browser testing)

```bash
az containerapp ingress cors update -g "$RG" -n "$APP" \
  --allowed-origins http://localhost:3000 https://localhost:3000 http://localhost:3001 https://localhost:3001
```

## 6) Run frontend locally against deployed backend

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:3000`

## 7) Common issues and built-in fixes

- `ResourceGroupNotFound` before ACR create:
  - fixed by bootstrap order (`RG -> ACR -> image -> deploy`).
- `AccountProvisioningStateInvalid` (OpenAI/DocIntel in `Accepted`):
  - fixed by automatic retry/wait logic in `deploy.sh`.
- Container image pull errors (`manifest not found`, wrong architecture):
  - fixed by buildx `linux/amd64` build + ACR tag verification in bootstrap.
- Search index bootstrap blocked by private networking:
  - fixed by temporary public toggle handled in bootstrap.
- `seed-data-infra-network.sh` websocket `414 URI Too Long`:
  - fixed by short module-based exec command.

## Notes

- Vite dev server is intentionally configured to run on port `3000`.
- Prefer `README.md` and this runbook over older ad-hoc command lists.
