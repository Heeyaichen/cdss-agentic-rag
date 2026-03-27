"""FastAPI route definitions for the Clinical Decision Support System.

Defines all HTTP endpoints grouped by domain: clinical queries, patients,
conversations, document ingestion, drug safety, search, and admin/health.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from cdss.agents.drug_safety import DrugSafetyAgent
from cdss.clients.search_client import (
    INDEX_MEDICAL_LITERATURE,
    INDEX_PATIENT_RECORDS,
    INDEX_TREATMENT_PROTOCOLS,
    AzureSearchClient,
)
from cdss.core.exceptions import (
    AzureServiceError,
    CDSSError,
    DrugSafetyError,
    ValidationError,
)
from cdss.core.logging import get_logger
from cdss.core.models import AgentTask, ClinicalResponse
from cdss.services.query_service import ClinicalQueryService

logger = get_logger(__name__)


# ==========================================================================
# Request / Response Models
# ==========================================================================


class ClinicalQueryRequest(BaseModel):
    """Request body for submitting a clinical query."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="The clinical question in natural language.",
    )
    patient_id: str | None = Field(
        default=None,
        description="Optional patient identifier for context enrichment.",
    )
    session_id: str | None = Field(
        default=None,
        description="Optional session ID for conversation continuity.",
    )


class FeedbackRequest(BaseModel):
    """Request body for submitting clinician feedback."""

    rating: int = Field(
        ...,
        ge=1,
        le=5,
        description="Clinician rating from 1 (poor) to 5 (excellent).",
    )
    correction: str | None = Field(
        default=None,
        max_length=5000,
        description="Optional free-text correction or comment.",
    )


class MedicationNameRequest(BaseModel):
    """Medication input payload supporting name-only objects."""

    name: str = Field(..., min_length=1, description="Medication display name.")
    rxcui: str | None = Field(default=None, description="Optional RxNorm CUI.")


class DrugInteractionRequest(BaseModel):
    """Request body for checking drug interactions."""

    medications: list[str | MedicationNameRequest] = Field(
        ...,
        min_length=1,
        description="List of current medication names.",
    )
    proposed_medications: list[str | MedicationNameRequest] | None = Field(
        default=None,
        description="Optional list of proposed new medications to check against.",
    )


class LiteratureSearchRequest(BaseModel):
    """Request body for searching medical literature."""

    query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Search query for medical literature.",
    )
    max_results: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of results to return.",
    )
    date_from: str | None = Field(
        default=None,
        description="Optional start date filter (YYYY/MM/DD format).",
    )
    date_range: dict[str, str] | None = Field(
        default=None,
        description="Optional date range filter with start/end ISO dates.",
    )
    article_types: list[str] | None = Field(
        default=None,
        description="Optional article type filters.",
    )


class ProtocolSearchRequest(BaseModel):
    """Request body for searching clinical protocols."""

    query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Search query for clinical protocols and guidelines.",
    )
    specialty: str | None = Field(
        default=None,
        description="Optional medical specialty filter.",
    )
    evidence_grade: str | None = Field(
        default=None,
        description="Optional evidence grade filter (A, B, C, D, expert_opinion).",
    )


class DocumentVerificationRequest(BaseModel):
    """Request body for document index and retrieval verification."""

    phrase: str | None = Field(
        default=None,
        max_length=500,
        description="Optional phrase to verify retrieval from the indexed chunks.",
    )
    top: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Maximum number of matching chunks to return.",
    )


# ==========================================================================
# Dependency injection
# ==========================================================================

# Singleton service instance, initialized in the application lifespan.
_query_service_instance: ClinicalQueryService | None = None


def set_query_service(service: ClinicalQueryService) -> None:
    """Set the module-level query service singleton.

    Called during application startup to inject the fully configured service.

    Args:
        service: The configured ClinicalQueryService instance.
    """
    global _query_service_instance
    _query_service_instance = service


def get_query_service() -> ClinicalQueryService:
    """FastAPI dependency that returns the query service singleton.

    Returns:
        The configured ClinicalQueryService instance.

    Raises:
        HTTPException: If the service has not been initialized.
    """
    if _query_service_instance is None:
        raise HTTPException(
            status_code=503,
            detail="Service not initialized. The application is starting up.",
        )
    return _query_service_instance


# ==========================================================================
# Router
# ==========================================================================

router = APIRouter()


# ==========================================================================
# Clinical Query Endpoints
# ==========================================================================


