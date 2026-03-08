"""Azure AI Search client wrapper for hybrid search with semantic ranking."""

from __future__ import annotations

from typing import Any

from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery

from cdss.core.config import Settings, get_settings
from cdss.core.exceptions import RetrieverError
from cdss.core.logging import get_logger

logger = get_logger(__name__)

# Index name constants
INDEX_PATIENT_RECORDS = "patient_records"
INDEX_TREATMENT_PROTOCOLS = "treatment_protocols"
INDEX_MEDICAL_LITERATURE = "medical_literature"

ALL_INDEXES = [INDEX_PATIENT_RECORDS, INDEX_TREATMENT_PROTOCOLS, INDEX_MEDICAL_LITERATURE]


class AzureSearchClient:
    """Wrapper for Azure AI Search with hybrid search + semantic ranking.

    Provides hybrid search (BM25 + vector) with optional semantic reranking
    across patient records, treatment protocols, and medical literature indexes.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize Azure AI Search client with connections to all indexes.

        Args:
            settings: Application settings. If None, loads from environment.
        """
        self._settings = settings or get_settings()
        self._credential = AzureKeyCredential(self._settings.azure_search_api_key)
        self._endpoint = self._settings.azure_search_endpoint

        self._clients: dict[str, SearchClient] = {}
        for index_name in ALL_INDEXES:
            self._clients[index_name] = SearchClient(
                endpoint=self._endpoint,
                index_name=index_name,
                credential=self._credential,
            )

        logger.info(
            "AzureSearchClient initialized",
            endpoint=self._endpoint,
            indexes=ALL_INDEXES,
        )

    def _get_client(self, index_name: str) -> SearchClient:
        """Get the SearchClient for a specific index.

        Args:
            index_name: Name of the search index.

        Returns:
            The SearchClient instance for the given index.

        Raises:
            RetrieverError: If the index name is not recognized.
        """
        client = self._clients.get(index_name)
        if client is None:
            raise RetrieverError(
                f"Unknown search index: '{index_name}'. "
                f"Valid indexes: {ALL_INDEXES}"
            )
        return client

    async def hybrid_search(
        self,
        index_name: str,
        query: str,
        query_vector: list[float] | None = None,
        filters: str | None = None,
        top: int = 50,
        semantic_config: str = "default",
    ) -> list[dict]:
        """Perform hybrid search (BM25 + vector) with optional semantic reranking.

        Combines keyword-based BM25 scoring with vector similarity search.
        When a query vector is provided, results are fused using Reciprocal
        Rank Fusion (RRF). Semantic reranking is applied on top for improved
        relevance.

        Args:
            index_name: Name of the search index to query.
            query: The text query for BM25 keyword search.
            query_vector: Optional embedding vector for vector search.
            filters: Optional OData filter expression.
            top: Maximum number of results to return.
            semantic_config: Name of the semantic configuration to use.

        Returns:
            List of result dicts with keys: id, score, reranker_score,
            content, metadata.

        Raises:
            RetrieverError: If the search operation fails.
        """
        client = self._get_client(index_name)

        try:
            search_kwargs: dict[str, Any] = {
                "search_text": query,
                "query_type": "semantic",
                "semantic_configuration_name": semantic_config,
                "top": top,
                "include_total_count": True,
            }

            if query_vector is not None:
                vector_query = VectorizedQuery(
                    vector=query_vector,
                    k_nearest_neighbors=top,
                    fields="content_vector",
                )
                search_kwargs["vector_queries"] = [vector_query]

            if filters is not None:
                search_kwargs["filter"] = filters

            logger.debug(
                "Executing hybrid search",
                index=index_name,
                query_length=len(query),
                has_vector=query_vector is not None,
                has_filter=filters is not None,
                top=top,
            )

            results = client.search(**search_kwargs)

            search_results: list[dict] = []
            for result in results:
                doc = {
                    "id": result.get("id", ""),
                    "score": result.get("@search.score", 0.0),
                    "reranker_score": result.get("@search.reranker_score", 0.0),
                    "content": result.get("content", ""),
                    "metadata": {
                        key: value
                        for key, value in result.items()
                        if key
                        not in (
                            "id",
                            "@search.score",
                            "@search.reranker_score",
                            "content",
                            "content_vector",
                        )
                    },
                }
                search_results.append(doc)

            logger.info(
                "Hybrid search completed",
                index=index_name,
                results_count=len(search_results),
                total_count=results.get_count(),
            )

            return search_results

        except Exception as exc:
            logger.error(
                "Hybrid search failed",
                index=index_name,
                error=str(exc),
            )
            raise RetrieverError(
                f"Hybrid search failed on index '{index_name}': {exc}"
            ) from exc

    async def search_patient_records(
        self,
        query: str,
        patient_id: str | None = None,
        query_vector: list[float] | None = None,
        top: int = 20,
    ) -> list[dict]:
        """Search patient records index with optional patient_id filter.

        Args:
            query: Clinical query text.
            patient_id: Optional patient identifier to filter results.
            query_vector: Optional embedding vector for vector search.
            top: Maximum number of results to return.

        Returns:
            List of matching patient record documents.

        Raises:
            RetrieverError: If the search fails.
        """
        filters = None
        if patient_id is not None:
            filters = f"patient_id eq '{patient_id}'"

        logger.debug(
            "Searching patient records",
            patient_id=patient_id,
            query_length=len(query),
        )

        return await self.hybrid_search(
            index_name=INDEX_PATIENT_RECORDS,
            query=query,
            query_vector=query_vector,
            filters=filters,
            top=top,
            semantic_config="patient-records-config",
        )

    async def search_treatment_protocols(
        self,
        query: str,
        specialty: str | None = None,
        query_vector: list[float] | None = None,
        top: int = 20,
    ) -> list[dict]:
        """Search treatment protocols index with optional specialty filter.

        Args:
            query: Clinical query text about treatments or protocols.
            specialty: Optional medical specialty to filter by (e.g., "cardiology").
            query_vector: Optional embedding vector for vector search.
            top: Maximum number of results to return.

        Returns:
            List of matching treatment protocol documents.

        Raises:
            RetrieverError: If the search fails.
        """
        filters = None
        if specialty is not None:
            filters = f"specialty eq '{specialty}'"

        logger.debug(
            "Searching treatment protocols",
            specialty=specialty,
            query_length=len(query),
        )

        return await self.hybrid_search(
            index_name=INDEX_TREATMENT_PROTOCOLS,
            query=query,
            query_vector=query_vector,
            filters=filters,
            top=top,
            semantic_config="treatment-protocols-config",
        )

    async def search_medical_literature(
        self,
        query: str,
        query_vector: list[float] | None = None,
        top: int = 20,
    ) -> list[dict]:
        """Search cached medical literature index.

        Args:
            query: Clinical or research query text.
            query_vector: Optional embedding vector for vector search.
            top: Maximum number of results to return.

        Returns:
            List of matching medical literature documents.

        Raises:
            RetrieverError: If the search fails.
        """
        logger.debug(
            "Searching medical literature",
            query_length=len(query),
        )

        return await self.hybrid_search(
            index_name=INDEX_MEDICAL_LITERATURE,
            query=query,
            query_vector=query_vector,
            top=top,
            semantic_config="medical-literature-config",
        )

    async def index_document(self, index_name: str, document: dict) -> None:
        """Index a single document into the specified search index.

        Args:
            index_name: Name of the target search index.
            document: Document dict to index. Must include an 'id' field.

        Raises:
            RetrieverError: If the indexing operation fails.
        """
        client = self._get_client(index_name)

        try:
            result = client.upload_documents(documents=[document])

            succeeded = sum(1 for r in result if r.succeeded)
            if succeeded == 0:
                error_messages = [r.error_message for r in result if not r.succeeded]
                raise RetrieverError(
                    f"Document indexing failed: {'; '.join(error_messages)}"
                )

            logger.info(
                "Document indexed successfully",
                index=index_name,
                document_id=document.get("id", "unknown"),
            )

        except RetrieverError:
            raise
        except Exception as exc:
            logger.error(
                "Document indexing failed",
                index=index_name,
                document_id=document.get("id", "unknown"),
                error=str(exc),
            )
            raise RetrieverError(
                f"Failed to index document in '{index_name}': {exc}"
            ) from exc

    async def index_documents_batch(
        self, index_name: str, documents: list[dict]
    ) -> dict:
        """Batch index documents into the specified search index.

        Args:
            index_name: Name of the target search index.
            documents: List of document dicts to index. Each must include an 'id' field.

        Returns:
            Dict with keys: total, succeeded, failed, errors.

        Raises:
            RetrieverError: If the batch indexing operation fails entirely.
        """
        client = self._get_client(index_name)

        if not documents:
            logger.warning("Empty document batch provided, skipping indexing")
            return {"total": 0, "succeeded": 0, "failed": 0, "errors": []}

        try:
            batch_size = 1000
            total_succeeded = 0
            total_failed = 0
            all_errors: list[str] = []

            for i in range(0, len(documents), batch_size):
                batch = documents[i : i + batch_size]
                results = client.upload_documents(documents=batch)

                for result in results:
                    if result.succeeded:
                        total_succeeded += 1
                    else:
                        total_failed += 1
                        all_errors.append(
                            f"Document '{result.key}': {result.error_message}"
                        )

                logger.debug(
                    "Batch chunk indexed",
                    index=index_name,
                    batch_start=i,
                    batch_size=len(batch),
                )

            summary = {
                "total": len(documents),
                "succeeded": total_succeeded,
                "failed": total_failed,
                "errors": all_errors,
            }

            logger.info(
                "Batch indexing completed",
                index=index_name,
                total=summary["total"],
                succeeded=summary["succeeded"],
                failed=summary["failed"],
            )

            return summary

        except Exception as exc:
            logger.error(
                "Batch indexing failed",
                index=index_name,
                total_documents=len(documents),
                error=str(exc),
            )
            raise RetrieverError(
                f"Batch indexing failed on '{index_name}': {exc}"
            ) from exc
