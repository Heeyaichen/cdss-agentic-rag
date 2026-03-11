# CDSS Azure Deployment - End-to-End Validation Plan

## TL;DR

> **Goal**: Deploy, validate, and test the CDSS application on Azure after successful infrastructure provisioning via Bicep.

> **Deliverables**:
> - Containerized backend API deployed to Azure Container Apps
> - Frontend deployed to Azure Static Web Apps
> - Sample data seeded across Cosmos DB, Blob Storage, and Search indexes
> - End-to-end validation of clinical query flow

> **Estimated Effort**: Medium (3-4 hours for full deployment + validation)
> **Prerequisites**: Azure infrastructure already deployed via `./infra/scripts/deploy.sh dev cdss-prod-rg`

---

## Context

### Current State
- ✅ Azure infrastructure deployed via Bicep (Container Apps, Static Web Apps, Cosmos DB, AI Search, OpenAI, etc.)
- ✅ Dockerfile exists with multi-stage build for FastAPI
- ✅ Sample data files available in `sample_data/` directory
- ✅ Seed script exists at `infra/scripts/seed-data.sh`
- ⚠️ No CI/CD pipeline configured yet
- ⚠️ Container image not yet built/pushed
- ⚠️ Frontend not yet deployed

### Infrastructure Outputs (from Bicep)
The deployment should have created:
- **Container App URL**: Backend API endpoint (e.g., `https://cdss-dev-api.<region>.azurecontainerapps.io`)
- **Static Web App URL**: Frontend URL (e.g., `https://<app-name>.azurestaticapps.net`)
- **Cosmos DB Endpoint**: `https://<account>.documents.azure.com`
- **AI Search Endpoint**: `https://<service>.search.windows.net`
- **OpenAI Endpoint**: `https://<account>.openai.azure.com`
- **Managed Identity Client ID**: For Azure AD authentication

---

## Work Objectives

### Core Objective
Deploy the CDSS application to Azure and validate the complete data flow from frontend to backend to all Azure services.

### Concrete Deliverables
1. Docker image built and pushed to Azure Container Registry
2. Container App updated with new image
3. Frontend built and deployed to Static Web Apps
4. Sample data loaded into Cosmos DB and Blob Storage
5. Search indexes populated (via deployment script)
6. End-to-end clinical query tested successfully

### Definition of Done
- [ ] Backend API accessible at Container App URL with `/api/v1/health` returning 200 OK
- [ ] Frontend accessible  Static Web App URL
- [ ] Sample patient query returns clinical response with citations
- [ ] All services healthy and integrated

### Must Have
- Valid Azure credentials (subscription, resource group access)
- Docker installed locally for building images
- Node.js 18+ for frontend build
- Azure CLI authenticated (`az login`)

### Must NOT Have
- Direct localhost testing (this plan is for Azure deployment)
- Mock data (use real Azure services)
- Uncommitted secrets in code

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (deployed via Bicep)
- **Automated tests**: Tests-after approach
- **Primary verification**: Agent-Executed QA Scenarios (curl, browser testing)

### QA Policy
Every deployment step includes verification via Azure CLI commands and HTTP requests to deployed endpoints.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Configuration - IMMEDIATE):
├── Task 1: Populate .env files from Azure resources [quick]
├── Task 2: Verify Azure services are healthy [quick]
└── Task 3: Obtain deployment tokens [quick]

Wave 2 (Backend Build & Deploy - SEQUENTIAL):
├── Task 4: Build Docker image [unspecified-high]
├── Task 5: Push image to ACR [quick]
└── Task 6: Update Container App [quick]

Wave 3 (Frontend Build & Deploy - SEQUENTIAL):
├── Task 7: Build frontend [visual-engineering]
├── Task 8: Deploy to Static Web Apps [quick]

Wave 4 (Data Seeding - SEQUENTIAL):
├── Task 9: Seed Cosmos DB [quick]
├── Task 10: Upload protocols to Blob Storage [quick]
└── Task 11: Verify search indexes [quick]

Wave 5 (End-to-End Validation - PARALLEL):
├── Task 12: Test backend health endpoint [quick]
├── Task 13: Test clinical query API [quick]
├── Task 14: Test frontend accessibility [quick]
└── Task 15: Full E2E clinical query [deep]

