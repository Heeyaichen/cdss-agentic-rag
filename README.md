# CDSS Production Runbook

## 1) Initialize deployment variables

```bash 
export ENV=prod
export RG=cdss-prod-rg
export LOCATION=eastus2
export SWA_NAME=cdss-frontend-prod
export SPA_APP_DISPLAY_NAME=cdss-frontend-spa
export API_APP_DISPLAY_NAME=cdss-api
export SCOPE_NAME=access_as_user
```

## 2) Verify prerequisites and Azure context

```bash
command -v az
command -v docker
command -v jq
command -v python3
command -v npm

az login
az account show -o table
```

## 3) Set PubMed credentials (before first deploy)

```bash
# Option A: enter values interactively
read -r -s -p "PubMed API key: " CDSS_PUBMED_API_KEY; echo
read -r -p "PubMed contact email: " CDSS_PUBMED_EMAIL
export CDSS_PUBMED_API_KEY CDSS_PUBMED_EMAIL

# Option B: if values already exist in local .env, load them directly
# export CDSS_PUBMED_API_KEY="$(grep -E '^CDSS_PUBMED_API_KEY=' .env | cut -d= -f2-)"
# export CDSS_PUBMED_EMAIL="$(grep -E '^CDSS_PUBMED_EMAIL=' .env | cut -d= -f2-)"

# Verify values are set (prints only the email)
test -n "$CDSS_PUBMED_API_KEY" && test -n "$CDSS_PUBMED_EMAIL" && echo "PubMed vars loaded: $CDSS_PUBMED_EMAIL"
```

## 4) Deploy backend infrastructure and backend application

```bash
CDSS_PUBMED_API_KEY="$CDSS_PUBMED_API_KEY" \
CDSS_PUBMED_EMAIL="$CDSS_PUBMED_EMAIL" \
./infra/scripts/bootstrap-deploy.sh "$ENV" "$RG" "$LOCATION"
```

## 5) Resolve deployed resource names

```bash
export APP=$(az containerapp list -g "$RG" --query "[?contains(name,'-api')].name | [0]" -o tsv)
export API_FQDN=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)
export SEARCH_NAME=$(az search service list -g "$RG" --query "[0].name" -o tsv)
export OPENAI_NAME=$(az cognitiveservices account list -g "$RG" --query "[?kind=='OpenAI'].name | [0]" -o tsv)
export DOCINTEL_NAME=$(az cognitiveservices account list -g "$RG" --query "[?kind=='FormRecognizer'].name | [0]" -o tsv)

printf "APP=%s\nAPI_FQDN=%s\nSEARCH_NAME=%s\nOPENAI_NAME=%s\nDOCINTEL_NAME=%s\n" \
  "$APP" "$API_FQDN" "$SEARCH_NAME" "$OPENAI_NAME" "$DOCINTEL_NAME"
```

## 6) Validate backend readiness

```bash
curl -i "https://${API_FQDN}/api/v1/health"

az cognitiveservices account show -g "$RG" -n "$OPENAI_NAME" \
  --query "{state:properties.provisioningState,pna:properties.publicNetworkAccess}" -o table

az cognitiveservices account show -g "$RG" -n "$DOCINTEL_NAME" \
  --query "{state:properties.provisioningState,pna:properties.publicNetworkAccess}" -o table

az search service show -g "$RG" -n "$SEARCH_NAME" \
  --query "{state:provisioningState,pna:publicNetworkAccess}" -o table

az containerapp show -g "$RG" -n "$APP" \
  --query "properties.template.containers[0].env[?name=='CDSS_AUTH_ENABLED'||name=='CDSS_AUTH_TENANT_ID'||name=='CDSS_AUTH_AUDIENCE'||name=='CDSS_AUTH_REQUIRED_SCOPES'].[name,value]" \
  -o table
```

## 7) Ensure Azure AI Search indexes exist (only if bootstrap did not finish index bootstrap)
# requires: RG is already exported

