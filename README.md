# CDSS Production Runbook

This repository is hardened for the production target architecture:
- Frontend: Azure Static Web Apps (React + Vite)
- Backend: Azure Container Apps (FastAPI)
- Identity: Microsoft Entra ID (MSAL SPA PKCE)

Backend infrastructure is assumed **not deployed yet** for this runbook. This document prepares and validates code/config so deployment is deterministic when infra is provisioned.

## 1. System Architecture

```text
Clinician Browser
  -> Azure Static Web Apps (frontend)
  -> Azure Container Apps (backend /api)
     -> OpenAI, AI Search, Cosmos DB, Doc Intelligence, Redis, Key Vault, Web PubSub
```

Auth flow:
1. Frontend signs in user via Entra SPA PKCE.
2. Frontend gets access token for `api://<api-app-id-or-uri>/access_as_user`.
3. Frontend sends bearer token to backend `/api/v1/*` routes.
4. Backend validates JWT audience/scope/issuer.

## 2. Frontend Environment Configuration

Frontend runtime config is centralized in `frontend/src/config/runtime.ts`.

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes | Backend API base URL (must include `/api`) | `https://<api-host>.azurecontainerapps.io/api` |
| `VITE_AZURE_CLIENT_ID` | Yes | Entra SPA app client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `VITE_AZURE_TENANT_ID` | Yes | Entra tenant ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `VITE_AZURE_AUTHORITY` | Recommended | Entra authority URL | `https://login.microsoftonline.com/<tenant-id>` |
| `VITE_API_SCOPE` | Yes | Delegated API scope | `api://cdss-api/access_as_user` |
| `VITE_REDIRECT_URI` | Yes (prod) | SWA redirect URI | `https://<swa-host>.azurestaticapps.net` |
| `VITE_POST_LOGOUT_URI` | Yes (prod) | SWA logout redirect URI | `https://<swa-host>.azurestaticapps.net` |
| `VITE_WS_ENDPOINT` | Yes | Web PubSub endpoint | `wss://<pubsub-host>.webpubsub.azure.com` |
| `VITE_ENVIRONMENT` | Recommended | Runtime mode | `production` |
| `VITE_USE_MOCK_API` | No | Local mock toggle only | `false` |

Rules:
- Do not put secrets in `VITE_*` vars.
- Secrets stay in backend Key Vault access only.
- No localhost values in production env files.

## 3. Production Env Files

Update `frontend/.env.production` placeholders:

```env
VITE_API_BASE_URL=https://<api-host>.azurecontainerapps.io/api
VITE_AZURE_CLIENT_ID=<spa-client-id>
VITE_AZURE_TENANT_ID=<tenant-id>
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
VITE_API_SCOPE=api://cdss-api/access_as_user
VITE_REDIRECT_URI=https://<swa-host>.azurestaticapps.net
VITE_POST_LOGOUT_URI=https://<swa-host>.azurestaticapps.net
VITE_WS_ENDPOINT=wss://<pubsub-host>.webpubsub.azure.com
VITE_ENVIRONMENT=production
VITE_USE_MOCK_API=false
```

Use `frontend/.env.example` as the template for team onboarding.

## 4. Entra ID Setup

### SPA app registration
- Platform: `Single-page application`
- Redirect URIs:
  - `https://<swa-host>.azurestaticapps.net`
  - `https://<swa-host>.azurestaticapps.net/auth/callback` (if used)
- Front-channel logout URL:
  - `https://<swa-host>.azurestaticapps.net`
- API permissions:
  - delegated `api://cdss-api/access_as_user`
  - grant admin consent

### API app registration
- Application ID URI: `api://cdss-api` (or your chosen URI)
- Exposed scope: `access_as_user`
- SPA app allowed to request delegated scope

## 5. Build and Pre-Deploy Verification

```bash
cd frontend
npm ci
npm run build
```

Validate artifact:

```bash
cd frontend
ls -la dist/
rg -n "localhost|127\.0\.0\.1" src --glob '*.{ts,tsx,js,jsx,css}'
rg -n "azurecontainerapps\.io|VITE_API_BASE_URL" dist --glob '!**/*.map' | head -20
```

Copy SWA config into deploy artifact:

```bash
cd frontend
cp staticwebapp.config.json dist/staticwebapp.config.json
```

## 6. Deploy Frontend to Azure Static Web Apps

```bash
# create/check SWA
az staticwebapp show --name <swa-name> --resource-group <rg>

# deploy build output
cd frontend
swa deploy ./dist --deployment-token <SWA_DEPLOYMENT_TOKEN> --env production
```

Get hostname:

```bash
az staticwebapp show --name <swa-name> --resource-group <rg> --query defaultHostname -o tsv
```

If hostname changed, update `VITE_REDIRECT_URI` and `VITE_POST_LOGOUT_URI`, rebuild, redeploy.

## 7. Backend CORS Expectations

Production backend must allow only SWA origin.

FastAPI expected behavior:
- `allow_origins=["https://<swa-host>.azurestaticapps.net"]`
- `allow_credentials=True`
- include `Authorization` in allowed headers

Development behavior:
- keep localhost origins (`http://localhost:3000`, `http://localhost:5173`) only in non-production environments.

Ingress-level ACA CORS command:

```bash
az containerapp ingress cors update \
  --name <api-app-name> \
  --resource-group <rg> \
  --allowed-origins "https://<swa-host>.azurestaticapps.net" \
  --allowed-methods "GET,POST,PUT,DELETE,OPTIONS" \
  --allowed-headers "Authorization,Content-Type,X-Request-ID,X-Trace-ID" \
  --expose-headers "X-Request-ID,X-Trace-ID,X-RateLimit-Remaining" \
  --allow-credentials true \
  --max-age 3600
```

## 8. End-to-End Validation Sequence

Run in this order only:

1. Frontend load
- Open `https://<swa-host>.azurestaticapps.net`
- No blank page, no JS bootstrap errors

2. Authentication
- Click Sign In
- Redirect to Microsoft login and back to SWA
- Confirm access token exists in session storage

3. Authenticated API connectivity
- Trigger patient/dashboard query
- Verify bearer token on request
- Verify `200` JSON response

4. Orchestration
- Submit clinical query
- Verify agent progress and final composite response

5. Streaming
- Verify SSE/WebSocket stream delivers incremental updates without 401/CORS failures

6. Ingestion + retrieval
- Upload document
- Confirm ingestion status and search retrieval

## 9. Troubleshooting

### 401 Invalid or expired bearer token
- Verify `VITE_API_SCOPE` matches backend audience scope.
- Verify backend expected audience equals token `aud`/scope contract.
- Verify frontend requests include `Authorization: Bearer <token>`.

### CORS blocked
- Add exact SWA origin to backend CORS allow-list.
- Validate preflight (`OPTIONS`) returns matching `Access-Control-Allow-Origin`.

### AADSTS50011 redirect mismatch
- Add exact SWA URI in SPA app registration.
- Rebuild if `VITE_REDIRECT_URI` changed.

### Streaming fails but REST works
- Verify `VITE_WS_ENDPOINT` is set to valid `wss://...webpubsub.azure.com`.
- Verify CSP `connect-src` includes required websocket target.

## 10. Security Requirements

- No secrets in frontend env files.
- MSAL token cache uses `sessionStorage`.
- PII logging disabled in MSAL logger.
- SWA security headers + CSP enforced via `frontend/staticwebapp.config.json`.
- Production config must not contain localhost entries.

## 11. Hardening Changes Applied

- `frontend/src/config/runtime.ts`: centralized env parsing/validation.
- `frontend/src/lib/auth.ts`: env-driven MSAL config, secure defaults.
- `frontend/src/lib/api-client.ts`: env-driven API URL + bearer token attachment.
- `frontend/src/hooks/useClinicalQuery.ts`: consistent `/v1/*` routing + auth headers.
- `frontend/src/hooks/useStreamingSession.ts`: env-driven websocket endpoint.
- `frontend/.env.example` and `frontend/.env.production`: cleaned production-ready templates.
- `frontend/staticwebapp.config.json`: SPA routing + security header policy.
- `frontend/DEPLOYMENT_AUDIT.md`: pre-deploy audit artifact.
- `frontend/PRODUCTION_VALIDATION.md`: production validation checklist.