Wave FINAL (Verification - 4 parallel):
├── Task F1: Infrastructure compliance audit (oracle)
├── Task F2: API endpoint validation (unspecified-high)
├── Task F3: Frontend integration test (unspecified-high)
└── Task F4: Security & CORS validation (deep)
```

### Agent Dispatch Summary
- **Wave 1**: 3 × quick
- **Wave 2**: 1 × unspecified-high, 2 × quick
- **Wave 3**: 1 × visual-engineering, 1 × quick
- **Wave 4**: 3 × quick
- **Wave 5**: 3 × quick, 1 × deep
- **FINAL**: 1 × oracle, 3 × unspecified-high/deep

---

## TODOs

---

## Wave 1: Configuration

- [ ] 1. Populate Environment Files from Azure Resources

  **What to do**:
  - Run `./infra/scripts/populate-env.sh cdss-prod-rg` to generate `.env` and `.env.azure` files
  - Verify all required environment variables are populated
  - Export the Container App URL and Static Web App URL for subsequent steps

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple script execution
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)

  **References**:
  - `infra/scripts/populate-env.sh` - Script to fetch Azure resource details and populate .env files
  - `.env.example` - Template showing required variables

  **Acceptance Criteria**:
  - [ ] File `.env` exists with all CDSS_* variables populated
  - [ ] File `.env.azure` exists with AZURE_* variables
  - [ ] No placeholder values remain (all keys have actual values)

  **QA Scenarios**:
  ```
  Scenario: Environment files are valid
    Tool: Bash
    Preconditions: Azure CLI authenticated
    Steps:
      1. Run ./infra/scripts/populate-env.sh cdss-prod-rg
      2. Check .env exists: test -f .env
      3. Check .env.azure exists: test -f .env.azure
      4. Verify CDSS_AZURE_OPENAI_ENDPOINT is not empty: grep -q "CDSS_AZURE_OPENAI_ENDPOINT=" .env
    Expected Result: Both files exist with non-empty values
    Failure Indicators: Files missing or contain placeholder values
    Evidence: .sisyphus/evidence/task-1-env-files.txt
  ```

- [ ] 2. Verify Azure Services Health

  **What to do**:
  - Check Cosmos DB account is accessible
  - Check AI Search service is running
  - Check Azure OpenAI account is provisioned
  - Check Container Apps environment is ready

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple Azure CLI health checks
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)

  **References**:
  - `infra/bicep/main.bicep` - Resource definitions for health check logic

  **Acceptance Criteria**:
  - [ ] Cosmos DB returns 200 OK from list command
  - [ ] AI Search service shows "running" state
  - [ ] OpenAI account shows "succeeded" provisioning state

  **QA Scenarios**:
  ```
  Scenario: All Azure services are healthy
    Tool: Bash
    Steps:
      1. az cosmosdb list -g cdss-prod-rg --query "[0].name" -o tsv
      2. az search service list -g cdss-prod-rg --query "[0].properties.replicaCount" -o tsv
      3. az cognitiveservices account list -g cdss-prod-rg --query "[?kind=='OpenAI'].properties.provisioningState" -o tsv
    Expected Result: All commands return valid values (not empty)
    Evidence: .sisyphus/evidence/task-2-azure-health.txt
  ```

- [ ] 3. Obtain Static Web App Deployment Token

  **What to do**:
  - Retrieve the deployment token for the Static Web App from Azure Portal or CLI
  - Store the token securely (environment variable or file)
  - Note the Static Web App name for deployment

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Token retrieval via Azure CLI
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)

  **References**:
  - `infra/bicep/main.bicep:1381-1411` - Static Web App resource definition
  - Azure Portal → Static Web App → Deployment Center → Tokens

  **Acceptance Criteria**:
  - [ ] Deployment token retrieved and stored
  - [ ] Static Web App name documented (e.g., `cdss-dev-frontend`)

  **QA Scenarios**:
  ```
  Scenario: Deployment token obtained
    Tool: Bash
    Steps:
      1. az staticwebapp list -g cdss-prod-rg --query "[0].name" -o tsv
      2. Export SWA_NAME=<name>
      3. Note: Token must to be retrieved from Azure Portal manually or via CLI
    Expected Result: SWA_NAME variable set
    Evidence: .sisyphus/evidence/task-3-swa-token.txt
  ```

---

## Wave 2: Backend Build & Deploy

- [ ] 4. Build Docker Image

  **What to do**:
  - Build the Docker image using the existing Dockerfile
  - Tag the image for Azure Container Registry
  - Verify the build succeeds without errors

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Docker build can take time and may need troubleshooting
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Wave 1)
  - **Parallel Group**: Wave 2 (sequential)

  **References**:
  - `Dockerfile` - Multi-stage build configuration
  - `pyproject.toml` - Python dependencies
  - `infra/bicep/main.bicep:23` - Container image parameter

  **Acceptance Criteria**:
  - [ ] Docker image built successfully: `docker build -t cdss-api:latest .`
  - [ ] Image tagged for ACR: `docker tag cdss-api:latest <acr-name>.azurecr.io/cdss-api:latest`
  - [ ] No build errors or warnings

  **QA Scenarios**:
  ```
  Scenario: Docker build succeeds
    Tool: Bash
    Preconditions: Docker daemon running
    Steps:
      1. docker build -t cdss-api:latest .
      2. docker images | grep cdss-api
    Expected Result: Image appears in docker images list
    Failure Indicators: Build fails, image not found
    Evidence: .sisyphus/evidence/task-4-docker-build.txt
  ```

- [ ] 5. Push Image to Azure Container Registry

  **What to do**:
  - Login to Azure Container Registry
  - Push the tagged Docker image
  - Verify the image appears in ACR

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard Docker push commands
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 4)
  - **Parallel Group**: Wave 2 (sequential)

  **References**:
  - `infra/bicep/main.bicep:23` - Container image reference (cdssacr.azurecr.io/cdss-api:latest)

  **Acceptance Criteria**:
  - [ ] ACR login successful: `az acr login --name <acr-name>`
  - [ ] Image pushed: `docker push <acr-name>.azurecr.io/cdss-api:latest`
  - [ ] Image visible in ACR: `az acr repository show -n <acr-name> --image cdss-api:latest`

  **QA Scenarios**:
  ```
  Scenario: Image pushed to ACR
    Tool: Bash
    Steps:
      1. az acr login --name cdssacr
      2. docker push cdssacr.azurecr.io/cdss-api:latest
      3. az acr repository show -n cdssacr --image cdss-api:latest
    Expected Result: Image manifest appears in ACR
    Evidence: .sisyphus/evidence/task-5-acr-push.txt
  ```

- [ ] 6. Update Container App with New Image

  **What to do**:
  - Update the Container App to use the new image
  - Wait for the revision to be ready
  - Verify the app starts successfully

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single az CLI command
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 5)
  - **Parallel Group**: Wave 2 (sequential)

  **References**:
  - `infra/bicep/main.bicep:1160-1375` - Container App configuration

  **Acceptance Criteria**:
  - [ ] Container App updated: `az containerapp update --name cdss-dev-api --resource-group cdss-prod-rg --image cdssacr.azurecr.io/cdss-api:latest`
  - [ ] Revision provisioning state: "Running"
  - [ ] App responds to health check

  **QA Scenarios**:
  ```
  Scenario: Container App running with new image
    Tool: Bash
    Steps:
      1. az containerapp update --name cdss-dev-api -g cdss-prod-rg --image cdssacr.azurecr.io/cdss-api:latest
      2. az containerapp revision list --name cdss-dev-api -g cdss-prod-rg --query "[0].properties.provisioningState" -o tsv
      3. curl -sS https://<container-app-url>/api/v1/health
    Expected Result: Health endpoint returns 200 OK
    Evidence: .sisyphus/evidence/task-6-container-app.txt
  ```

---

## Wave 3: Frontend Build & Deploy

- [ ] 7. Build Frontend

  **What to do**:
  - Install frontend dependencies
  - Configure API base URL to point to Container App
  - Build the production bundle
  - Verify dist directory exists with assets

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend build with configuration
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Frontend build and configuration

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Wave 2 for backend URL)
  - **Parallel Group**: Wave 3 (sequential)

  **References**:
  - `frontend/package.json:6-9` - Build scripts
  - `frontend/vite.config.ts:21-24` - Build output configuration
  - `frontend/.env.example` - Environment variable template

  **Acceptance Criteria**:
  - [ ] Dependencies installed: `cd frontend && npm ci`
  - [ ] API URL configured: `VITE_API_BASE_URL=https://<container-app-url>`
  - [ ] Build succeeds: `npm run build`
  - [ ] dist/ directory exists with index.html and assets

  **QA Scenarios**:
  ```
  Scenario: Frontend builds successfully
    Tool: Bash
    Preconditions: Node.js 18+ installed
    Steps:
      1. cd frontend && npm ci
      2. export VITE_API_BASE_URL=https://cdss-dev-api.eastus2.azurecontainerapps.io
      3. npm run build
      4. ls -la dist/
    Expected Result: dist/index.html and dist/assets/ exist
    Evidence: .sisyphus/evidence/task-7-frontend-build.txt
  ```

