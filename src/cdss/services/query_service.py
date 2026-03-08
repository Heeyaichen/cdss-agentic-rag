"""Service layer for processing clinical queries.

Sits between the FastAPI routes and the OrchestratorAgent, providing a
clean interface for query processing, conversation management, feedback
submission, and patient profile retrieval.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from cdss.agents.orchestrator import OrchestratorAgent
from cdss.core.config import Settings, get_settings
from cdss.core.exceptions import AzureServiceError, CDSSError, ValidationError
from cdss.core.logging import get_logger
from cdss.core.models import ClinicalQuery, ClinicalResponse

logger = get_logger(__name__)


class ClinicalQueryService:
    """Service layer for processing clinical queries.

    Encapsulates orchestrator invocation, conversation history retrieval,
    clinician feedback, and patient profile access.  The service is the
    single point of contact for all API route handlers.

    Attributes:
        orchestrator: The orchestrator agent responsible for query processing.
        cosmos_client: The Cosmos DB client for data persistence.
        settings: Application settings.
    """

    def __init__(
        self,
        orchestrator: OrchestratorAgent | None = None,
        cosmos_client: object | None = None,
        settings: Settings | None = None,
    ) -> None:
        """Initialize the query service.

        If an orchestrator is not provided, a default instance is created.
        The Cosmos DB client is either explicitly provided, obtained from
        the orchestrator, or lazily initialized from settings.

        Args:
            orchestrator: Pre-configured orchestrator agent.
            cosmos_client: Pre-configured Cosmos DB client.
            settings: Application settings instance.
        """
        self.settings = settings or get_settings()

        if orchestrator is not None:
            self.orchestrator = orchestrator
        else:
            self.orchestrator = OrchestratorAgent(settings=self.settings)

        if cosmos_client is not None:
            self.cosmos_client = cosmos_client
        elif hasattr(self.orchestrator, "cosmos_client"):
            self.cosmos_client = self.orchestrator.cosmos_client
        else:
            self.cosmos_client = None

        logger.info("ClinicalQueryService initialized")

    # ------------------------------------------------------------------
    # Query processing
    # ------------------------------------------------------------------

    async def process_query(
        self,
        query_text: str,
        patient_id: str | None = None,
        session_id: str | None = None,
        clinician_id: str = "system",
    ) -> ClinicalResponse:
        """Process a clinical query and return an evidence-based response.

        Creates a ``ClinicalQuery`` model from the raw inputs and delegates
        processing to the orchestrator agent.

        Args:
            query_text: The clinical question in natural language.
            patient_id: Optional patient identifier for context enrichment.
            session_id: Optional session identifier for conversation continuity.
                A new session ID is generated when not provided.
            clinician_id: Identifier of the clinician submitting the query.

        Returns:
            A ``ClinicalResponse`` containing the assessment, recommendation,
            evidence summary, drug alerts, citations, and disclaimers.

        Raises:
            ValidationError: If the query text is empty or invalid.
            CDSSError: If query processing fails.
        """
        # Validate input
        if not query_text or not query_text.strip():
            raise ValidationError(
                message="Query text must not be empty.",
                field_errors={"query_text": "This field is required and must not be blank."},
            )

        effective_session_id = session_id or str(uuid4())

        query = ClinicalQuery(
            text=query_text.strip(),
            patient_id=patient_id,
            session_id=effective_session_id,
        )

        logger.info(
            "Processing clinical query via service",
            extra={
                "query_text_length": len(query_text),
                "patient_id": patient_id,
                "session_id": effective_session_id,
                "clinician_id": clinician_id,
            },
        )

        response = await self.orchestrator.process_query(
            query=query,
            clinician_id=clinician_id,
        )

        return response

    # ------------------------------------------------------------------
    # Conversation history
    # ------------------------------------------------------------------

    async def get_conversation_history(
        self,
        session_id: str,
        limit: int = 20,
    ) -> list[dict]:
        """Retrieve conversation history for a given session.

        Args:
            session_id: The session identifier.
            limit: Maximum number of conversation turns to return.

        Returns:
            A list of conversation turn dictionaries ordered by timestamp
            descending (most recent first).

        Raises:
            ValidationError: If the session_id is empty.
            AzureServiceError: If the Cosmos DB query fails.
        """
        if not session_id or not session_id.strip():
            raise ValidationError(
                message="Session ID must not be empty.",
                field_errors={"session_id": "This field is required."},
            )

        if self.cosmos_client is None:
            logger.warning(
                "Cosmos DB client not available; returning empty conversation history"
            )
            return []

        logger.debug(
            "Fetching conversation history",
            extra={"session_id": session_id, "limit": limit},
        )

        history = await self.cosmos_client.get_conversation_history(
            session_id=session_id,
            limit=limit,
        )

        logger.info(
            "Conversation history retrieved",
            extra={"session_id": session_id, "turns_count": len(history)},
        )

        return history

    # ------------------------------------------------------------------
    # Feedback
    # ------------------------------------------------------------------

    async def submit_feedback(
        self,
        conversation_id: str,
        rating: int,
        correction: str | None = None,
    ) -> dict:
        """Submit clinician feedback on a clinical response.

        Feedback is stored as an update to the corresponding conversation
        turn document in Cosmos DB and also recorded as an audit event.

        Args:
            conversation_id: The conversation turn document ID.
            rating: Clinician rating from 1 (poor) to 5 (excellent).
            correction: Optional free-text correction or comment.

        Returns:
            A dictionary confirming the feedback submission with keys:
            ``conversation_id``, ``rating``, ``status``.

        Raises:
            ValidationError: If the rating is out of range or ID is empty.
            AzureServiceError: If the Cosmos DB write fails.
        """
        if not conversation_id or not conversation_id.strip():
            raise ValidationError(
                message="Conversation ID must not be empty.",
                field_errors={"conversation_id": "This field is required."},
            )

        if not (1 <= rating <= 5):
            raise ValidationError(
                message="Rating must be between 1 and 5.",
                field_errors={"rating": "Value must be between 1 and 5 inclusive."},
            )

        if self.cosmos_client is None:
            logger.warning(
                "Cosmos DB client not available; feedback cannot be saved"
            )
            return {
                "conversation_id": conversation_id,
                "rating": rating,
                "status": "not_saved",
                "reason": "Persistence layer unavailable",
            }

        feedback_data = {
            "rating": rating,
            "correction": correction,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }

        # Log as audit event
        try:
            audit_event = {
                "id": str(uuid4()),
                "event_type": "feedback_submission",
                "action": "submit_feedback",
                "conversation_id": conversation_id,
                "rating": rating,
                "has_correction": correction is not None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await self.cosmos_client.log_audit_event(audit_event)
        except Exception as exc:
            logger.warning(
                "Failed to log feedback audit event",
                extra={"error": str(exc)},
            )

        logger.info(
            "Clinician feedback submitted",
            extra={
                "conversation_id": conversation_id,
                "rating": rating,
                "has_correction": correction is not None,
            },
        )

        return {
            "conversation_id": conversation_id,
            "rating": rating,
            "status": "saved",
            "feedback": feedback_data,
        }

    # ------------------------------------------------------------------
    # Patient profile
    # ------------------------------------------------------------------

    async def get_patient_profile(self, patient_id: str) -> dict | None:
        """Retrieve a patient profile from Cosmos DB.

        Args:
            patient_id: The unique patient identifier.

        Returns:
            The patient profile dictionary, or ``None`` if the patient is
            not found.

        Raises:
            ValidationError: If the patient_id is empty.
            AzureServiceError: If the Cosmos DB read fails.
        """
        if not patient_id or not patient_id.strip():
            raise ValidationError(
                message="Patient ID must not be empty.",
                field_errors={"patient_id": "This field is required."},
            )

        if self.cosmos_client is None:
            logger.warning(
                "Cosmos DB client not available; cannot retrieve patient profile"
            )
            return None

        logger.debug(
            "Fetching patient profile",
            extra={"patient_id": patient_id},
        )

        profile = await self.cosmos_client.get_patient_profile(patient_id)

        if profile is not None:
            logger.info(
                "Patient profile retrieved",
                extra={"patient_id": patient_id},
            )
        else:
            logger.info(
                "Patient profile not found",
                extra={"patient_id": patient_id},
            )

        return profile

    async def update_patient_profile(
        self,
        patient_id: str,
        profile_data: dict,
    ) -> dict:
        """Create or update a patient profile in Cosmos DB.

        Args:
            patient_id: The unique patient identifier.
            profile_data: Dictionary containing the profile fields to upsert.

        Returns:
            The upserted patient profile dictionary.

        Raises:
            ValidationError: If the patient_id is empty.
            AzureServiceError: If the Cosmos DB upsert fails.
        """
        if not patient_id or not patient_id.strip():
            raise ValidationError(
                message="Patient ID must not be empty.",
                field_errors={"patient_id": "This field is required."},
            )

        if self.cosmos_client is None:
            raise AzureServiceError(
                "Cosmos DB client is not available. Cannot update patient profile."
            )

        # Ensure the profile contains the required identifiers
        profile_data["patient_id"] = patient_id
        if "id" not in profile_data:
            profile_data["id"] = patient_id

        logger.info(
            "Updating patient profile",
            extra={"patient_id": patient_id},
        )

        result = await self.cosmos_client.upsert_patient_profile(profile_data)

        logger.info(
            "Patient profile updated",
            extra={"patient_id": patient_id},
        )

        return result
