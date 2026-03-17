# Clinical Decision Support System (CDSS) with Agentic RAG

![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-Cloud-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

**Intelligent Clinical Decision Support System powered by Multi-Agent RAG on Azure**

A production-grade clinical decision support platform that orchestrates five specialized AI agents to synthesize patient records, medical literature, treatment protocols, and drug safety data into evidence-based clinical recommendations with full citation provenance and HIPAA-compliant audit trails.

---

<img width="2183" height="2699" alt="Image" src="https://github.com/user-attachments/assets/a99c6923-65fa-4c13-be26-895d39321c54" />

## Architecture

```
                         Clinical Decision Support System
                         ================================

  Patient Query
       |
       v
  +------------------------------------------------------------+
  |              Agentic AI Orchestrator (GPT-4o)              |
  |                                                            |
  |  Decomposes query, delegates to specialized agents,        |
  |  synthesizes final recommendation with citations           |
  +----+----------+----------+----------+----------+-----------+
       |          |          |          |          |
       v          v          v          v          v
  +---------+ +----------+ +---------+ +---------+ +-----------+
  | Patient | | Medical  | |Protocol | |  Drug   | |Guardrails |
  | History | |Literature| | Agent   | | Safety  | |  Agent    |
  | Agent   | | Agent    | |         | | Agent   | |           |
  +---------+ +----------+ +---------+ +---------+ +-----------+
       |          |            |          |          |
       v          v            v          v          v
  +---------+ +---------+ +---------+ +---------+ +------------+
  |Azure AI | | PubMed  | |Azure AI | |DrugBank | | Citation   |
  | Search  | |  API    | | Search  | |OpenFDA  | |Verification|
  |Cosmos DB| | Cache   | |  Blob   | | RxNorm  | |Safety Val. |
  +---------+ +---------+ +---------+ +---------+ +------------+
       |           |          |            |          |
       +-----------+----------+------------+----------+
                             |
                             v
                  +---------------------+
                  |   Agent Synthesis   |
                  |  (Fusion + Rerank)  |
                  +---------------------+
                             |
                             v
                  +---------------------+
                  | Clinical            |
                  | Recommendation      |
                  | + Citations         |
                  | + Drug Alerts       |
                  | + Confidence Score  |
                  | + Audit Trail       |
                  +---------------------+
```

---

## Key Features

- **Multi-Agent Orchestration** -- Five specialized clinical agents coordinated by an intelligent orchestrator that decomposes complex queries and synthesizes evidence from multiple sources
- **Hybrid RAG Pipeline** -- BM25 lexical search + dense vector search + semantic reranking with Reciprocal Rank Fusion for maximum recall and precision
- **Real-Time PubMed Integration** -- Live access to 36M+ biomedical citations via the NCBI E-utilities API with intelligent caching and rate limiting
- **Drug Interaction Checking** -- Multi-source drug safety analysis using DrugBank, OpenFDA adverse event reports, and RxNorm drug normalization
- **Document Intelligence** -- Azure AI Document Intelligence for ingesting medical PDFs, lab reports, and clinical notes with layout-aware chunking
- **Cosmos DB Vector Search** -- DiskANN-powered vector search in Azure Cosmos DB for sub-millisecond similarity queries over patient records
- **Clinical Guardrails** -- Hallucination detection via citation verification, contraindication flagging, and safety validation before any recommendation is returned
- **HIPAA-Compliant Audit Trail** -- Every query, agent action, data access, and recommendation is logged with immutable audit records
- **Infrastructure as Code** -- Full Azure deployment via Bicep templates with environment-specific parameterization

---

## Architecture Overview

The system employs five specialized agents, each with distinct roles, tools, and model configurations:

### 1. Patient History Agent

| Property | Value |
|----------|-------|
| **Model** | GPT-4o-mini |
| **Tools** | Azure AI Search, Cosmos DB |
| **Role** | Retrieves and summarizes the patient's medical history, current medications, allergies, lab results, and problem list |

This agent queries the patient index in Azure AI Search and enriches the results with structured data from Cosmos DB. It produces a concise patient summary that contextualizes the clinical query.

### 2. Medical Literature Agent

| Property | Value |
|----------|-------|
| **Model** | GPT-4o |
| **Tools** | PubMed E-utilities API, Azure AI Search (cached literature) |
| **Role** | Searches biomedical literature for evidence relevant to the clinical question, prioritizing systematic reviews, meta-analyses, and clinical guidelines |

This agent constructs optimized MeSH-term queries for PubMed, retrieves abstracts, and cross-references them against a locally cached literature index. It returns ranked evidence with PMIDs and evidence grades.

### 3. Protocol Agent

| Property | Value |
|----------|-------|
| **Model** | GPT-4o-mini |
| **Tools** | Azure AI Search, Azure Blob Storage |
| **Role** | Retrieves institutional treatment protocols, clinical practice guidelines, and standard operating procedures relevant to the patient's conditions |

Protocols are ingested from PDF documents stored in Azure Blob Storage, chunked with layout-aware processing, and indexed in Azure AI Search with metadata filtering by specialty, condition, and evidence grade.

### 4. Drug Safety Agent

| Property | Value |
|----------|-------|
| **Model** | GPT-4o |
| **Tools** | DrugBank API, OpenFDA API, RxNorm API |
| **Role** | Analyzes the patient's current and proposed medications for drug-drug interactions, contraindications based on comorbidities, and required dose adjustments based on renal/hepatic function |

This agent normalizes drug names via RxNorm, queries DrugBank for interaction data, and enriches findings with OpenFDA adverse event frequency data. It flags critical interactions with severity levels.

### 5. Guardrails Agent

| Property | Value |
|----------|-------|
| **Model** | GPT-4o |
| **Tools** | Citation verification engine, safety validation rules |
| **Role** | Validates the synthesized recommendation by verifying all citations are real and support the claims made, checking for contraindications against patient data, and ensuring the response does not hallucinate treatments |

This agent acts as the final safety layer. It cross-references every cited PMID against PubMed, validates dosing recommendations against formulary data, and applies a configurable set of clinical safety rules.

---

## Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Language** | Python 3.12 | Core application language |
| **Web Framework** | FastAPI 0.115 | Async REST API with OpenAPI docs |
| **AI Orchestration** | Azure OpenAI (GPT-4o, GPT-4o-mini) | LLM inference for all agents |
| **Embeddings** | text-embedding-3-large (3072-dim) | Dense vector representations |
| **Vector Search** | Azure Cosmos DB (DiskANN) | Sub-ms vector similarity search |
| **Full-Text Search** | Azure AI Search | BM25 + vector hybrid search |
| **Document Processing** | Azure AI Document Intelligence | PDF/image medical document ingestion |
| **Blob Storage** | Azure Blob Storage | Protocol and document storage |
| **SQL Database** | Azure SQL Database | Drug interaction data, audit logs |
| **Caching** | Azure Cache for Redis | PubMed response caching, rate limiting |
| **External APIs** | PubMed E-utilities, DrugBank, OpenFDA, RxNorm | Medical data sources |
| **Authentication** | Azure Entra ID (OAuth 2.0) | Service and user authentication |
| **Secrets** | Azure Key Vault | Secure credential management |
| **Monitoring** | Azure Application Insights | Distributed tracing and metrics |
| **Containerization** | Docker | Application packaging |
| **IaC** | Azure Bicep | Infrastructure as Code |
| **Testing** | pytest, pytest-asyncio, pytest-cov | Comprehensive test suite |
| **Linting** | Ruff | Fast Python linting and formatting |
| **Type Checking** | mypy | Static type analysis |

---

## Project Structure

```
cdss-agentic-rag/
├── src/cdss/
│   ├── __init__.py
│   ├── agents/                  # Specialized clinical agents + orchestrator
│   │   ├── __init__.py
│   │   ├── orchestrator.py      # Main agent coordinator
│   │   ├── patient_history.py   # Patient record retrieval agent
│   │   ├── medical_literature.py# PubMed search agent
│   │   ├── protocol.py          # Treatment protocol agent
│   │   ├── drug_safety.py       # Drug interaction checking agent
│   │   └── guardrails.py        # Safety validation agent
│   ├── api/                     # FastAPI REST endpoints
│   │   ├── __init__.py
│   │   ├── app.py               # FastAPI application factory
│   │   ├── routes/
│   │   │   ├── query.py         # Clinical query endpoints
│   │   │   ├── patients.py      # Patient data endpoints
│   │   │   ├── documents.py     # Document ingestion endpoints
│   │   │   ├── drugs.py         # Drug interaction endpoints
│   │   │   ├── search.py        # Literature/protocol search
│   │   │   ├── audit.py         # Audit trail endpoints
│   │   │   └── health.py        # Health check endpoint
│   │   ├── middleware/
│   │   │   ├── auth.py          # JWT/OAuth2 authentication
│   │   │   ├── audit.py         # Request/response audit logging
│   │   │   └── rate_limit.py    # Rate limiting middleware
│   │   └── schemas/
│   │       ├── requests.py      # Pydantic request models
│   │       └── responses.py     # Pydantic response models
│   ├── clients/                 # Azure + external API clients
│   │   ├── __init__.py
│   │   ├── azure_openai.py      # Azure OpenAI client wrapper
│   │   ├── azure_search.py      # Azure AI Search client
│   │   ├── cosmos_db.py         # Cosmos DB client
│   │   ├── blob_storage.py      # Azure Blob Storage client
│   │   ├── document_intel.py    # Document Intelligence client
│   │   ├── pubmed.py            # PubMed E-utilities client
│   │   ├── drugbank.py          # DrugBank API client
│   │   ├── openfda.py           # OpenFDA API client
│   │   └── rxnorm.py            # RxNorm API client
│   ├── core/                    # Models, config, exceptions, logging
│   │   ├── __init__.py
│   │   ├── config.py            # Pydantic Settings configuration
│   │   ├── models.py            # Domain models (Patient, Drug, etc.)
│   │   ├── exceptions.py        # Custom exception hierarchy
│   │   └── logging.py           # Structured logging setup
│   ├── ingestion/               # Document processing pipeline
│   │   ├── __init__.py
│   │   ├── pipeline.py          # Ingestion orchestrator
│   │   ├── extractors.py        # Text extraction (PDF, images)
│   │   ├── chunker.py           # Layout-aware document chunking
│   │   └── indexer.py           # Search index management
│   ├── rag/                     # RAG pipeline components
│   │   ├── __init__.py
│   │   ├── pipeline.py          # End-to-end RAG pipeline
│   │   ├── chunker.py           # Text chunking strategies
│   │   ├── embedder.py          # Embedding generation
│   │   ├── retriever.py         # Hybrid retrieval (BM25 + vector)
│   │   ├── reranker.py          # Semantic reranking
│   │   └── fusion.py            # Reciprocal Rank Fusion
│   ├── services/                # Business logic services
│   │   ├── __init__.py
│   │   ├── query_service.py     # Clinical query processing
│   │   ├── patient_service.py   # Patient data management
│   │   ├── drug_service.py      # Drug interaction analysis
│   │   └── audit_service.py     # Audit logging service
│   └── utils/                   # Shared utilities
│       ├── __init__.py
│       ├── medical_codes.py     # ICD-10, LOINC, RxNorm helpers
│       ├── text_processing.py   # Medical text normalization
│       └── validators.py        # Input validation utilities
├── tests/                       # Comprehensive test suite
│   ├── conftest.py              # Shared fixtures
│   ├── unit/
│   │   ├── test_agents/
│   │   ├── test_rag/
│   │   ├── test_services/
│   │   └── test_clients/
│   ├── integration/
│   │   ├── test_api/
│   │   ├── test_ingestion/
│   │   └── test_search/
│   └── e2e/
│       └── test_clinical_queries.py
├── infra/                       # Azure Bicep IaC templates
│   ├── main.bicep               # Root deployment template
│   ├── modules/
│   │   ├── ai-search.bicep
│   │   ├── cosmos-db.bicep
│   │   ├── openai.bicep
│   │   ├── key-vault.bicep
│   │   ├── app-service.bicep
│   │   ├── sql-database.bicep
│   │   ├── redis.bicep
│   │   ├── storage.bicep
│   │   └── monitoring.bicep
│   ├── parameters/
│   │   ├── dev.bicepparam
│   │   ├── staging.bicepparam
│   │   └── prod.bicepparam
│   └── scripts/
│       ├── deploy.sh
│       └── seed-data.sh
├── sample_data/                 # Sample patient data for testing
│   ├── sample_patient.json
│   ├── sample_query.json
│   ├── sample_response.json
│   ├── sample_protocol.md
│   └── sample_lab_report.txt
├── docs/                        # Additional documentation
│   ├── architecture.md
│   └── api-reference.md
├── .env.example                 # Environment variable template
├── Dockerfile                   # Multi-stage Docker build
├── docker-compose.yml           # Local development stack
├── pyproject.toml               # Python project configuration
└── README.md                    # This file
```

---

## Prerequisites

- **Python 3.12+** -- Required for modern type hints and performance improvements
- **Azure Subscription** -- With permissions to create the required services (see [Azure Services Required](#azure-services-required))
- **Docker** -- For local development and containerized deployment
- **Azure CLI** -- For infrastructure deployment (`az` command)
- **Git** -- For version control

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-org/cdss-agentic-rag.git
cd cdss-agentic-rag
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your Azure credentials and API keys
```

### 3. Install dependencies

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install with development dependencies
pip install -e ".[dev]"
```

### 4. Deploy Azure infrastructure

```bash
# Login to Azure
az login

# Recommended first-run path (idempotent):
# - creates RG + ACR if missing
# - builds linux/amd64 backend image and pushes to ACR
# - deploys Bicep infra + Container App
# - handles transient OpenAI/DocIntel provisioning races with retry
# - bootstraps AI Search indexes (temporary public toggle, then locks back down)
# - generates .env/.env.azure
./infra/scripts/bootstrap-deploy.sh prod cdss-prod-rg eastus2

cat > .env << EOF
CDSS_PUBMED_API_KEY=
CDSS_PUBMED_EMAIL=
EOF

# Optional: skip image build if you already pushed a tag
# CONTAINER_IMAGE=<acr>.azurecr.io/cdss-api:<tag> \
# SKIP_IMAGE_BUILD=true \
# ./infra/scripts/bootstrap-deploy.sh prod cdss-prod-rg eastus2

# Optional: keep production API private (no public ingress)
# PROD_PUBLIC_API=false ./infra/scripts/bootstrap-deploy.sh prod cdss-prod-rg eastus2

# Optional: run auth setup as part of bootstrap (requires Graph permissions)
# SKIP_AUTH_SETUP=false ./infra/scripts/bootstrap-deploy.sh prod cdss-prod-rg eastus2

# Configure Entra SPA auth + write frontend/.env.local
RG=cdss-prod-rg
APP=$(az containerapp list -g "$RG" --query "[?contains(name,'-api')].name | [0]" -o tsv)
./infra/scripts/setup-entra-spa-auth.sh --resource-group "$RG" --container-app-name "$APP"

# Seed sample data from inside Container App network boundary
./infra/scripts/seed-data-infra-network.sh "$RG" "$APP"

# Allow local frontend origins for browser->API calls
az containerapp ingress cors update -g "$RG" -n "$APP" \
  --allowed-origins http://localhost:3000 https://localhost:3000 http://localhost:3001 https://localhost:3001

# Verify backend health
API_FQDN=$(az containerapp show -g "$RG" -n "$APP" --query properties.configuration.ingress.fqdn -o tsv)
curl -s -o /dev/null -w "%{http_code}\n" "https://$API_FQDN/api/v1/health"

# Run frontend locally (Vite is intentionally configured for port 3000)
cd frontend && npm install && npm run dev
# Open: http://localhost:3000
# API docs: https://$API_FQDN/docs
```

### 5. Run locally

```bash
# Start the development server
uvicorn cdss.api.app:app --reload --host 0.0.0.0 --port 8000

# The API will be available at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

### 6. Run with Docker

```bash
# Start all services (API + Redis + local emulators)
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/query` | Submit a clinical query for multi-agent analysis |
| `POST` | `/api/v1/query/stream` | Submit a clinical query with streaming response (SSE) |
| `GET` | `/api/v1/patients/{id}` | Retrieve a patient profile with full medical history |
| `POST` | `/api/v1/documents/ingest` | Ingest a medical document (PDF, DOCX, or image) |
| `POST` | `/api/v1/drugs/interactions` | Check drug-drug interactions for a medication list |
| `POST` | `/api/v1/search/literature` | Search PubMed and cached medical literature |
| `POST` | `/api/v1/search/protocols` | Search institutional treatment protocols |
| `GET` | `/api/v1/health` | Health check with dependency status |
| `GET` | `/api/v1/audit` | Query the audit trail (requires admin role) |

---

## Example Usage

### Submit a Clinical Query

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "text": "What are the treatment options for this patient'\''s uncontrolled diabetes given their CKD stage 3?",
    "patient_id": "patient_12345",
    "session_id": null
  }'
```

**Response** (abbreviated):

```json
{
  "query_id": "q_a1b2c3d4",
  "status": "completed",
  "clinical_response": {
    "assessment": "65-year-old male with Type 2 Diabetes (HbA1c 7.2%) and CKD Stage 3 (eGFR 42 mL/min/1.73m2). Current metformin dose requires evaluation given declining renal function.",
    "recommendation": "Consider dose reduction of metformin to 500mg daily given eGFR 30-45...",
    "confidence_score": 0.87
  }
}
```

### Check Drug Interactions

```bash
curl -X POST http://localhost:8000/api/v1/drugs/interactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "medications": [
      {"name": "metformin", "rxnorm_cui": "6809", "dose": "500mg", "frequency": "BID"},
      {"name": "lisinopril", "rxnorm_cui": "29046", "dose": "10mg", "frequency": "QD"},
      {"name": "empagliflozin", "rxnorm_cui": "1545653", "dose": "10mg", "frequency": "QD"}
    ],
    "patient_id": "patient_12345"
  }'
```

**Response** (abbreviated):

```json
{
  "interaction_check_id": "ic_x9y8z7",
  "interactions_found": 1,
  "alerts": [
    {
      "severity": "moderate",
      "type": "drug-disease",
      "description": "Metformin requires dose adjustment with eGFR 30-45 mL/min/1.73m2",
      "recommendation": "Reduce metformin to 500mg daily; discontinue if eGFR falls below 30"
    }
  ]
}
```

### Ingest a Medical Document

```bash
curl -X POST http://localhost:8000/api/v1/documents/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/clinical_guideline.pdf" \
  -F "document_type=protocol" \
  -F "metadata={\"specialty\": \"endocrinology\", \"condition\": \"type_2_diabetes\"}"
```

**Response**:

```json
{
  "document_id": "doc_m4n5o6",
  "status": "processing",
  "message": "Document accepted for ingestion. 24 chunks will be indexed.",
  "estimated_completion_seconds": 45
}
```

### Search Medical Literature

```bash
curl -X POST http://localhost:8000/api/v1/search/literature \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "SGLT2 inhibitors renal outcomes type 2 diabetes CKD",
    "max_results": 10,
    "date_range": {"start": "2020-01-01", "end": "2026-01-01"},
    "article_types": ["meta-analysis", "randomized-controlled-trial", "clinical-guideline"]
  }'
```

**Response** (abbreviated):

```json
{
  "search_id": "ls_p7q8r9",
  "total_results": 847,
  "results": [
    {
      "pmid": "34921726",
      "title": "SGLT2 Inhibitors and Renal Outcomes in Type 2 Diabetes...",
      "journal": "New England Journal of Medicine",
      "year": 2023,
      "relevance_score": 0.94
    }
  ]
}
```

---

## Azure Services Required

| Service | SKU / Tier | Purpose |
|---------|-----------|---------|
| **Azure OpenAI** | Standard (S0) | GPT-4o and GPT-4o-mini for agent inference; text-embedding-3-large for embeddings |
| **Azure AI Search** | Standard (S1) | Hybrid BM25 + vector search over patient records, protocols, and cached literature |
| **Azure Cosmos DB** | Serverless | Patient record storage with DiskANN vector search capability |
| **Azure Blob Storage** | Standard LRS | Storage for medical documents, protocols, and ingested files |
| **Azure SQL Database** | Standard (S1) | Drug interaction data, structured audit logs, user/session management |
| **Azure AI Document Intelligence** | Standard (S0) | PDF and image text extraction with layout understanding |
| **Azure Cache for Redis** | Basic (C1) | PubMed API response caching, rate limiting, session state |
| **Azure Key Vault** | Standard | Secure storage for API keys, connection strings, and certificates |
| **Azure App Service** | Standard (S1) | Container hosting for the FastAPI application |
| **Azure Entra ID** | Free tier | OAuth 2.0 authentication and RBAC |
| **Azure Application Insights** | Pay-as-you-go | Distributed tracing, custom metrics, and alerting |
| **Azure Container Registry** | Basic | Docker image storage for CI/CD deployments |

---

## Data Flow

The journey of a patient clinical query through the system follows seven steps:

### Step 1: Query Reception

The clinician submits a natural-language clinical question via the REST API, optionally referencing a patient by ID. The request is authenticated via Azure Entra ID, validated, and assigned a unique query ID. An audit record is created.

### Step 2: Query Decomposition

The Orchestrator Agent analyzes the query and determines which specialized agents to invoke. For a query about diabetes treatment with CKD, it would activate the Patient History Agent, Medical Literature Agent, Protocol Agent, and Drug Safety Agent.

### Step 3: Parallel Agent Execution

The orchestrator dispatches tasks to the selected agents concurrently. Each agent independently queries its data sources:

- **Patient History Agent** retrieves the patient's record from Azure AI Search and Cosmos DB
- **Medical Literature Agent** searches PubMed for relevant clinical evidence
- **Protocol Agent** retrieves applicable treatment guidelines
- **Drug Safety Agent** checks current and proposed medications for interactions

### Step 4: Evidence Retrieval and Ranking

Each agent's RAG pipeline performs hybrid retrieval (BM25 + vector search), applies semantic reranking, and returns the top-k results with relevance scores. Results are deduplicated across agents via Reciprocal Rank Fusion.

### Step 5: Agent Synthesis

The Orchestrator Agent receives all agent outputs and synthesizes them into a unified clinical recommendation. It resolves conflicts between sources, assigns an overall confidence score, and generates a structured response with assessment, recommendations, and supporting evidence.

### Step 6: Guardrails Validation

The Guardrails Agent validates the synthesized response by:
- Verifying every cited PMID exists in PubMed and supports the claim
- Checking that no recommended drug is contraindicated for the patient
- Flagging any recommendation that lacks sufficient evidence support
- Ensuring dosing recommendations fall within safe ranges

### Step 7: Response Delivery

The validated response is returned to the clinician with a confidence score, citations, drug alerts, and disclaimers. The complete interaction -- including all agent inputs, outputs, latencies, and the final recommendation -- is written to the audit trail.

---

## Security and Compliance

This system is designed with HIPAA compliance requirements in mind:

### Data Protection

- **Encryption at rest** -- All Azure services configured with AES-256 encryption using customer-managed keys in Azure Key Vault
- **Encryption in transit** -- TLS 1.3 enforced on all API endpoints and inter-service communication
- **PHI minimization** -- Patient data is referenced by opaque IDs; full records are never included in LLM prompts beyond what is clinically necessary

### Access Control

- **Azure Entra ID** -- OAuth 2.0 / OpenID Connect for user and service authentication
- **Role-Based Access Control (RBAC)** -- Clinician, Pharmacist, Admin, and Auditor roles with granular permissions
- **API key rotation** -- Automated key rotation via Azure Key Vault with zero-downtime rollover
- **Network isolation** -- Virtual Network integration with private endpoints for all Azure services

### Audit and Logging

- **Immutable audit trail** -- Every query, data access, and recommendation logged to Azure SQL with tamper-evident hashing
- **Structured logging** -- JSON-formatted logs with correlation IDs shipped to Azure Application Insights
- **Retention policies** -- Configurable log retention (default: 7 years for HIPAA)
- **Audit API** -- Queryable audit endpoint for compliance officers (requires admin role)

### Clinical Safety

- **Hallucination detection** -- Citation verification against PubMed ensures recommendations are evidence-based
- **Contraindication checking** -- Automated flagging of drug-disease and drug-drug contraindications
- **Confidence scoring** -- Every recommendation includes a confidence score; low-confidence responses include explicit uncertainty disclaimers
- **Human-in-the-loop** -- The system provides decision support only; it never autonomously initiates treatment

---

## Running Tests

```bash
# Run the full test suite with coverage
pytest tests/ -v --cov=cdss --cov-report=term-missing

# Run only unit tests
pytest tests/unit/ -v

# Run integration coverage tests (mocked external dependencies)
pytest tests/integration/ -v

# Run the integration E2E workflow test module
pytest tests/integration/test_e2e.py -v

# Run with parallel execution
pytest tests/ -v -n auto --cov=cdss

# Generate HTML coverage report
pytest tests/ --cov=cdss --cov-report=html
open htmlcov/index.html
```

---

## Infrastructure Deployment

The entire Azure infrastructure is defined as code using Azure Bicep templates.

### Recommended (first run, reproducible)

```bash
# One command bootstrap for new environments:
# - creates RG + ACR when missing
# - builds/pushes linux/amd64 backend image
# - deploys Bicep infra + Container App
# - retries transient Azure OpenAI/DocIntel "Accepted" provisioning races
# - bootstraps Search indexes safely
./infra/scripts/bootstrap-deploy.sh prod my-rg-prod eastus2
```

### Manual/advanced deployment

```bash
# 1) Ensure RG exists first
az group create -n my-rg-prod -l eastus2

# 2) Build and push backend image (linux/amd64 required for Container Apps)
az acr create -n <unique-acr-name> -g my-rg-prod -l eastus2 --sku Standard
az acr login -n <unique-acr-name>
docker buildx build --platform linux/amd64 \
  -t <unique-acr-name>.azurecr.io/cdss-api:<tag> \
  --push .

# 3) Deploy infra + app
CONTAINER_IMAGE=<unique-acr-name>.azurecr.io/cdss-api:<tag> \
ACR_NAME=<unique-acr-name> \
./infra/scripts/deploy.sh prod my-rg-prod eastus2 true
```

### What gets deployed

The Bicep templates provision and configure all Azure services listed in the [Azure Services Required](#azure-services-required) section, including:

- Virtual Network with subnets and private endpoints
- Azure OpenAI with model deployments (GPT-4o, GPT-4o-mini, text-embedding-3-large)
- Azure AI Search with index definitions and skillsets
- Cosmos DB account with vector indexing policy
- Azure SQL Database with schema migrations
- All supporting services (Key Vault, Redis, Storage, App Insights)

---

## Configuration

The application is configured via environment variables. Copy `.env.example` to `.env` and set the following:

### Required Variables

| Variable | Description |
|----------|-------------|
| `CDSS_AZURE_OPENAI_ENDPOINT` | Azure OpenAI service endpoint URL |
| `CDSS_AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `CDSS_AZURE_OPENAI_DEPLOYMENT_NAME` | GPT-4o model deployment name |
| `CDSS_AZURE_OPENAI_MINI_DEPLOYMENT_NAME` | GPT-4o-mini model deployment name |
| `CDSS_AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | text-embedding-3-large deployment name |
| `CDSS_AZURE_SEARCH_ENDPOINT` | Azure AI Search service endpoint URL |
| `CDSS_AZURE_SEARCH_API_KEY` | Azure AI Search admin API key |
| `CDSS_AZURE_SEARCH_PATIENT_RECORDS_INDEX` | Patient records index name (default: `patient-records`) |
| `CDSS_AZURE_SEARCH_TREATMENT_PROTOCOLS_INDEX` | Treatment protocols index name (default: `treatment-protocols`) |
| `CDSS_AZURE_SEARCH_MEDICAL_LITERATURE_INDEX` | Literature index name (default: `medical-literature-cache`) |
| `CDSS_AZURE_COSMOS_ENDPOINT` | Azure Cosmos DB endpoint URL |
| `CDSS_AZURE_COSMOS_KEY` | Azure Cosmos DB primary key (optional when Entra ID is enabled) |
| `CDSS_AZURE_COSMOS_DATABASE_NAME` | Cosmos DB database name (default: `cdss-db`) |
| `CDSS_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Azure Document Intelligence endpoint |
| `CDSS_AZURE_DOCUMENT_INTELLIGENCE_KEY` | Azure Document Intelligence API key |
| `CDSS_AZURE_BLOB_CONNECTION_STRING` | Azure Blob Storage connection string |
| `CDSS_AZURE_BLOB_ENDPOINT` | Azure Blob Storage endpoint URL |
| `CDSS_AZURE_KEY_VAULT_URL` | Azure Key Vault URL |
| `CDSS_REDIS_URL` | Redis connection URL |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CDSS_PUBMED_API_KEY` | `None` | NCBI API key for higher PubMed rate limits |
| `CDSS_DRUGBANK_API_KEY` | `None` | DrugBank API key for drug interaction data |
| `CDSS_LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `CDSS_CORS_ORIGINS` | `["http://localhost:3000","http://localhost:3001"]` | Allowed CORS origins |
| `CDSS_AUTH_ENABLED` | `false` | Enable Entra ID JWT validation middleware |
| `CDSS_AUTH_TENANT_ID` | `None` | Entra tenant ID for JWT issuer/JWKS |
| `CDSS_AUTH_AUDIENCE` | `None` | Entra API audience (Application ID URI/client ID) |
| `MAX_CONCURRENT_AGENTS` | `5` | Maximum parallel agent executions |
| `RAG_TOP_K` | `10` | Number of documents to retrieve per query |
| `RAG_RERANK_TOP_N` | `5` | Number of documents after reranking |
| `EMBEDDING_DIMENSIONS` | `3072` | Embedding vector dimensions |
| `CHUNK_SIZE` | `512` | Document chunk size in tokens |
| `CHUNK_OVERLAP` | `64` | Overlap between document chunks |
| `PUBMED_CACHE_TTL` | `86400` | PubMed cache TTL in seconds (24h) |
| `AUDIT_LOG_RETENTION_DAYS` | `2555` | Audit log retention (7 years) |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes and add tests
4. Run the test suite (`pytest tests/ -v --cov=cdss`)
5. Run linting and type checks (`ruff check . && mypy src/`)
6. Commit your changes (`git commit -m "Add your feature"`)
7. Push to the branch (`git push origin feature/your-feature`)
8. Open a Pull Request

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Disclaimer

> **This system is for research and educational purposes only. It is not approved for clinical use and has not been validated in a clinical setting. The recommendations generated by this system should not be used as the sole basis for clinical decisions. Always consult qualified healthcare professionals for medical advice, diagnosis, and treatment. The authors and contributors assume no liability for any actions taken based on the output of this system.**
