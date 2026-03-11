# CDSS Azure Deployment Research Findings

## Requirements (Confirmed)

### User's Goal
Deploy, validate, and test the CDSS application on Azure after successful infrastructure provisioning via `./infra/scripts/deploy.sh dev cdss-prod-rg`.

### Scope
- **IN**: Backend API deployment to Container Apps, Frontend deployment to Static Web Apps, data seeding, end-to-end validation
- **OUT**: Localhost testing (this is for Azure deployment only), CI/CD pipeline setup (future work)

---

## Research Findings

### 1. Container Apps Deployment

**Key Files Discovered:**
- `/Dockerfile` - Multi-stage Docker build for FastAPI app (builder + runtime)
- `/infra/scripts/deploy.sh` - Infrastructure deployment via Bicep, outputs Container App URL
- `/infra/scripts/populate-env.sh` - Auto-generates .env files from Azure resources
- `/infra/bicep/main.bicep:1160-1375` - Container App configuration with health probes

**Deployment Workflow:**
1. Build Docker image: `docker build -t cdss-api:latest .`
2. Login to ACR: `az acr login --name <acr-name>`
3. Tag and push: `docker tag cdss-api:latest <acr-name>.azurecr.io/cdss-api:latest && docker push`
4. Update Container App: `az containerapp update --name cdss-dev-api --image <acr-name>.azurecr.io/cdss-api:latest`

**Current State:**
- Dockerfile exists with production-ready configuration
- ACR referenced in Bicep as `cdssacr.azurecr.io`
- Container App parameter: `containerImage` defaults to `cdssacr.azurecr.io/cdss-api:latest`
- No CI/CD pipeline configured (manual deployment)

### 2. Static Web Apps Deployment

**Key Files Discovered:**
- `/frontend/package.json` - Build script: `tsc -b && vite build`
- `/frontend/vite.config.ts` - Output directory: `dist`
- `/infra/bicep/main.bicep:1381-1411` - Static Web App resource definition
- `repositoryUrl: ''` - Configured for manual CLI deployment (no Git integration)

**Deployment Workflow:**
1. Install SWA CLI: `npm i -g @azure/static-web-apps-cli`
2. Build frontend: `cd frontend && npm ci && npm run build`
3. Deploy: `swa deploy --app-location frontend --output-location dist --app-name <swa-name> --branch main --token <token>`

**Current State:**
- Frontend configured for Vite + TypeScript
- Build output: `frontend/dist`
- Manual deployment via SWA CLI (not GitHub Actions)
- Need to retrieve deployment token from Azure Portal

### 3. Data Seeding

**Key Files Discovered:**
- `/infra/scripts/seed-data.sh` - Seeds patient data to Cosmos DB, protocols to Blob Storage
- `/sample_data/sample_patient.json` - Patient profile (patient_12345)
- `/sample_data/sample_protocol.md` - Treatment protocol (ENDO-DM-CKD-2025-v3)
- `/sample_data/sample_lab_report.txt` - Sample lab report
- `/infra/bicep/main.bicep:558-801` - Cosmos DB containers and Blob storage

**Seeding Workflow:**
1. Run populate-env.sh to create `.env.azure`
2. Execute seed-data.sh: `./infra/scripts/seed-data.sh dev`
3. Seeds: Patient profile → Cosmos DB, Protocol → Blob Storage, Lab report → staging container

**Current State:**
- Seed script exists and is functional
- Requires `.env.azure` file with Cosmos DB endpoint
- Does NOT seed AI Search indexes (deployment script handles that)

### 4. Validation & Testing

**Key Files Discovered:**
- `/src/cdss/api/routes.py:978-996` - Health check endpoint at `/api/v1/health`
- `/tests/integration/test_e2e.py` - End-to-end integration tests with mocks
- `/tests/conftest.py` - Test fixtures for Azure service mocks
- `/infra/bicep/main.bicep:1319-1356` - Container health probes

**Health Check Endpoints:**
- `/api/v1/health` - API health check (returns status, version, timestamp)
- `/health` - Container liveness probe (port 8000)
- `/health/ready` - Container readiness probe

**Testing Strategy:**
- Unit tests: `pytest tests/unit/`
- Integration tests: `pytest tests/integration/`
- E2E validation: Use existing test suite + manual verification

**Current State:**
- Comprehensive test suite exists
- Health endpoints implemented
- No Azure AD authentication wired yet (has `AuthenticationError` exception but no OAuth2 middleware)

### 5. Infrastructure Outputs

From Bicep template, the deployment should output:
- `cosmosEndpoint` - Cosmos DB endpoint
- `searchEndpoint` - AI Search endpoint
- `openaiEndpoint` - Azure OpenAI endpoint
- `containerAppUrl` - Backend API URL
- `staticWebAppUrl` - Frontend URL
- `managedIdentityClientId` - For Azure AD integration

---

## Technical Decisions

### Decision 1: Manual CLI Deployment (vs CI/CD)
**Rationale**: No GitHub Actions workflow exists in the repo. The Bicep template has `repositoryUrl: ''` indicating manual deployment is intended. CI/CD can be added later.

### Decision 2: Docker Build Locally (vs ACR Tasks)
**Rationale**: Dockerfile is ready for local builds. ACR Tasks would require additional setup. Local build + push is faster for initial deployment.

### Decision 3: SWA CLI Deployment (vs GitHub Actions)
**Rationale**: Static Web Apps configured with `provider: 'None'` for manual deployment. SWA CLI is the standard approach for manual deploys.

### Decision 4: Use Existing seed-data.sh (vs custom seeding)
**Rationale**: Seed script already exists and handles Cosmos DB + Blob Storage. No need to create new seeding mechanism.

---

## Open Questions

### Question 1: Azure AD Authentication
The codebase has `AuthenticationError` but no OAuth2/OpenID Connect middleware. Is authentication required for this deployment, or should it be added in a follow-up?

### Question 2: Environment-Specific Configuration
Should we deploy to `dev` environment only, or also prepare for `staging`/`prod` as part of this plan?

### Question 3: Monitoring Alerts
Infrastructure includes Application Insights and Log Analytics. Should we configure alert rules as part of this deployment, or is that handled separately?

---

## Scope Boundaries

### INCLUDE:
- Backend container build and deploy to Container Apps
- Frontend build and deploy to Static Web Apps
- Data seeding (Cosmos DB, Blob Storage)
- Search index verification
- End-to-end clinical query validation
- Health endpoint verification

### EXCLUDE:
- Localhost testing (this is for Azure deployment)
- CI/CD pipeline setup
- Azure AD authentication implementation
- Production-grade monitoring/alerting configuration
- Multi-environment deployment (dev only for this plan)