```bash
SEARCH_NAME="${SEARCH_NAME:-$(az search service list -g "$RG" --query "[0].name" -o tsv)}"
ORIG_PNA="$(az search service show -g "$RG" -n "$SEARCH_NAME" --query publicNetworkAccess -o tsv)"

if [[ "$ORIG_PNA" != "Enabled" ]]; then
  az search service update -g "$RG" -n "$SEARCH_NAME" --public-network-access enabled
fi

./infra/scripts/create-search-indexes.sh "$RG" "$SEARCH_NAME"

if [[ "$ORIG_PNA" != "Enabled" ]]; then
  az search service update -g "$RG" -n "$SEARCH_NAME" --public-network-access disabled
fi
```

<!-- ```bash
SEARCH_ADMIN_KEY=$(az search admin-key show --service-name "$SEARCH_NAME" --resource-group "$RG" --query primaryKey -o tsv)
EXPECTED_INDEXES=("patient-records" "treatment-protocols" "medical-literature-cache")

CURRENT_INDEXES=$(AZURE_CORE_ONLY_SHOW_ERRORS=1 az rest \
  --method get \
  --url "https://${SEARCH_NAME}.search.windows.net/indexes?api-version=2024-05-01-preview" \
  --skip-authorization-header \
  --headers "api-key=${SEARCH_ADMIN_KEY}" \
  --query "value[].name" -o tsv || true)

MISSING=()
for idx in "${EXPECTED_INDEXES[@]}"; do
  if ! grep -qx "$idx" <<<"$CURRENT_INDEXES"; then
    MISSING+=("$idx")
  fi
done

if [[ ${#MISSING[@]} -eq 0 ]]; then
  echo "All required Search indexes already exist."
else
  echo "Missing indexes: ${MISSING[*]}"

  wait_search() {
    local expected_pna="$1"
    while true; do
      S=$(az search service show -g "$RG" -n "$SEARCH_NAME" --query provisioningState -o tsv)
      P=$(az search service show -g "$RG" -n "$SEARCH_NAME" --query publicNetworkAccess -o tsv)
      echo "state=$S pna=$P"
      [[ "$S" == "succeeded" && "$P" == "$expected_pna" ]] && break
      sleep 15
    done
  }

  ORIG_PNA=$(az search service show -g "$RG" -n "$SEARCH_NAME" --query publicNetworkAccess -o tsv)
  if [[ "$ORIG_PNA" != "Enabled" ]]; then
    az search service update -g "$RG" -n "$SEARCH_NAME" --public-network-access enabled
    wait_search "Enabled"
  fi

  ./infra/scripts/create-search-indexes.sh "$RG" "$SEARCH_NAME"

  if [[ "$ORIG_PNA" != "Enabled" ]]; then
    az search service update -g "$RG" -n "$SEARCH_NAME" --public-network-access disabled
    wait_search "Disabled"
  fi
fi
``` -->

## 8) Generate local environment files and seed sample data

```bash
./infra/scripts/populate-env.sh "$RG"
./infra/scripts/seed-data-infra-network.sh "$RG" "$APP"
```

## 9) Configure Entra SPA/API auth and backend audience alignment

```bash
./infra/scripts/setup-entra-spa-auth.sh \
  --resource-group "$RG" \
  --container-app-name "$APP" \
  --spa-app-display-name "$SPA_APP_DISPLAY_NAME" \
  --api-app-display-name "$API_APP_DISPLAY_NAME"
```

## 10) Configure PubMed credentials in deployed backend runtime (fallback/manual rerun)

```bash
# read -r -s -p "PubMed API key: " CDSS_PUBMED_API_KEY; echo
# read -r -p "PubMed contact email: " CDSS_PUBMED_EMAIL
# export CDSS_PUBMED_API_KEY CDSS_PUBMED_EMAIL

# ./infra/scripts/configure-pubmed-prod.sh "$RG" "$APP"

az containerapp show -g "$RG" -n "$APP" \
  --query "properties.template.containers[0].env[?name=='CDSS_PUBMED_API_KEY'||name=='CDSS_PUBMED_EMAIL'||name=='CDSS_PUBMED_BASE_URL'].{name:name,secretRef:secretRef,value:value}" \
  -o table
```