@router.post(
    "/api/v1/query",
    response_model=ClinicalResponse,
    tags=["Clinical"],
    summary="Submit a clinical query",
    description=(
        "Submit a clinical query for AI-powered decision support. "
        "Processes the query through multi-agent orchestration:\n"
        "1. Patient History Agent searches records\n"
        "2. Medical Literature Agent queries PubMed\n"
        "3. Protocol Agent finds matching guidelines\n"
        "4. Drug Safety Agent checks interactions\n"
        "5. Guardrails Agent validates output"
    ),
)
async def submit_clinical_query(
    request: ClinicalQueryRequest,
    service: ClinicalQueryService = Depends(get_query_service),
) -> ClinicalResponse:
    """Submit a clinical query for AI-powered decision support."""
    try:
        response = await service.process_query(
            query_text=request.text,
            patient_id=request.patient_id,
            session_id=request.session_id,
        )
        return response

    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc
    except AzureServiceError as exc:
        logger.error(
            "Azure service error during query processing",
            extra={"error": exc.message},
        )
        raise HTTPException(
            status_code=502,
            detail="An upstream service error occurred. Please try again later.",
        ) from exc
    except CDSSError as exc:
        logger.error(
            "CDSS error during query processing",
            extra={"error": exc.message},
        )
        raise HTTPException(status_code=500, detail=exc.message) from exc


