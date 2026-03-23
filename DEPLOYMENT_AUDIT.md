# CDSS Pre-Deployment Audit
Generated: 2026-03-23

## Build System
- Framework: Vite 5.1.4
- Build command: `npm run build` (tsc -b && vite build)
- Output directory: `dist/`

## Environment Variables

| Variable | Current Value | Production Value | Status |
|----------|--------------|------------------|--------|
| VITE_API_BASE_URL | https://cdss-prod-api.agreeablemeadow-835fc6b5.eastus2.azurecontainerapps.io/api | https://cdss-prod-api.purplemoss-8efd008e.eastus2.azurecontainerapps.io/api | MUST UPDATE |
| VITE_AZURE_CLIENT_ID | b1aff2ac-5269-49bc-888c-336b46ce0585 | (same - verify) | VERIFY |
| VITE_AZURE_TENANT_ID | da8ed114-679d-4198-88e5-128a1bbba6c0 | (same - verify) | VERIFY |
| VITE_API_SCOPE | api://ce7cfe60-e995-4fe1-90de-b77fcc507335/access_as_user | (same - verify) | VERIFY |
| VITE_WS_ENDPOINT | (undefined) | wss://cdss-prod-pubsub.webpubsub.azure.com | MUST ADD |
| VITE_USE_MOCK_API | false | false | OK |

## MSAL Configuration
- Config file: `src/lib/auth.ts`
- Redirect URIs: `window.location.origin` (dynamic - no hardcoding)
- Cache location: `sessionStorage` (HIPAA compliant)
- Environment-driven: Yes
- **Issue**: Missing `piiLoggingEnabled: false` (HIPAA requirement)

## API Client Configuration
- Config file: `src/lib/api-client.ts`
- Base URL: `VITE_API_BASE_URL` (environment-driven)
- Production validation: Enforces HTTPS in production mode

## Hardcoded Localhost References
- **None in source files** - CLEAN
- Vite dev server proxy uses localhost:8000 (dev-only, excluded from build)

## Blocking Issues

### 1. CRITICAL: Wrong env variable name in useClinicalQuery.ts
- **File**: `src/hooks/useClinicalQuery.ts:15`
- **Issue**: Uses `VITE_API_BASE` instead of `VITE_API_BASE_URL`
- **Impact**: All API calls from this hook will fail in production
- **Fix**: Change to `import.meta.env.VITE_API_BASE_URL`

### 2. Missing WebSocket endpoint
- **File**: `src/hooks/useStreamingSession.ts:24`
- **Issue**: `VITE_WS_ENDPOINT` is not defined
- **Impact**: Streaming won't connect in production
- **Fix**: Add to `.env.production`

### 3. Missing piiLoggingEnabled in MSAL config
- **File**: `src/lib/auth.ts`
- **Issue**: No `piiLoggingEnabled: false` in loggerOptions
- **Impact**: Potential HIPAA violation if PII logged
- **Fix**: Add system.loggerOptions with piiLoggingEnabled: false

### 4. Outdated .env.production
- **File**: `.env.production`
- **Issue**: Points to wrong API endpoint and missing variables
- **Fix**: Update with correct production values

## Pre-Deployment Checklist
- [ ] Fix VITE_API_BASE → VITE_API_BASE_URL in useClinicalQuery.ts
- [ ] Add piiLoggingEnabled: false to MSAL config
- [ ] Create complete .env.production with all variables
- [ ] Verify build succeeds
- [ ] Verify no localhost in build output