## 11) Ensure Static Web App exists and fetch deployment values

```bash
az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" >/dev/null 2>&1 || \
az staticwebapp create --name "$SWA_NAME" --resource-group "$RG" --location "$LOCATION" --sku Standard

export SWA_HOST=$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" --query defaultHostname -o tsv)
export SWA_TOKEN=$(az staticwebapp secrets list --name "$SWA_NAME" --resource-group "$RG" --query properties.apiKey -o tsv)
echo "$SWA_HOST"
```

## 12) Set production-only redirect URIs for the SPA app

```bash
export SPA_CLIENT_ID=$(az ad app list --display-name "$SPA_APP_DISPLAY_NAME" --query "[0].appId" -o tsv)
export SPA_OBJECT_ID=$(az ad app show --id "$SPA_CLIENT_ID" --query id -o tsv)

az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/${SPA_OBJECT_ID}" \
  --headers "Content-Type=application/json" \
  --body "{\"spa\":{\"redirectUris\":[\"https://${SWA_HOST}\",\"https://${SWA_HOST}/auth/callback\"]}}"
```

## 13) Configure backend CORS for the production frontend origin

```bash
az containerapp ingress cors update -g "$RG" -n "$APP" \
  --allowed-origins "https://${SWA_HOST}"
```

## 14) Create frontend production environment file

```bash
export TENANT_ID=$(az account show --query tenantId -o tsv)
export API_AUDIENCE=$(az containerapp show -g "$RG" -n "$APP" --query "properties.template.containers[0].env[?name=='CDSS_AUTH_AUDIENCE'].value | [0]" -o tsv)
export API_SCOPE="${API_AUDIENCE}/${SCOPE_NAME}"
export WEBPUBSUB_NAME=$(az resource list -g "$RG" --resource-type "Microsoft.SignalRService/webPubSub" --query "[0].name" -o tsv)
if [[ -n "$WEBPUBSUB_NAME" ]]; then
  export VITE_WS_ENDPOINT_VALUE="wss://${WEBPUBSUB_NAME}.webpubsub.azure.com"
else
  export VITE_WS_ENDPOINT_VALUE="wss://${API_FQDN}"
fi

cat > frontend/.env.production <<EOF
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=https://${API_FQDN}/api
VITE_AZURE_CLIENT_ID=${SPA_CLIENT_ID}
VITE_AZURE_TENANT_ID=${TENANT_ID}
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/${TENANT_ID}
VITE_API_SCOPE=${API_SCOPE}
VITE_REDIRECT_URI=https://${SWA_HOST}
VITE_POST_LOGOUT_URI=https://${SWA_HOST}
VITE_WS_ENDPOINT=${VITE_WS_ENDPOINT_VALUE}
VITE_ENVIRONMENT=production
EOF
```

## 15) Build and deploy frontend to Azure Static Web Apps

```bash
cd frontend
npm ci
npm run build
cp staticwebapp.config.json dist/staticwebapp.config.json
grep -R "localhost" dist/ && exit 1 || true
npx @azure/static-web-apps-cli deploy ./dist --deployment-token "$SWA_TOKEN" --env production
cd ..
```

## 16) Validate authentication and backend APIs with bearer token

```bash
export TOKEN=$(az account get-access-token --scope "$API_SCOPE" --query accessToken -o tsv)

curl -i -H "Authorization: Bearer $TOKEN" \
  "https://${API_FQDN}/api/v1/patients?search=P0&page=1&limit=10"

curl -i -N \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"text":"Summarize care priorities for patient_12345"}' \
  "https://${API_FQDN}/api/v1/query/stream"
```

## 17) Validate document ingestion and retrieval APIs