- [ ] 8. Deploy Frontend to Static Web Apps

  **What to do**:
  - Install Static Web Apps CLI if not present
  - Login to Azure via SWA CLI
  - Deploy the built frontend to Static Web Apps
  - Verify the deployment is live

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard CLI deployment
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 7)
  - **Parallel Group**: Wave 3 (sequential)

  **References**:
  - `infra/bicep/main.bicep:1381-1411` - Static Web App definition
  - Azure Portal → Static Web App → Deployment Center for token

  **Acceptance Criteria**:
  - [ ] SWA CLI installed: `npm i -g @azure/static-web-apps-cli`
  - [ ] Deployment successful: `swa deploy --app-location frontend --output-location dist --app-name <swa-name> --branch main --token <token>`
  - [ ] Frontend accessible at Static Web App URL

  **QA Scenarios**:
  ```
  Scenario: Frontend deployed and accessible
    Tool: Bash
    Steps:
      1. cd frontend && swa deploy --app-location . --output-location dist --app-name cdss-dev-frontend --branch main --token $SWA_TOKEN
      2. curl -sS https://<swa-url> | grep -q "CDSS"
    Expected Result: Frontend HTML returned
    Evidence: .sisyphus/evidence/task-8-swa-deploy.txt
  ```

---

## Wave 4: Data Seeding