@router.get(
    "/api/v1/query/stream",
    tags=["Clinical"],
    summary="Stream clinical query response via GET",
    description="Stream clinical query response via Server-Sent Events using GET with query parameters. Compatible with EventSource API.",
)
async def stream_clinical_query_get(
    query: str = Query(..., min_length=1, max_length=5000, description="The clinical query text."),
    patient_id: str | None = Query(None, description="Optional patient ID for context."),
    session_id: str | None = Query(None, description="Optional session ID for conversation continuity."),
    service: ClinicalQueryService = Depends(get_query_service),
) -> StreamingResponse:
    """Stream clinical query response via Server-Sent Events using GET.

    This endpoint accepts query parameters instead of JSON body to support
    EventSource API which only supports GET requests.

    Returns a streaming response where each event is a JSON-encoded
    progress update or partial result.
    """

    async def event_generator():
        try:
            yield _sse_event(
                "processing",
                {
                    "status": "started",
                    "message": "Processing clinical query...",
                    "session_id": session_id or str(uuid4()),
                },
            )

            yield _sse_event(
                "progress",
                {
                    "phase": "planning",
                    "message": "Analyzing query and creating execution plan...",
                },
            )

            response = await service.process_query(
                query_text=query,
                patient_id=patient_id,
                session_id=session_id,
            )

            for agent_name, agent_output in response.agent_outputs.items():
                yield _sse_event(
                    "agent_result",
                    {
                        "agent": agent_name,
                        "summary": agent_output.summary,
                        "sources_retrieved": agent_output.sources_retrieved,
                        "latency_ms": agent_output.latency_ms,
                    },
                )

            if response.drug_alerts:
                yield _sse_event(
                    "drug_alerts",
                    {
                        "alerts": [
                            {
                                "severity": alert.severity,
                                "description": alert.description,
                                "source": alert.source,
                            }
                            for alert in response.drug_alerts
                        ]
                    },
                )

            yield _sse_event(
                "complete",
                response.model_dump(mode="json"),
            )

        except CDSSError as exc:
            yield _sse_event(
                "error",
                {"message": exc.message, "type": type(exc).__name__},
            )
        except Exception as exc:
            logger.error("Stream error", extra={"error": str(exc)}, exc_info=True)
            yield _sse_event(
                "error",
                {"message": "An unexpected error occurred.", "type": "InternalError"},
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/api/v1/query/stream",
    tags=["Clinical"],
    summary="Stream clinical query response",
    description="Stream clinical query response via Server-Sent Events.",
)
async def stream_clinical_query(
    request: ClinicalQueryRequest,
    service: ClinicalQueryService = Depends(get_query_service),
) -> StreamingResponse:
    """Stream clinical query response via Server-Sent Events.

    Returns a streaming response where each event is a JSON-encoded
    progress update or partial result.
    """

    async def event_generator():
        """Generate SSE events for the clinical query."""
        try:
            yield _sse_event(
                "processing",
                {
                    "status": "started",
                    "message": "Processing clinical query...",
                    "session_id": request.session_id or str(uuid4()),
                },
            )

            yield _sse_event(
                "progress",
                {
                    "phase": "planning",
                    "message": "Analyzing query and creating execution plan...",
                },
            )

            response = await service.process_query(
                query_text=request.text,
                patient_id=request.patient_id,
                session_id=request.session_id,
            )

            for agent_name, agent_output in response.agent_outputs.items():
                yield _sse_event(
                    "agent_result",
                    {
                        "agent": agent_name,
                        "summary": agent_output.summary,
                        "sources_retrieved": agent_output.sources_retrieved,
                        "latency_ms": agent_output.latency_ms,
                    },
                )

            if response.drug_alerts:
                yield _sse_event(
                    "drug_alerts",
                    {
                        "alerts": [
                            {
                                "severity": alert.severity,
                                "description": alert.description,
                                "source": alert.source,
                            }
                            for alert in response.drug_alerts
                        ]
                    },
                )

            yield _sse_event(
                "complete",
                response.model_dump(mode="json"),
            )

        except CDSSError as exc:
            yield _sse_event(
                "error",
                {"message": exc.message, "type": type(exc).__name__},
            )
        except Exception as exc:
            logger.error("Stream error", extra={"error": str(exc)}, exc_info=True)
            yield _sse_event(
                "error",
                {"message": "An unexpected error occurred.", "type": "InternalError"},
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse_event(event_type: str, data: dict) -> str:
    json_data = json.dumps(data, default=str)
    return f"event: {event_type}\ndata: {json_data}\n\n"


# ==========================================================================
# Patient Endpoints
# ==========================================================================


@router.get(
    "/api/v1/patients",
    tags=["Patients"],
    summary="Search patients",
)
async def search_patients(
    search: str | None = Query(None, description="Search query string."),
    page: int = Query(1, ge=1, le=100, description="Page number."),
    limit: int = Query(100, description="Maximum results per page."),
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Search patients by name and other criteria.

    Args:
        search: Search query string.
        page: Page number.
        limit: Maximum results per page.
        service: Injected query service.

    Returns:
        Dictionary with pagination metadata and patient list.
    """
    try:
        return await service.search_patients(
            search=search,
            page=page,
            limit=limit,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc
    except AzureServiceError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@router.get(
    "/api/v1/patients/{patient_id}",
    tags=["Patients"],
    summary="Get patient profile",
)
async def get_patient_profile(
    patient_id: str,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Retrieve a patient profile by ID.

    Args:
        patient_id: The unique patient identifier.
        service: Injected query service.

    Returns:
        The patient profile data.
    """
    try:
        profile = await service.get_patient_profile(patient_id)
        if profile is None:
            raise HTTPException(
                status_code=404,
                detail=f"Patient '{patient_id}' not found.",
            )
        return profile

    except HTTPException:
        raise
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc
    except AzureServiceError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@router.put(
    "/api/v1/patients/{patient_id}",
    tags=["Patients"],
    summary="Update patient profile",
)
async def update_patient_profile(
    patient_id: str,
    profile: dict,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Create or update a patient profile.

    Args:
        patient_id: The unique patient identifier.
        profile: The profile data to upsert.
        service: Injected query service.

    Returns:
        The upserted patient profile data.
    """
    try:
        result = await service.update_patient_profile(patient_id, profile)
        return result

    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc
    except AzureServiceError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


# ==========================================================================
# Conversation Endpoints
# ==========================================================================


@router.get(
    "/api/v1/conversations/{session_id}",
    tags=["Conversations"],
    summary="Get conversation history",
)
async def get_conversation_history(
    session_id: str,
    limit: int = Query(20, ge=1, le=100, description="Max turns to return."),
    service: ClinicalQueryService = Depends(get_query_service),
) -> list[dict]:
    """Retrieve conversation history for a session.

    Args:
        session_id: The session identifier.
        limit: Maximum number of conversation turns.
        service: Injected query service.

    Returns:
        List of conversation turn dictionaries.
    """
    try:
        history = await service.get_conversation_history(
            session_id=session_id,
            limit=limit,
        )
        return history

    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc
    except AzureServiceError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


@router.post(
    "/api/v1/conversations/{conversation_id}/feedback",
    tags=["Conversations"],
    summary="Submit feedback",
)
async def submit_feedback(
    conversation_id: str,
    feedback: FeedbackRequest,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Submit clinician feedback on a response.

    Args:
        conversation_id: The conversation turn ID to provide feedback for.
        feedback: The feedback data (rating and optional correction).
        service: Injected query service.

    Returns:
        Confirmation of the feedback submission.
    """
    try:
        result = await service.submit_feedback(
            conversation_id=conversation_id,
            rating=feedback.rating,
            correction=feedback.correction,
        )
        return result

    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.message) from exc
    except AzureServiceError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc


# ==========================================================================
# Document Ingestion Endpoints
# ==========================================================================

# Process-local fallback store for ingestion status. Primary persistence for
# production runs is Cosmos DB via ClinicalQueryService.cosmos_client.
_ingestion_status: dict[str, dict] = {}
_INGESTION_STATUS_PARTITION_KEY = "ingestion_status"
_INGESTION_STATUS_DOC_TYPE = "ingestion_status"


def _resolve_ingestion_status_client(query_service: ClinicalQueryService) -> object | None:
    cosmos_client = getattr(query_service, "cosmos_client", None)
    if cosmos_client is None:
        return None
    if not hasattr(cosmos_client, "upsert_ingestion_status"):
        return None
    if not hasattr(cosmos_client, "get_ingestion_status"):
        return None
    return cosmos_client


async def _persist_ingestion_status(
    query_service: ClinicalQueryService,
    document_id: str,
    status_payload: dict,
) -> None:
    _ingestion_status[document_id] = status_payload

    cosmos_client = _resolve_ingestion_status_client(query_service)
    if cosmos_client is None:
        return

    try:
        await cosmos_client.upsert_ingestion_status(
            document_id=document_id,
            status=status_payload,
            partition_key=_INGESTION_STATUS_PARTITION_KEY,
            doc_type=_INGESTION_STATUS_DOC_TYPE,
        )
    except Exception as exc:
        logger.warning(
            "Failed to persist ingestion status to Cosmos DB; using in-memory fallback",
            extra={
                "document_id": document_id,
                "error": str(exc),
            },
        )


async def _update_ingestion_status(
    query_service: ClinicalQueryService,
    document_id: str,
    **updates: object,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    current = dict(_ingestion_status.get(document_id, {"document_id": document_id}))
    current.update(updates)
    current["document_id"] = document_id
    current["updated_at"] = str(updates.get("updated_at", now))
    if not current.get("created_at"):
        current["created_at"] = now

    await _persist_ingestion_status(query_service, document_id, current)
    return current


async def _get_ingestion_status_record(
    query_service: ClinicalQueryService,
    document_id: str,
) -> dict | None:
    cosmos_client = _resolve_ingestion_status_client(query_service)
    if cosmos_client is not None:
        try:
            persisted = await cosmos_client.get_ingestion_status(
                document_id=document_id,
                partition_key=_INGESTION_STATUS_PARTITION_KEY,
            )
            if persisted is not None:
                _ingestion_status[document_id] = persisted
                return persisted
        except Exception as exc:
            logger.warning(
                "Failed to read ingestion status from Cosmos DB; using in-memory fallback",
                extra={
                    "document_id": document_id,
                    "error": str(exc),
                },
            )

    return _ingestion_status.get(document_id)


async def _delete_ingestion_status_record(
    query_service: ClinicalQueryService,
    document_id: str,
) -> None:
    _ingestion_status.pop(document_id, None)

    cosmos_client = getattr(query_service, "cosmos_client", None)
    if cosmos_client is None:
        return
    if not hasattr(cosmos_client, "delete_ingestion_status"):
        return

    try:
        await cosmos_client.delete_ingestion_status(
            document_id=document_id,
            partition_key=_INGESTION_STATUS_PARTITION_KEY,
        )
    except Exception as exc:
        logger.warning(
            "Failed to delete ingestion status from Cosmos DB; local status removed",
            extra={
                "document_id": document_id,
                "error": str(exc),
            },
        )


def _resolve_logical_index_for_document_type(normalized_document_type: str) -> str:
    if normalized_document_type == "clinical_guideline":
        return INDEX_TREATMENT_PROTOCOLS
    if normalized_document_type == "pubmed_abstract":
        return INDEX_MEDICAL_LITERATURE
    return INDEX_PATIENT_RECORDS


def _resolve_workspace_target(normalized_document_type: str) -> str:
    if normalized_document_type == "clinical_guideline":
        return "protocol"
    if normalized_document_type == "pubmed_abstract":
        return "literature"
    return "query_patient_context"


def _build_content_preview(content: str, max_len: int = 180) -> str:
    compact = " ".join(content.split())
    if len(compact) <= max_len:
        return compact
    return f"{compact[: max_len - 3]}..."


@router.post(
    "/api/v1/documents/ingest",
    tags=["Documents"],
    summary="Ingest a medical document",
)
async def ingest_document(
    request: Request,
    file: UploadFile = File(...),
    document_type: str | None = Form(
        default=None,
        description="Document type: 'protocol', 'patient_record', 'literature'.",
    ),
    patient_id: str | None = Form(
        default=None,
        description="Optional patient ID to associate the document with.",
    ),
    metadata: str | None = Form(
        default=None,
        description="Optional JSON metadata payload as string.",
    ),
    background_tasks: BackgroundTasks = None,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Ingest a medical document (PDF) for processing.

    The document is validated, assigned an ID, and submitted for
    background processing.  Use the ``/documents/{document_id}/status``
    endpoint to track progress.

    Args:
        file: The uploaded file.
        document_type: Type classification for the document.
        patient_id: Optional patient association.
        background_tasks: FastAPI background task manager.

    Returns:
        A dictionary with the assigned ``document_id`` and initial status.
    """
    # Validate file type
    valid_content_types = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    }
    content_type = file.content_type or ""
    if content_type not in valid_content_types:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{content_type}'. Accepted types: {', '.join(sorted(valid_content_types))}."
            ),
        )

    # Query parameter fallback for backward compatibility.
    if document_type is None:
        document_type = request.query_params.get("document_type")
    if patient_id is None:
        patient_id = request.query_params.get("patient_id")

    if document_type is None:
        raise HTTPException(
            status_code=422,
            detail="Missing required document_type. Provide it in multipart form or as query parameter.",
        )

    metadata_payload: dict[str, object] | None = None
    if metadata:
        try:
            parsed = json.loads(metadata)
            metadata_payload = parsed if isinstance(parsed, dict) else {"value": parsed}
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid metadata JSON: {exc}") from exc

    document_type_map = {
        "patient_record": "generic",
        "protocol": "clinical_guideline",
        "literature": "pubmed_abstract",
        "lab_report": "lab_report",
        "prescription": "prescription",
        "discharge_summary": "discharge_summary",
        "radiology_report": "radiology_report",
        "clinical_guideline": "clinical_guideline",
        "pubmed_abstract": "pubmed_abstract",
        "generic": "generic",
    }
    if document_type not in document_type_map:
        raise HTTPException(
            status_code=400,
            detail=(f"Invalid document_type '{document_type}'. Valid types: {', '.join(sorted(document_type_map))}."),
        )
    normalized_document_type = document_type_map[document_type]

    document_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Read file content
    try:
        file_content = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read uploaded file: {exc}",
        ) from exc

    # Initialize ingestion status (durable in Cosmos DB, in-memory fallback)
    await _persist_ingestion_status(
        service,
        document_id,
        {
            "document_id": document_id,
            "filename": file.filename,
            "document_type": document_type,
            "normalized_document_type": normalized_document_type,
            "patient_id": patient_id,
            "metadata": metadata_payload or {},
            "status": "pending",
            "progress": 0,
            "created_at": now,
            "updated_at": now,
            "error": None,
        },
    )

    # Schedule background processing
    if background_tasks is not None:
        background_tasks.add_task(
            _process_document_background,
            query_service=service,
            document_id=document_id,
            file_content=file_content,
            filename=file.filename or "unknown",
            document_type=document_type,
            normalized_document_type=normalized_document_type,
            patient_id=patient_id,
            metadata=metadata_payload,
        )
        return {
            "document_id": document_id,
            "status": "pending",
            "message": "Document accepted for processing.",
        }

    await _process_document_background(
        query_service=service,
        document_id=document_id,
        file_content=file_content,
        filename=file.filename or "unknown",
        document_type=document_type,
        normalized_document_type=normalized_document_type,
        patient_id=patient_id,
        metadata=metadata_payload,
    )

    final_status = await _get_ingestion_status_record(service, document_id) or {
        "status": "unknown"
    }
    return {
        "document_id": document_id,
        "status": final_status["status"],
        "message": final_status.get("message", "Document processing finished."),
    }


async def _process_document_background(
    query_service: ClinicalQueryService,
    document_id: str,
    file_content: bytes,
    filename: str,
    document_type: str,
    normalized_document_type: str,
    patient_id: str | None,
    metadata: dict[str, object] | None,
) -> None:
    """Background task that processes an ingested document.

    Performs PDF text extraction, chunking, embedding generation, and
    indexing into Azure AI Search.

    Args:
        document_id: The assigned document identifier.
        file_content: Raw file bytes.
        filename: Original filename.
        document_type: Document type classification.
        patient_id: Optional associated patient ID.
    """
    try:
        await _update_ingestion_status(
            query_service,
            document_id,
            status="processing",
            progress=10,
        )

        ingestion_service = query_service.ingestion_service

        if document_type == "protocol":
            metadata_dict = metadata or {}
            specialty = str(metadata_dict.get("specialty", "general"))
            guideline_name = str(metadata_dict.get("guideline_name") or metadata_dict.get("guideline") or filename)
            version = str(metadata_dict.get("version", "1.0"))

            result = await ingestion_service.ingest_protocol(
                file_bytes=file_content,
                specialty=specialty,
                guideline_name=guideline_name,
                version=version,
                metadata=metadata,
            )
        else:
            result = await ingestion_service.ingest_patient_document(
                file_bytes=file_content,
                document_type=normalized_document_type,
                patient_id=patient_id,
                metadata=metadata,
            )

        result_status = str(result.get("status", "completed"))
        await _update_ingestion_status(
            query_service,
            document_id,
            status=result_status,
            progress=100,
            pipeline_document_id=result.get("document_id"),
            message=str(result.get("message", "Document processing completed.")),
            details=result,
            error=None,
        )

        logger.info(
            "Document processing completed",
            extra={
                "document_id": document_id,
                "source_filename": filename,
                "document_type": document_type,
                "metadata_keys": sorted((metadata or {}).keys()),
                "pipeline_document_id": result.get("document_id"),
            },
        )

    except Exception as exc:
        await _update_ingestion_status(
            query_service,
            document_id,
            status="failed",
            progress=100,
            error=str(exc),
        )

        logger.error(
            "Document processing failed",
            extra={"document_id": document_id, "error": str(exc)},
        )


@router.get(
    "/api/v1/documents/{document_id}/status",
    tags=["Documents"],
    summary="Check document ingestion status",
)
async def get_ingestion_status(
    document_id: str,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Check the status of a document ingestion job.

    Args:
        document_id: The document identifier returned by the ingest endpoint.

    Returns:
        A dictionary with status, progress percentage, and any errors.
    """
    status = await _get_ingestion_status_record(service, document_id)
    if status is None:
        raise HTTPException(
            status_code=404,
            detail=f"Document '{document_id}' not found.",
        )
    return status


@router.post(
    "/api/v1/documents/{document_id}/verify",
    tags=["Documents"],
    summary="Verify indexed chunks and phrase retrieval for an ingested document",
)
async def verify_document_index_and_retrieval(
    document_id: str,
    request: DocumentVerificationRequest,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Verify that a document was indexed and can be retrieved by phrase.

    This endpoint is intended for UI-native validation flows and returns
    index proof (chunk presence by document_id) plus optional retrieval proof
    for a provided phrase.
    """
    status = await _get_ingestion_status_record(service, document_id)
    if status is None:
        raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found.")

    normalized_document_type = str(
        status.get("normalized_document_type")
        or status.get("document_type")
        or "generic"
    )
    pipeline_document_id = str(status.get("pipeline_document_id") or document_id)

    logical_index_name = _resolve_logical_index_for_document_type(normalized_document_type)
    workspace_target = _resolve_workspace_target(normalized_document_type)

    try:
        search_client = AzureSearchClient(settings=service.settings)

        indexed_hits = await search_client.search_document_chunks(
            index_name=logical_index_name,
            document_id=pipeline_document_id,
            search_text="*",
            top=request.top,
        )

        phrase = (request.phrase or "").strip()
        phrase_hits: list[dict] = []
        if phrase:
            phrase_hits = await search_client.search_document_chunks(
                index_name=logical_index_name,
                document_id=pipeline_document_id,
                search_text=phrase,
                top=request.top,
            )

        def normalize_hit(hit: dict) -> dict:
            return {
                "id": hit.get("id", ""),
                "chunk_index": hit.get("chunk_index"),
                "score": hit.get("score", 0.0),
                "content_preview": _build_content_preview(str(hit.get("content", ""))),
            }

        return {
            "document_id": document_id,
            "pipeline_document_id": pipeline_document_id,
            "document_type": str(status.get("document_type", "unknown")),
            "normalized_document_type": normalized_document_type,
            "workspace_target": workspace_target,
            "logical_index_name": logical_index_name,
            "physical_index_name": search_client.resolve_index_name(logical_index_name),
            "indexed_chunks_count": len(indexed_hits),
            "indexed_chunks": [normalize_hit(hit) for hit in indexed_hits],
            "phrase": phrase or None,
            "phrase_hits_count": len(phrase_hits),
            "phrase_hits": [normalize_hit(hit) for hit in phrase_hits],
        }
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Document verification failed: {exc}",
        ) from exc


@router.delete(
    "/api/v1/documents/{document_id}",
    tags=["Documents"],
    summary="Delete an ingested document and its indexed chunks",
)
async def delete_ingested_document(
    document_id: str,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Delete indexed chunks and ingestion status for an uploaded document."""
    status = await _get_ingestion_status_record(service, document_id)
    if status is None:
        raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found.")

    current_status = str(status.get("status", "")).lower()
    if current_status in {"pending", "queued", "processing"}:
        raise HTTPException(
            status_code=409,
            detail="Document is still processing. Wait until completion before deletion.",
        )

    normalized_document_type = str(
        status.get("normalized_document_type")
        or status.get("document_type")
        or "generic"
    )
    pipeline_document_id = str(status.get("pipeline_document_id") or document_id)
    logical_index_name = _resolve_logical_index_for_document_type(normalized_document_type)

    try:
        search_client = AzureSearchClient(settings=service.settings)
        delete_summary = await search_client.delete_document_chunks(
            index_name=logical_index_name,
            document_id=pipeline_document_id,
        )

        if int(delete_summary.get("failed_count", 0)) > 0:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Document deletion was only partially successful. "
                    "Some indexed chunks failed to delete; retry the operation."
                ),
            )

        await _delete_ingestion_status_record(service, document_id)

        return {
            "document_id": document_id,
            "pipeline_document_id": pipeline_document_id,
            "normalized_document_type": normalized_document_type,
            "logical_index_name": logical_index_name,
            "physical_index_name": search_client.resolve_index_name(logical_index_name),
            "deleted_chunks_count": int(delete_summary.get("deleted_count", 0)),
            "status": "deleted",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Document deletion failed: {exc}",
        ) from exc


# ==========================================================================
# Drug Safety Endpoints
# ==========================================================================


@router.post(
    "/api/v1/drugs/interactions",
    tags=["Drug Safety"],
    summary="Check drug interactions",
)
async def check_drug_interactions(
    request: DrugInteractionRequest,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Check drug-drug interactions for a list of medications.

    Normalizes incoming medication names and runs the dedicated
    ``DrugSafetyAgent`` directly to produce deterministic interaction output.

    Args:
        request: The drug interaction check request.
        service: Injected query service.

    Returns:
        Drug interaction results including alerts and alternatives.
    """
    def normalize_medication_names(items: list[str | MedicationNameRequest]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for item in items:
            raw_name = item if isinstance(item, str) else item.name
            name = raw_name.strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(name)
        return normalized

    current_medications = normalize_medication_names(list(request.medications))
    proposed_medications = normalize_medication_names(list(request.proposed_medications or []))
    all_medications = [*current_medications, *proposed_medications]

    if len(all_medications) < 2:
        raise HTTPException(
            status_code=422,
            detail="At least two medication names are required for interaction analysis.",
        )

    try:
        drug_safety_agent = DrugSafetyAgent(settings=service.settings)
        task = AgentTask(
            from_agent="api",
            to_agent="drug_safety",
            message_type="task_request",
            payload={
                "query": (
                    "Check drug-drug interactions for the following medications: "
                    f"{', '.join(all_medications)}."
                ),
                "medications": current_medications,
                "proposed_medications": proposed_medications,
                "conditions": [],
                "allergies": [],
            },
            session_id=str(uuid4()),
            trace_id=str(uuid4()),
        )
        output = await drug_safety_agent.execute(task)
        interactions_data = output.raw_data or {}
        report_data = interactions_data.get("drug_safety_report", {})
        raw_alerts = interactions_data.get("drug_alerts", interactions_data.get("alerts", []))
        interactions = report_data.get("interactions", interactions_data.get("interactions", []))

        return {
            "medications_checked": current_medications,
            "proposed_medications": proposed_medications,
            "interactions": interactions,
            "alerts": [
                {
                    "severity": alert.get("severity", "moderate"),
                    "description": alert.get("description", ""),
                    "source": alert.get("source", "unknown"),
                    "evidence_level": int(alert.get("evidence_level", 2) or 2),
                    "alternatives": alert.get("alternatives", []),
                }
                for alert in raw_alerts
            ],
            "adverse_events": report_data.get("adverse_events", []),
            "alternatives": report_data.get("alternatives", []),
            "dosage_adjustments": report_data.get("dosage_adjustments", []),
            "summary": interactions_data.get("summary", "Interaction analysis completed."),
        }

    except DrugSafetyError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
    except CDSSError as exc:
        raise HTTPException(status_code=500, detail=exc.message) from exc


@router.get(
    "/api/v1/drugs/{drug_name}/info",
    tags=["Drug Safety"],
    summary="Get drug information",
)
async def get_drug_info(
    drug_name: str,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Get drug information and known interactions.

    Args:
        drug_name: The name of the drug to look up.
        service: Injected query service.

    Returns:
        Drug information including known interactions and safety data.
    """
    query_text = (
        f"Provide comprehensive drug information for {drug_name}, "
        f"including known interactions, contraindications, and common side effects."
    )

    try:
        response = await service.process_query(query_text=query_text)
        return {
            "drug_name": drug_name,
            "information": response.recommendation,
            "alerts": [
                {
                    "severity": alert.severity,
                    "description": alert.description,
                    "source": alert.source,
                }
                for alert in response.drug_alerts
            ],
            "citations": [
                {
                    "source_type": c.source_type,
                    "identifier": c.identifier,
                    "title": c.title,
                    "url": c.url,
                }
                for c in response.citations
            ],
        }

    except CDSSError as exc:
        raise HTTPException(status_code=500, detail=exc.message) from exc


# ==========================================================================
# Search Endpoints
# ==========================================================================


@router.post(
    "/api/v1/search/literature",
    tags=["Search"],
    summary="Search medical literature",
)
async def search_literature(
    request: LiteratureSearchRequest,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Search PubMed and cached medical literature.

    Routes the search query through the orchestrator's literature agent
    for a comprehensive search across cached indexes and live PubMed.

    Args:
        request: The literature search request.
        service: Injected query service.

    Returns:
        Search results with articles and relevance scores.
    """
    try:
        query_text = request.query
        if request.date_from:
            query_text += f" (date_from: {request.date_from})"
        if request.date_range:
            start = request.date_range.get("start", "").strip()
            end = request.date_range.get("end", "").strip()
            if start or end:
                query_text += f" (publication_date_range: {start or 'any'} to {end or 'any'})"
        if request.article_types:
            filtered_types = [t.strip() for t in request.article_types if t and t.strip()]
            if filtered_types:
                query_text += f" (article_types: {', '.join(filtered_types)})"

        response = await service.process_query(query_text=query_text)

        literature_output = response.agent_outputs.get("literature")
        articles = []
        if literature_output and literature_output.raw_data:
            raw = literature_output.raw_data
            if isinstance(raw.get("papers"), list):
                articles = raw.get("papers", [])
            elif isinstance(raw.get("articles"), list):
                articles = raw.get("articles", [])
            elif isinstance(raw.get("literature_evidence"), dict):
                evidence = raw.get("literature_evidence", {})
                papers = evidence.get("papers", [])
                if isinstance(papers, list):
                    articles = papers

        return {
            "query": request.query,
            "total_results": len(articles),
            "articles": articles[: request.max_results],
            "papers": articles[: request.max_results],
            "evidence_summary": response.evidence_summary,
            "citations": [c.model_dump(mode="json") for c in response.citations],
        }

    except CDSSError as exc:
        raise HTTPException(status_code=500, detail=exc.message) from exc


@router.post(
    "/api/v1/search/protocols",
    tags=["Search"],
    summary="Search clinical protocols",
)
async def search_protocols(
    request: ProtocolSearchRequest,
    service: ClinicalQueryService = Depends(get_query_service),
) -> dict:
    """Search treatment protocols and clinical guidelines.

    Routes the search through the orchestrator's protocol agent.

    Args:
        request: The protocol search request.
        service: Injected query service.

    Returns:
        Matching protocols with evidence grades and recommendations.
    """
    query_text = request.query
    if request.specialty:
        query_text += f" (specialty: {request.specialty})"
    if request.evidence_grade:
        query_text += f" (evidence grade: {request.evidence_grade})"

    try:
        response = await service.process_query(query_text=query_text)

        protocol_output = response.agent_outputs.get("protocol")
        protocols = []
        if protocol_output and protocol_output.raw_data:
            protocols = protocol_output.raw_data.get("protocols", [])

        return {
            "query": request.query,
            "specialty": request.specialty,
            "evidence_grade": request.evidence_grade,
            "total_results": len(protocols),
            "protocols": protocols,
            "summary": response.recommendation,
        }

    except CDSSError as exc:
        raise HTTPException(status_code=500, detail=exc.message) from exc


# ==========================================================================
# Admin / Health Endpoints
# ==========================================================================


@router.get(
    "/api/v1/health",
    tags=["System"],
    summary="Health check",
)
async def health_check() -> dict:
    """Health check endpoint.

    Returns basic service health information including version and status.

    Returns:
        Service health status dictionary.
    """
    return {
        "status": "healthy",
        "version": "0.1.0",
        "service": "cdss-agentic-rag",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get(
    "/api/v1/audit",
    tags=["Admin"],
    summary="Get audit trail",
)
async def get_audit_trail(
    patient_id: str | None = Query(None, description="Filter by patient ID."),
    date_from: str | None = Query(None, description="Start date filter (ISO 8601)."),
    date_to: str | None = Query(None, description="End date filter (ISO 8601)."),
    limit: int = Query(100, ge=1, le=1000, description="Max events to return."),
    service: ClinicalQueryService = Depends(get_query_service),
) -> list[dict]:
    """Retrieve the audit trail with optional filtering.

    Provides access to HIPAA-compliant audit log entries. In production,
    this endpoint should be restricted to admin roles.

    Args:
        patient_id: Optional patient ID filter.
        date_from: Optional start date.
        date_to: Optional end date.
        limit: Maximum number of entries.
        service: Injected query service.

    Returns:
        List of audit log entry dictionaries.
    """
    if service.cosmos_client is None:
        raise HTTPException(
            status_code=503,
            detail="Audit logging is not available (Cosmos DB not configured).",
        )

    try:
        trail = await service.cosmos_client.get_audit_trail(
            patient_id=patient_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
        return trail

    except AzureServiceError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
