#!/bin/bash
# Auto-populate .env and .env.azure from deployed Azure resources

set -euo pipefail

RG="${1:-my-resource-group}"

echo "Fetching Azure resource details from: $RG"

# Get resource names
COSMOS=$(az cosmosdb list -g $RG --query "[0].name" -o tsv)
SEARCH=$(az search service list -g $RG --query "[0].name" -o tsv)
OPENAI=$(az cognitiveservices account list -g $RG --query "[?kind=='OpenAI'].name" -o tsv)
DOCINTEL=$(az cognitiveservices account list -g $RG --query "[?kind=='FormRecognizer'].name" -o tsv)
STORAGE=$(az storage account list -g $RG --query "[?tags.project=='cdss-agentic-rag'].name" -o tsv | head -1)

# Get endpoints
COSMOS_EP=$(az cosmosdb show -n $COSMOS -g $RG --query documentEndpoint -o tsv)
SEARCH_EP="https://$SEARCH.search.windows.net"
OPENAI_EP=$(az cognitiveservices account show -n $OPENAI -g $RG --query properties.endpoint -o tsv)
DOCINTEL_EP=$(az cognitiveservices account show -n $DOCINTEL -g $RG --query properties.endpoint -o tsv)

# Get keys
COSMOS_KEY=$(az cosmosdb keys list -n $COSMOS -g $RG --query primaryMasterKey -o tsv)
SEARCH_KEY=$(az search admin-key show --service-name $SEARCH -g $RG --query primaryKey -o tsv)
OPENAI_KEY=$(az cognitiveservices account keys list -n $OPENAI -g $RG --query key1 -o tsv)
DOCINTEL_KEY=$(az cognitiveservices account keys list -n $DOCINTEL -g $RG --query key1 -o tsv)
STORAGE_CONN=$(az storage account show-connection-string -n $STORAGE -g $RG --query connectionString -o tsv)

# Create .env.azure (for seed-data.sh)
cat > .env.azure << EOF
ENVIRONMENT=dev
AZURE_COSMOS_ENDPOINT=$COSMOS_EP
AZURE_COSMOS_DATABASE=cdss-db
AZURE_SEARCH_ENDPOINT=$SEARCH_EP
AZURE_OPENAI_ENDPOINT=$OPENAI_EP
AZURE_OPENAI_GPT4O_DEPLOYMENT=gpt-4o
AZURE_OPENAI_GPT4O_MINI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
EOF

# Create .env (for Python app)
cat > .env << EOF
# ═══════════════════════════════════════════════════════════════════════════════
# CDSS Agentic RAG - Environment Configuration (Auto-generated)
# ═══════════════════════════════════════════════════════════════════════════════

# ── Azure OpenAI ──────────────────────────────────────────────────────────────
CDSS_AZURE_OPENAI_ENDPOINT=$OPENAI_EP
CDSS_AZURE_OPENAI_API_KEY=$OPENAI_KEY
CDSS_AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
CDSS_AZURE_OPENAI_MINI_DEPLOYMENT_NAME=gpt-4o-mini
CDSS_AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
CDSS_AZURE_OPENAI_API_VERSION=2024-12-01-preview

# ── Azure AI Search ───────────────────────────────────────────────────────────
CDSS_AZURE_SEARCH_ENDPOINT=$SEARCH_EP
CDSS_AZURE_SEARCH_API_KEY=$SEARCH_KEY
CDSS_AZURE_SEARCH_PATIENT_RECORDS_INDEX=patient-records
CDSS_AZURE_SEARCH_TREATMENT_PROTOCOLS_INDEX=treatment-protocols
CDSS_AZURE_SEARCH_MEDICAL_LITERATURE_INDEX=medical-literature

# ── Azure Cosmos DB ───────────────────────────────────────────────────────────
CDSS_AZURE_COSMOS_ENDPOINT=$COSMOS_EP
CDSS_AZURE_COSMOS_KEY=$COSMOS_KEY
CDSS_AZURE_COSMOS_DATABASE_NAME=cdss-db
CDSS_AZURE_COSMOS_PATIENT_PROFILES_CONTAINER=patient-profiles
CDSS_AZURE_COSMOS_CONVERSATION_HISTORY_CONTAINER=conversation-history
CDSS_AZURE_COSMOS_EMBEDDING_CACHE_CONTAINER=embedding-cache
CDSS_AZURE_COSMOS_AUDIT_LOG_CONTAINER=audit-log
CDSS_AZURE_COSMOS_AGENT_STATE_CONTAINER=agent-state

# ── Azure Document Intelligence ──────────────────────────────────────────────
CDSS_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=$DOCINTEL_EP
CDSS_AZURE_DOCUMENT_INTELLIGENCE_KEY=$DOCINTEL_KEY

# ── Azure Blob Storage ───────────────────────────────────────────────────────
CDSS_AZURE_BLOB_CONNECTION_STRING=$STORAGE_CONN
CDSS_AZURE_BLOB_PROTOCOLS_CONTAINER=protocols

# ── PubMed / NCBI Entrez ─────────────────────────────────────────────────────
CDSS_PUBMED_API_KEY=d09d9c8ab2a38dbb685542d97704f62cb608
CDSS_PUBMED_EMAIL=heeyaichen@k21academy.com
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

echo "✅ Created .env.azure"
echo "✅ Created .env with all Azure credentials"
echo ""
echo "Next: ./infra/scripts/seed-data.sh dev"