- [ ] 9. Seed Cosmos DB with Sample Patient

  **What to do**:
  - Run the seed-data.sh script to upload sample patient profile
  - Verify the patient appears in Cosmos DB
  - Note the patient_id for testing (e.g., patient_12345)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Script execution
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Wave 1 for .env.azure)
  - **Parallel Group**: Wave 4 (sequential)

  **References**:
  - `infra/scripts/seed-data.sh` - Seed script
  - `sample_data/sample_patient.json` - Sample patient data
  - `infra/bicep/main.bicep:558-613` - Cosmos container definition

  **Acceptance Criteria**:
  - [ ] Seed script runs: `./infra/scripts/seed-data.sh dev`
  - [ ] Patient document exists in Cosmos DB
  - [ ] Patient ID documented: patient_12345

  **QA Scenarios**:
  ```
  Scenario: Patient data seeded in Cosmos DB
    Tool: Bash
    Steps:
      1. ./infra/scripts/seed-data.sh dev
      2. az cosmosdb sql container item show --account-name <cosmos-name> --database-name cdss-db --container-name patient-profiles --partition-key-value "patient_12345" --id patient_12345
    Expected Result: Patient document returned
    Evidence: .sisyphus/evidence/task-9-cosmos-seed.txt
  ```

- [ ] 10. Upload Protocols to Blob Storage

  **What to do**:
  - Upload sample protocol document (seed-data.sh handles this)
  - Verify the blob exists in treatment-protocols container
  - Upload sample lab report to staging-documents container

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Already handled by seed script
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (part of seed script)
  - **Parallel Group**: Wave 4 (sequential)

  **References**:
  - `sample_data/sample_protocol.md` - Sample protocol
  - `sample_data/sample_lab_report.txt` - Sample lab report
  - `infra/bicep/main.bicep:867-876` - Blob container definitions

  **Acceptance Criteria**:
  - [ ] Protocol blob exists: `az storage blob show --account-name <storage> --container-name treatment-protocols --name ENDO-DM-CKD-2025-v3.md`
  - [ ] Lab report blob exists in staging-documents

  **QA Scenarios**:
  ```
  Scenario: Protocols and lab reports uploaded
    Tool: Bash
    Steps:
      1. az storage blob show --account-name <storage> --container-name treatment-protocols --name ENDO-DM-CKD-2025-v3.md
      2. az storage blob show --account-name <storage> --container-name staging-documents --name lab_report_patient_12345_20260128.txt
    Expected Result: Both blobs exist
    Evidence: .sisyphus/evidence/task-10-blob-upload.txt
  ```

