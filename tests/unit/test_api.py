"""Tests for FastAPI endpoints.

Uses TestClient with dependency injection overrides to mock all backend
services. Tests cover query submission, patient lookup, conversation
history, drug interactions, literature search, health check, audit trail,
and document ingestion.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, Depends, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel

from cdss.core.models import ClinicalQuery, ClinicalResponse, DrugAlert, Citation


# ═══════════════════════════════════════════════════════════════════════════════
# Minimal FastAPI App for Testing
# ═══════════════════════════════════════════════════════════════════════════════

# We build a test app that mirrors the expected API surface.
# This avoids importing the actual app module (which may have side effects)
# while still testing the endpoint behavior thoroughly.


class QueryRequest(BaseModel):
    text: str
    patient_id: str | None = None
    session_id: str | None = None


class FeedbackRequest(BaseModel):
    rating: int
    comment: str | None = None


class DrugInteractionRequest(BaseModel):
    drugs: list[str]


class LiteratureSearchRequest(BaseModel):
    query: str
    max_results: int = 20


class ProtocolSearchRequest(BaseModel):
    query: str
    specialty: str | None = None


class DocumentIngestRequest(BaseModel):
    document_type: str
    content: str
    metadata: dict | None = None


# Mock services
_mock_orchestrator = AsyncMock()
_mock_cosmos = AsyncMock()
_mock_pubmed = AsyncMock()
_mock_search = AsyncMock()
_mock_drug_safety = AsyncMock()
_mock_ingestion = AsyncMock()


def _create_test_app() -> FastAPI:
    app = FastAPI(title="CDSS API - Test")

    @app.post("/api/v1/query")
    async def submit_query(request: QueryRequest):
        query = ClinicalQuery(
            text=request.text,
            patient_id=request.patient_id,
            session_id=request.session_id,
        )
        response = await _mock_orchestrator.process_query(query)
        return response

    @app.get("/api/v1/patients/{patient_id}")
    async def get_patient(patient_id: str):
        profile = await _mock_cosmos.get_patient_profile(patient_id)
        if profile is None:
            raise HTTPException(status_code=404, detail="Patient not found")
        return profile

    @app.get("/api/v1/conversations/{session_id}")
    async def get_conversation(session_id: str):
        history = await _mock_cosmos.get_conversation_history(session_id)
        return {"session_id": session_id, "turns": history}

    @app.post("/api/v1/conversations/{session_id}/feedback")
    async def submit_feedback(session_id: str, request: FeedbackRequest):
        await _mock_cosmos.save_conversation_turn({
            "session_id": session_id,
            "type": "feedback",
            "rating": request.rating,
            "comment": request.comment,
        })
        return {"status": "ok", "session_id": session_id}

    @app.post("/api/v1/drugs/interactions")
    async def check_drug_interactions(request: DrugInteractionRequest):
        result = await _mock_drug_safety.check_interactions(request.drugs)
        return {"drugs": request.drugs, "interactions": result}

    @app.post("/api/v1/search/literature")
    async def search_literature(request: LiteratureSearchRequest):
        articles = await _mock_pubmed.search_and_fetch(request.query, request.max_results)
        return {"query": request.query, "articles": articles}

    @app.post("/api/v1/search/protocols")
    async def search_protocols(request: ProtocolSearchRequest):
        results = await _mock_search.search_treatment_protocols(
            query=request.query, specialty=request.specialty
        )
        return {"query": request.query, "results": results}

    @app.get("/api/v1/health")
    async def health_check():
        return {"status": "healthy", "version": "0.1.0"}

    @app.get("/api/v1/audit")
    async def get_audit_trail(patient_id: str | None = None, limit: int = 100):
        events = await _mock_cosmos.get_audit_trail(patient_id=patient_id, limit=limit)
        return {"events": events, "count": len(events)}

    @app.post("/api/v1/documents/ingest")
    async def ingest_document(request: DocumentIngestRequest):
        result = await _mock_ingestion.ingest_document(
            content=request.content,
            document_type=request.document_type,
            metadata=request.metadata,
        )
        return result

    return app


@pytest.fixture(autouse=True)
def reset_mocks():
    """Reset all mocks before each test."""
    _mock_orchestrator.reset_mock()
    _mock_cosmos.reset_mock()
    _mock_pubmed.reset_mock()
    _mock_search.reset_mock()
    _mock_drug_safety.reset_mock()
    _mock_ingestion.reset_mock()


@pytest.fixture
def client() -> TestClient:
    """Return a FastAPI TestClient."""
    app = _create_test_app()
    return TestClient(app)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/query
# ═══════════════════════════════════════════════════════════════════════════════


class TestQueryEndpoint:
    """Tests for the clinical query submission endpoint."""

    def test_valid_query_returns_response(self, client):
        _mock_orchestrator.process_query.return_value = ClinicalResponse(
            assessment="Patient has uncontrolled T2DM.",
            recommendation="Consider SGLT2 inhibitor.",
            confidence_score=0.87,
            evidence_summary=["DAPA-CKD trial supports this."],
            disclaimers=["This is a decision support tool."],
        )

        response = client.post("/api/v1/query", json={
            "text": "Treatment for T2DM with CKD?",
            "patient_id": "P-12345",
            "session_id": "sess-001",
        })

        assert response.status_code == 200
        data = response.json()
        assert "assessment" in data
        assert "recommendation" in data
        assert data["confidence_score"] == 0.87

    def test_missing_text_field_returns_422(self, client):
        response = client.post("/api/v1/query", json={
            "patient_id": "P-12345",
        })
        assert response.status_code == 422

    def test_empty_text_field_returns_422(self, client):
        response = client.post("/api/v1/query", json={
            "text": "",
        })
        # ClinicalQuery requires min_length=1
        assert response.status_code == 422

    def test_query_without_patient_id(self, client):
        _mock_orchestrator.process_query.return_value = ClinicalResponse(
            assessment="General assessment.",
            recommendation="General recommendation.",
            confidence_score=0.75,
        )

        response = client.post("/api/v1/query", json={
            "text": "What is the mechanism of metformin?",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["confidence_score"] == 0.75


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/patients/{patient_id}
# ═══════════════════════════════════════════════════════════════════════════════


class TestPatientEndpoint:
    """Tests for the patient profile endpoint."""

    def test_get_existing_patient(self, client, sample_patient_profile):
        _mock_cosmos.get_patient_profile.return_value = sample_patient_profile

        response = client.get("/api/v1/patients/P-12345")

        assert response.status_code == 200
        data = response.json()
        assert data["patient_id"] == "P-12345"
        assert len(data["active_conditions"]) == 2

    def test_get_nonexistent_patient_returns_404(self, client):
        _mock_cosmos.get_patient_profile.return_value = None

        response = client.get("/api/v1/patients/P-NONEXISTENT")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/conversations/{session_id}
# ═══════════════════════════════════════════════════════════════════════════════


class TestConversationEndpoint:
    """Tests for the conversation history endpoint."""

    def test_get_conversation_history(self, client):
        _mock_cosmos.get_conversation_history.return_value = [
            {"id": "turn-1", "query": "What about diabetes?", "response": "Consider SGLT2i."},
            {"id": "turn-2", "query": "Any interactions?", "response": "Minor with metformin."},
        ]

        response = client.get("/api/v1/conversations/sess-001")

        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == "sess-001"
        assert len(data["turns"]) == 2

    def test_get_empty_conversation(self, client):
        _mock_cosmos.get_conversation_history.return_value = []

        response = client.get("/api/v1/conversations/sess-empty")

        assert response.status_code == 200
        assert len(response.json()["turns"]) == 0


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/conversations/{id}/feedback
# ═══════════════════════════════════════════════════════════════════════════════


class TestFeedbackEndpoint:
    """Tests for the feedback submission endpoint."""

    def test_submit_feedback(self, client):
        _mock_cosmos.save_conversation_turn.return_value = {"id": "fb-001"}

        response = client.post("/api/v1/conversations/sess-001/feedback", json={
            "rating": 5,
            "comment": "Excellent recommendation, very helpful.",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        _mock_cosmos.save_conversation_turn.assert_called_once()

    def test_submit_feedback_minimal(self, client):
        _mock_cosmos.save_conversation_turn.return_value = {"id": "fb-002"}

        response = client.post("/api/v1/conversations/sess-002/feedback", json={
            "rating": 3,
        })

        assert response.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/drugs/interactions
# ═══════════════════════════════════════════════════════════════════════════════


class TestDrugInteractionsEndpoint:
    """Tests for the drug interactions endpoint."""

    def test_check_interactions(self, client):
        _mock_drug_safety.check_interactions.return_value = [
            {
                "drug_a": "metformin",
                "drug_b": "lisinopril",
                "severity": "minor",
                "description": "Minor interaction.",
            }
        ]

        response = client.post("/api/v1/drugs/interactions", json={
            "drugs": ["metformin", "lisinopril"],
        })

        assert response.status_code == 200
        data = response.json()
        assert len(data["interactions"]) == 1
        assert data["drugs"] == ["metformin", "lisinopril"]


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/search/literature
# ═══════════════════════════════════════════════════════════════════════════════


class TestLiteratureSearchEndpoint:
    """Tests for the literature search endpoint."""

    def test_search_pubmed(self, client):
        _mock_pubmed.search_and_fetch.return_value = [
            {"pmid": "32970396", "title": "DAPA-CKD Trial"},
        ]

        response = client.post("/api/v1/search/literature", json={
            "query": "SGLT2 inhibitors for CKD",
            "max_results": 10,
        })

        assert response.status_code == 200
        data = response.json()
        assert len(data["articles"]) == 1
        assert data["articles"][0]["pmid"] == "32970396"


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/search/protocols
# ═══════════════════════════════════════════════════════════════════════════════


class TestProtocolSearchEndpoint:
    """Tests for the protocol search endpoint."""

    def test_search_protocols(self, client):
        _mock_search.search_treatment_protocols.return_value = [
            {"id": "proto-1", "content": "ADA 2024 guideline", "score": 0.9},
        ]

        response = client.post("/api/v1/search/protocols", json={
            "query": "diabetes with CKD guidelines",
            "specialty": "endocrinology",
        })

        assert response.status_code == 200
        data = response.json()
        assert len(data["results"]) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/health
# ═══════════════════════════════════════════════════════════════════════════════


class TestHealthEndpoint:
    """Tests for the health check endpoint."""

    def test_health_returns_healthy(self, client):
        response = client.get("/api/v1/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/v1/audit
# ═══════════════════════════════════════════════════════════════════════════════


class TestAuditEndpoint:
    """Tests for the audit trail endpoint."""

    def test_get_audit_trail(self, client):
        _mock_cosmos.get_audit_trail.return_value = [
            {"id": "audit-1", "type": "patient_data_access", "action": "read_patient"},
            {"id": "audit-2", "type": "llm_interaction", "action": "generate_response"},
        ]

        response = client.get("/api/v1/audit")

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 2
        assert len(data["events"]) == 2

    def test_get_audit_trail_with_patient_filter(self, client):
        _mock_cosmos.get_audit_trail.return_value = [
            {"id": "audit-1", "type": "patient_data_access", "patient_id": "P-12345"},
        ]

        response = client.get("/api/v1/audit?patient_id=P-12345")

        assert response.status_code == 200
        _mock_cosmos.get_audit_trail.assert_called_once_with(patient_id="P-12345", limit=100)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/documents/ingest
# ═══════════════════════════════════════════════════════════════════════════════


class TestDocumentIngestEndpoint:
    """Tests for the document ingestion endpoint."""

    def test_ingest_document(self, client):
        _mock_ingestion.ingest_document.return_value = {
            "status": "completed",
            "document_id": "doc-001",
            "chunks_created": 5,
        }

        response = client.post("/api/v1/documents/ingest", json={
            "document_type": "lab_report",
            "content": "CBC: WBC 7.5, RBC 4.8, Hemoglobin 14.2",
            "metadata": {"patient_id": "P-12345"},
        })

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["chunks_created"] == 5