```bash
export DOC_ID=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample_data/sample_lab_report.txt;type=text/plain" \
  -F "document_type=lab_report" \
  "https://${API_FQDN}/api/v1/documents/ingest" | jq -r '.document_id')

curl -s -H "Authorization: Bearer $TOKEN" \
  "https://${API_FQDN}/api/v1/documents/${DOC_ID}/status" | jq

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"type 2 diabetes CKD stage 3","max_results":5}' \
  "https://${API_FQDN}/api/v1/search/literature" | jq

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"hypertension protocol","max_results":5}' \
  "https://${API_FQDN}/api/v1/search/protocols" | jq
```

## 18) Validate production frontend end-to-end in browser

```bash
curl -I "https://${SWA_HOST}"
echo "https://${SWA_HOST}"
```

1. Open `https://${SWA_HOST}`.
2. Sign in with Entra ID.
3. Load patient list.
4. Run Clinical Workspace orchestration query.
5. Verify streaming response updates in UI.
6. Upload a document and verify completion.
7. Run literature and protocol searches.

## 19) Final production checks

```bash
az containerapp show -g "$RG" -n "$APP" \
  --query "properties.template.containers[0].env[?name=='CDSS_AUTH_ENABLED'||name=='CDSS_AUTH_AUDIENCE'||name=='CDSS_AUTH_REQUIRED_SCOPES'].[name,value]" \
  -o table

az containerapp ingress cors show -g "$RG" -n "$APP" -o json

curl -i -X OPTIONS \
  -H "Origin: https://${SWA_HOST}" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization,Content-Type" \
  "https://${API_FQDN}/api/v1/query/stream"

az containerapp revision list -g "$RG" -n "$APP" -o table
```

## 20) Authentication Troubleshooting

If you encounter **401 Unauthorized** errors with "Invalid or expired bearer token":

### Quick Diagnosis

```bash
# Check current auth configuration
az containerapp show -g "$RG" -n "$APP" \
  --query "properties.template.containers[0].env[?name=='CDSS_AUTH_ENABLED'||name=='CDSS_AUTH_TENANT_ID'||name=='CDSS_AUTH_AUDIENCE'||name=='CDSS_AUTH_REQUIRED_SCOPES'].[name,value]" \
  -o table

# Expected values:
# CDSS_AUTH_ENABLED        true
# CDSS_AUTH_TENANT_ID      <your-tenant-id>
# CDSS_AUTH_AUDIENCE       api://cdss-api
# CDSS_AUTH_REQUIRED_SCOPES ["access_as_user"]
```

### Root Cause: Audience Mismatch

The 401 error typically occurs when `CDSS_AUTH_AUDIENCE` is empty or doesn't match the token's `aud` claim:

- **Frontend requests token** with scope `api://cdss-api/access_as_user`
- **Entra ID issues token** with `aud` = `api://cdss-api`
- **Backend validates** against `CDSS_AUTH_AUDIENCE` value
- **Mismatch** → JWT validation fails → 401

### Quick Fix

```bash
# Update the auth configuration
az containerapp update -g "$RG" -n "$APP" \
  --set-env-vars \
    "CDSS_AUTH_ENABLED=true" \
    "CDSS_AUTH_TENANT_ID=$(az account show --query tenantId -o tsv)" \
    "CDSS_AUTH_AUDIENCE=api://cdss-api" \
    'CDSS_AUTH_REQUIRED_SCOPES=["access_as_user"]'
```

### Automated Fix Script

```bash
# Diagnose and fix authentication issues
./infra/scripts/fix-auth-config.sh --resource-group "$RG" --dry-run  # Preview changes
./infra/scripts/fix-auth-config.sh --resource-group "$RG"            # Apply fixes
```

### Verify the Fix

```bash
# Get a token with the correct scope
export TOKEN=$(az account get-access-token --scope "api://cdss-api/access_as_user" --query accessToken -o tsv)

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "https://${API_FQDN}/api/v1/patients?limit=1"
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Empty `CDSS_AUTH_AUDIENCE` | Bicep default is empty | Set to `api://cdss-api` |
| 503 Service Unavailable | Auth enabled but config incomplete | Check tenant ID and audience |
| CORS preflight fails | Frontend origin not allowed | Add SWA hostname to CORS |
| Token has wrong audience | API App ID URI mismatch | Verify API app registration |