- [ ] 11. Verify Azure AI Search Indexes

  **What to do**:
  - Check that search indexes were created by the deployment script
  - Verify index schemas match expected structure
  - Test a simple search query against the indexes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification commands
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on infrastructure)
  - **Parallel Group**: Wave 4 (sequential)

  **References**:
  - `infra/bicep/main.bicep:1421-1595` - Search index creation deployment script
  - `src/cdss/rag/retriever.py` - Search index usage

  **Acceptance Criteria**:
  - [ ] patient-records index exists
  - [ ] treatment-protocols index exists
  - [ ] medical-literature-cache index exists

  **QA Scenarios**:
  ```
  Scenario: Search indexes exist
    Tool: Bash
    Steps:
      1. az search service show -g cdss-prod-rg --name <search-name>
      2. curl -sS -H "api-key: <search-key>" "https://<search-name>.search.windows.net/indexes?api-version=2024-05-01-preview"
    Expected Result: List of indexes includes expected names
    Evidence: .sisyphus/evidence/task-11-search-indexes.txt
  ```

---

## Wave 5: End-to-End Validation

- [ ] 12. Test Backend Health Endpoint

  **What to do**:
  - Call the health check endpoint on the deployed Container App
  - Verify the response shows healthy status
  - Check all dependency statuses

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple curl command
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 13, 14, 15)

  **References**:
  - `src/cdss/api/routes.py:978-996` - Health check endpoint
  - `infra/bicep/main.bicep:1319-1356` - Container health probes

  **Acceptance Criteria**:
  - [ ] Health endpoint returns 200: `curl https://<container-app-url>/api/v1/health`
  - [ ] Response contains "status": "healthy"
  - [ ] Response contains service version

  **QA Scenarios**:
  ```
  Scenario: Health endpoint is healthy
    Tool: Bash
    Steps:
      1. curl -sS https://cdss-dev-api.eastus2.azurecontainerapps.io/api/v1/health
      2. Verify JSON response contains "status": "healthy"
    Expected Result: 200 OK with healthy status
    Failure Indicators: Non-200 status, missing fields
    Evidence: .sisyphus/evidence/task-12-health-check.txt
  ```

- [ ] 13. Test Clinical Query API

  **What to do**:
  - Submit a test clinical query via the query endpoint
  - Verify the response contains assessment, recommendation, citations
  - Check that agent outputs are present

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: API testing via curl
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 12, 14, 15)

  **References**:
  - `src/cdss/api/routes.py:174-219` - Clinical query endpoint
  - `sample_data/sample_query.json` - Sample query payload
  - `sample_data/sample_response.json` - Expected response structure

  **Acceptance Criteria**:
  - [ ] Query accepted: `POST /api/v1/query` with sample query
  - [ ] Response contains "assessment", "recommendation", "confidence_score"
  - [ ] Response time < 30 seconds

  **QA Scenarios**:
  ```
  Scenario: Clinical query returns valid response
    Tool: Bash
    Steps:
      1. curl -X POST https://cdss-dev-api.eastus2.azurecontainerapps.io/api/v1/query \
         -H "Content-Type: application/json" \
         -d '{"text": "What are the recommended treatment options for type 2 diabetes with CKD?", "patient_id": "patient_12345"}'
      2. Verify response contains "assessment", "recommendation", "confidence_score"
    Expected Result: Valid clinical response with all required fields
    Evidence: .sisyphus/evidence/task-13-query-api.txt
  ```

- [ ] 14. Test Frontend Accessibility

  **What to do**:
  - Access the deployed Static Web App URL
  - Verify the frontend loads without errors
  - Check that API calls are configured correctly

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple HTTP verification
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 12, 13, 15)

  **References**:
  - `frontend/src/App.tsx` - Main app component
  - `frontend/vite.config.ts` - Vite configuration

  **Acceptance Criteria**:
  - [ ] Frontend URL returns 200: `curl https://<swa-url>`
  - [ ] HTML contains React root element
  - [ ] No JavaScript errors on load

  **QA Scenarios**:
  ```
  Scenario: Frontend loads successfully
    Tool: Bash
    Steps:
      1. curl -sS https://<swa-url> | grep -q "root"
      2. curl -sS https://<swa-url> | grep -q "CDSS"
    Expected Result: HTML contains root element and app title
    Evidence: .sisyphus/evidence/task-14-frontend-access.txt
  ```

- [ ] 15. Full End-to-End Clinical Query

  **What to do**:
  - Access the frontend in a browser or via Playwright
  - Submit a clinical query through the UI
  - Verify the complete flow: Frontend → API → Azure Services → Response
  - Check that the response displays correctly in the UI

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex E2E validation requiring multiple service integration
  - **Skills**: [`playwright`]
    - `playwright`: Browser automation for UI testing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 12, 13, 14)

  **References**:
  - `frontend/src/pages/QueryPage.tsx` - Query submission UI
  - `sample_data/sample_query.json` - Sample query text
  - `sample_data/sample_response.json` - Expected response structure

  **Acceptance Criteria**:
  - [ ] Frontend query submission succeeds
  - [ ] Backend processes query with all agents
  - [ ] Response displays assessment and recommendation
  - [ ] Citations and drug alerts visible
  - [ ] Total flow time < 60 seconds

  **QA Scenarios**:
  ```
  Scenario: E2E clinical query from frontend to backend
    Tool: Playwright
    Preconditions: Frontend and backend deployed and accessible
    Steps:
      1. Navigate to https://<swa-url>
      2. Enter query: "What are the recommended treatment options for type 2 diabetes with CKD?"
      3. Select patient: patient_12345
      4. Submit query
      5. Wait for response (max 60s)
      6. Verify assessment section appears
      7. Verify recommendation section appears
      8. Verify citations are listed
    Expected Result: Full clinical response displayed in UI
    Failure Indicators: Timeout, missing sections, API errors
    Evidence: .sisyphus/evidence/task-15-e2e-query.png (screenshot)
  ```

---

## Final Verification Wave

- [ ] F1. Infrastructure Compliance Audit

  **What to do**:
  - Verify all resources match Bicep definitions
  - Check all environment variables are properly configured
  - Validate managed identity permissions

  **Recommended Agent Profile**:
  - **Category**: `oracle`
    - Reason: Architecture-level compliance review
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Final Wave (with F2, F3, F4)

- [ ] F2. API Endpoint Validation

  **What to do**:
  - Test all API endpoints documented in routes.py
  - Verify OpenAPI documentation is accessible
  - Check rate limiting and CORS headers

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive API testing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Final Wave (with F1, F3, F4)

- [ ] F3. Frontend Integration Test

  **What to do**:
  - Test frontend API integration
  - Verify authentication flow (if configured)
  - Check error handling and loading states

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Frontend integration testing
  - **Skills**: [`playwright`, `frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Final Wave (with F1, F2, F4)

- [ ] F4. Security & CORS Validation

  **What to do**:
  - Verify CORS configuration allows frontend origin
  - Check that secrets are not exposed in logs
  - Validate HTTPS enforcement

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Security validation requires deep analysis
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Final Wave (with F1, F2, F3)

---

## Commit Strategy

- **Wave 1**: `infra: configuration and env setup`
- **Wave 2**: `backend: container build and deploy`
- **Wave 3**: `frontend: build and static web app deploy`
- **Wave 4**: `data: cosmos and blob seeding`
- **Wave 5**: `validation: health and e2e tests`
- **Final**: `verification: compliance and security audit`

---

## Success Criteria

### Verification Commands
```bash
# Backend health
curl https://<container-app-url>/api/v1/health

# Frontend accessibility
curl https://<swa-url>

# Clinical query
curl -X POST https://<container-app-url>/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"text": "What are treatment options for type 2 diabetes with CKD?"}'
```

### Final Checklist
- [ ] Backend API responds to health checks
- [ ] Frontend loads in browser
- [ ] Clinical queries return valid responses
- [ ] All Azure services integrated
- [ ] Sample data queryable
- [ ] No security misconfigurations
