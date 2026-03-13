"""Tests for the OrchestratorAgent.

Covers the full orchestration pipeline: query planning, agent dispatch,
response synthesis, guardrails validation, conflict resolution, interaction
logging, and error handling for all query types.
"""

from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cdss.core.exceptions import AgentError, AgentTimeoutError
from cdss.core.models import (
    AgentOutput,
    AgentTask,
    ClinicalQuery,
    ClinicalResponse,
    DrugAlert,
    GuardrailsResult,
    QueryPlan,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Orchestrator Implementation for Testing
# ═══════════════════════════════════════════════════════════════════════════════


class _MockOrchestrator:
    """Orchestrator implementation with injectable agent mocks for testing."""

    def __init__(
        self,
        openai_client,
        cosmos_client,
        agents: dict[str, AsyncMock] | None = None,
        timeout: float = 10.0,
    ):
        self.openai = openai_client
        self.cosmos = cosmos_client
        self.agents = agents or {}
        self.timeout = timeout

    async def process_query(self, query: ClinicalQuery) -> ClinicalResponse:
        # Step 1: Plan query
        plan = await self._plan_query(query)

        # Step 2: Dispatch agents
        agent_outputs = await self._dispatch_agents(plan, query)

        # Step 3: Synthesize response
        response = await self._synthesize_response(query, agent_outputs, plan)

        # Step 4: Validate response
        validated = await self._validate_response(response, agent_outputs)

        # Step 5: Resolve conflicts
        final = self._resolve_conflicts(validated, agent_outputs)

        # Step 6: Log interaction
        await self._log_interaction(query, agent_outputs, final)

        return final

    async def _plan_query(self, query: ClinicalQuery) -> QueryPlan:
        classification = await self.openai.classify_query(query.text)

        query_type = classification.get("query_type", "general")
        agent_map = {
            "treatment": ["patient_context", "literature", "protocol", "drug_safety"],
            "diagnosis": ["patient_context", "literature"],
            "drug_check": ["patient_context", "drug_safety"],
            "general": ["patient_context", "literature"],
            "emergency": ["patient_context", "literature", "protocol", "drug_safety"],
        }

        return QueryPlan(
            query_type=query_type,
            required_agents=agent_map.get(query_type, ["patient_context"]),
            sub_queries={"literature": query.text},
            priority="high" if query_type == "emergency" else "medium",
            parallel_dispatch=True,
        )

    async def _dispatch_agents(
        self, plan: QueryPlan, query: ClinicalQuery
    ) -> dict[str, AgentOutput]:
        outputs: dict[str, AgentOutput] = {}

        async def _run_agent(agent_name: str) -> tuple[str, AgentOutput | None]:
            agent = self.agents.get(agent_name)
            if agent is None:
                return agent_name, None
            try:
                task = AgentTask(
                    from_agent="orchestrator",
                    to_agent=agent_name,
                    message_type="task_request",
                    payload={"query": query.text, "patient_id": query.patient_id},
                    session_id=query.session_id or "default",
                    trace_id="trace-test",
                )
                result = await asyncio.wait_for(agent.execute(task), timeout=self.timeout)
                return agent_name, result
            except asyncio.TimeoutError:
                return agent_name, AgentOutput(
                    agent_name=agent_name,
                    latency_ms=int(self.timeout * 1000),
                    sources_retrieved=0,
                    summary=f"Agent {agent_name} timed out.",
                )
            except AgentError:
                return agent_name, AgentOutput(
                    agent_name=agent_name,
                    latency_ms=0,
                    sources_retrieved=0,
                    summary=f"Agent {agent_name} failed.",
                )

        if plan.parallel_dispatch:
            tasks = [_run_agent(name) for name in plan.required_agents]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, tuple):
                    name, output = result
                    if output is not None:
                        outputs[name] = output
        else:
            for name in plan.required_agents:
                agent_name, output = await _run_agent(name)
                if output is not None:
                    outputs[agent_name] = output

        return outputs

    async def _synthesize_response(
        self,
        query: ClinicalQuery,
        agent_outputs: dict[str, AgentOutput],
        plan: QueryPlan,
    ) -> ClinicalResponse:
        # Build context from agent outputs
        context_parts = []
        for name, output in agent_outputs.items():
            context_parts.append(f"[{name}]: {output.summary}")
        context = "\n".join(context_parts)

        # Call LLM for synthesis
        result = await self.openai.chat_completion(
            messages=[
                {"role": "system", "content": "Synthesize clinical response."},
                {"role": "user", "content": f"Query: {query.text}\n\nContext:\n{context}"},
            ],
            model="gpt-4o",
        )

        return ClinicalResponse(
            assessment="Clinical assessment based on available evidence.",
            recommendation=result.get("content", "No recommendation available."),
            evidence_summary=["Evidence from retrieved sources."],
            confidence_score=0.85,
            agent_outputs=agent_outputs,
            disclaimers=["This is a clinical decision support tool."],
        )

    async def _validate_response(
        self,
        response: ClinicalResponse,
        agent_outputs: dict[str, AgentOutput],
    ) -> ClinicalResponse:
        # Run guardrails agent if available
        guardrails_agent = self.agents.get("guardrails")
        if guardrails_agent:
            task = AgentTask(
                from_agent="orchestrator",
                to_agent="guardrails",
                message_type="task_request",
                payload={
                    "response_text": response.recommendation,
                    "citations": [c.model_dump() for c in response.citations],
                    "drug_alerts": [a.model_dump() for a in response.drug_alerts],
                    "confidence_score": response.confidence_score,
                },
                session_id="default",
                trace_id="trace-test",
            )
            result = await guardrails_agent.execute(task)
            if result.raw_data and result.raw_data.get("disclaimers"):
                response = response.model_copy(
                    update={"disclaimers": result.raw_data["disclaimers"]}
                )

        return response

    def _resolve_conflicts(
        self,
        response: ClinicalResponse,
        agent_outputs: dict[str, AgentOutput],
    ) -> ClinicalResponse:
        # Drug safety wins: if major alert exists, add warning
        drug_output = agent_outputs.get("drug_safety")
        if drug_output and drug_output.raw_data:
            interactions = drug_output.raw_data.get("interactions", [])
            for interaction in interactions:
                if isinstance(interaction, dict) and interaction.get("severity") == "major":
                    response = response.model_copy(
                        update={
                            "drug_alerts": response.drug_alerts + [
                                DrugAlert(
                                    severity="major",
                                    description=interaction.get("description", "Major interaction"),
                                    source=interaction.get("source", "DrugBank"),
                                    evidence_level=interaction.get("evidence_level", 1),
                                )
                            ]
                        }
                    )

        return response

    async def _log_interaction(
        self,
        query: ClinicalQuery,
        agent_outputs: dict[str, AgentOutput],
        response: ClinicalResponse,
    ) -> None:
        # Save conversation turn
        await self.cosmos.save_conversation_turn({
            "session_id": query.session_id or "default",
            "patient_id": query.patient_id or "",
            "query": query.text,
            "response": response.recommendation,
        })

        # Save audit log
        await self.cosmos.log_audit_event({
            "type": "query_processed",
            "session_id": query.session_id or "default",
            "patient_id": query.patient_id or "",
            "agents_used": list(agent_outputs.keys()),
        })


# ═══════════════════════════════════════════════════════════════════════════════
# Test Fixtures
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.fixture
def mock_agents() -> dict[str, AsyncMock]:
    """Create mock agents for all specialist roles."""
    agents = {}
    for name in ["patient_context", "literature", "protocol", "drug_safety", "guardrails"]:
        agent = AsyncMock()
        agent.execute.return_value = AgentOutput(
            agent_name=name,
            latency_ms=200,
            sources_retrieved=3,
            summary=f"{name} agent found relevant results.",
            raw_data={
                "summary": f"{name} agent found relevant results.",
                "sources_retrieved": 3,
                "interactions": [],
                "disclaimers": [
                    "This is a clinical decision support tool.",
                    "All recommendations should be verified.",
                ],
            },
        )
        agents[name] = agent
    return agents


@pytest.fixture
def orchestrator(mock_openai_client, mock_cosmos_client, mock_agents) -> _MockOrchestrator:
    """Create an orchestrator with all mocked dependencies."""
    return _MockOrchestrator(
        openai_client=mock_openai_client,
        cosmos_client=mock_cosmos_client,
        agents=mock_agents,
        timeout=10.0,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════════════


class TestOrchestratorProcessQuery:
    """Test the full process_query pipeline."""

    async def test_end_to_end_treatment_query(self, orchestrator, sample_clinical_query):
        response = await orchestrator.process_query(sample_clinical_query)

        assert isinstance(response, ClinicalResponse)
        assert response.assessment is not None
        assert response.recommendation is not None
        assert response.confidence_score > 0
        assert len(response.disclaimers) >= 1

    async def test_all_agents_called_for_treatment(self, orchestrator, sample_clinical_query, mock_agents):
        await orchestrator.process_query(sample_clinical_query)

        # Treatment queries should dispatch patient_context, literature, protocol, drug_safety
        for agent_name in ["patient_context", "literature", "protocol", "drug_safety"]:
            mock_agents[agent_name].execute.assert_called_once()

    async def test_agent_outputs_in_response(self, orchestrator, sample_clinical_query):
        response = await orchestrator.process_query(sample_clinical_query)
        assert len(response.agent_outputs) >= 1


class TestPlanQuery:
    """Test _plan_query: classification and agent selection."""

    async def test_treatment_query_plan(self, orchestrator, sample_clinical_query, mock_openai_client):
        mock_openai_client.classify_query.return_value = {
            "query_type": "treatment",
            "entities": ["diabetes"],
            "required_agents": ["patient_history", "literature"],
        }
        plan = await orchestrator._plan_query(sample_clinical_query)

        assert plan.query_type == "treatment"
        assert "patient_context" in plan.required_agents
        assert "literature" in plan.required_agents
        assert "protocol" in plan.required_agents
        assert "drug_safety" in plan.required_agents

    async def test_drug_check_query_plan(self, orchestrator, mock_openai_client):
        mock_openai_client.classify_query.return_value = {
            "query_type": "drug_check",
            "entities": ["metformin", "lisinopril"],
            "required_agents": ["drug_interaction"],
        }
        query = ClinicalQuery(text="Check interactions between metformin and lisinopril")
        plan = await orchestrator._plan_query(query)

        assert plan.query_type == "drug_check"
        assert "drug_safety" in plan.required_agents

    async def test_diagnosis_query_plan(self, orchestrator, mock_openai_client):
        mock_openai_client.classify_query.return_value = {
            "query_type": "diagnosis",
            "entities": ["chest pain"],
            "required_agents": ["patient_history", "literature"],
        }
        query = ClinicalQuery(text="What could cause acute chest pain in a 62yo male?")
        plan = await orchestrator._plan_query(query)

        assert plan.query_type == "diagnosis"
        assert "patient_context" in plan.required_agents

    async def test_general_query_plan(self, orchestrator, mock_openai_client):
        mock_openai_client.classify_query.return_value = {
            "query_type": "general",
            "entities": [],
            "required_agents": [],
        }
        query = ClinicalQuery(text="What is the mechanism of action of metformin?")
        plan = await orchestrator._plan_query(query)

        assert plan.query_type == "general"


class TestDispatchAgents:
    """Test _dispatch_agents: parallel dispatch with timeout."""

    async def test_parallel_dispatch(self, orchestrator, sample_clinical_query, mock_agents):
        plan = QueryPlan(
            query_type="treatment",
            required_agents=["patient_context", "literature"],
            parallel_dispatch=True,
        )
        outputs = await orchestrator._dispatch_agents(plan, sample_clinical_query)

        assert "patient_context" in outputs
        assert "literature" in outputs

    async def test_agent_timeout_handling(self, orchestrator, sample_clinical_query, mock_agents):
        # Make one agent take too long
        async def slow_execute(task):
            await asyncio.sleep(100)  # way past timeout

        mock_agents["literature"].execute.side_effect = slow_execute
        orchestrator.timeout = 0.1  # very short timeout

        plan = QueryPlan(
            query_type="treatment",
            required_agents=["patient_context", "literature"],
            parallel_dispatch=True,
        )
        outputs = await orchestrator._dispatch_agents(plan, sample_clinical_query)

        # Both should be in outputs, literature should show timeout
        assert "patient_context" in outputs
        assert "literature" in outputs
        assert "timed out" in outputs["literature"].summary.lower()

    async def test_agent_failure_handling(self, orchestrator, sample_clinical_query, mock_agents):
        mock_agents["protocol"].execute.side_effect = AgentError("Protocol search failed")

        plan = QueryPlan(
            query_type="treatment",
            required_agents=["patient_context", "protocol"],
            parallel_dispatch=True,
        )
        outputs = await orchestrator._dispatch_agents(plan, sample_clinical_query)

        assert "patient_context" in outputs
        assert "protocol" in outputs
        assert "failed" in outputs["protocol"].summary.lower()

    async def test_missing_agent_skipped(self, orchestrator, sample_clinical_query):
        plan = QueryPlan(
            query_type="treatment",
            required_agents=["patient_context", "nonexistent_agent"],
            parallel_dispatch=True,
        )
        outputs = await orchestrator._dispatch_agents(plan, sample_clinical_query)

        assert "patient_context" in outputs
        assert "nonexistent_agent" not in outputs


class TestSynthesizeResponse:
    """Test _synthesize_response: context assembly and LLM synthesis."""

    async def test_synthesize_calls_llm(self, orchestrator, sample_clinical_query, mock_openai_client):
        agent_outputs = {
            "patient_context": AgentOutput(
                agent_name="patient_context", latency_ms=100,
                sources_retrieved=1, summary="Patient has T2DM and CKD.",
            ),
        }
        plan = QueryPlan(query_type="treatment", required_agents=["patient_context"])

        response = await orchestrator._synthesize_response(
            sample_clinical_query, agent_outputs, plan
        )

        mock_openai_client.chat_completion.assert_called()
        assert isinstance(response, ClinicalResponse)

    async def test_synthesize_includes_agent_outputs(self, orchestrator, sample_clinical_query):
        agent_outputs = {
            "patient_context": AgentOutput(
                agent_name="patient_context", latency_ms=100,
                sources_retrieved=1, summary="Patient data retrieved.",
            ),
            "literature": AgentOutput(
                agent_name="literature", latency_ms=200,
                sources_retrieved=5, summary="5 relevant papers found.",
            ),
        }
        plan = QueryPlan(query_type="treatment", required_agents=["patient_context", "literature"])

        response = await orchestrator._synthesize_response(
            sample_clinical_query, agent_outputs, plan
        )

        assert len(response.agent_outputs) == 2


class TestValidateResponse:
    """Test _validate_response: guardrails applied."""

    async def test_guardrails_applied(self, orchestrator, mock_agents):
        response = ClinicalResponse(
            assessment="Test assessment",
            recommendation="Test recommendation",
            confidence_score=0.85,
        )
        validated = await orchestrator._validate_response(response, {})

        mock_agents["guardrails"].execute.assert_called_once()
        assert len(validated.disclaimers) >= 1

    async def test_no_guardrails_agent(self, mock_openai_client, mock_cosmos_client):
        orchestrator = _MockOrchestrator(
            openai_client=mock_openai_client,
            cosmos_client=mock_cosmos_client,
            agents={},  # no guardrails agent
        )
        response = ClinicalResponse(
            assessment="Test",
            recommendation="Test",
            confidence_score=0.85,
        )
        validated = await orchestrator._validate_response(response, {})
        assert validated == response


class TestResolveConflicts:
    """Test _resolve_conflicts: drug safety wins, patient data > guidelines."""

    async def test_drug_safety_wins_major_interaction(self, orchestrator):
        response = ClinicalResponse(
            assessment="Consider dapagliflozin",
            recommendation="Add SGLT2 inhibitor",
            confidence_score=0.85,
        )
        agent_outputs = {
            "drug_safety": AgentOutput(
                agent_name="drug_safety",
                latency_ms=100,
                sources_retrieved=1,
                summary="Major interaction found.",
                raw_data={
                    "interactions": [
                        {
                            "severity": "major",
                            "description": "Severe interaction between drug A and B",
                            "source": "DrugBank",
                            "evidence_level": 1,
                        }
                    ]
                },
            ),
        }
        resolved = orchestrator._resolve_conflicts(response, agent_outputs)

        assert len(resolved.drug_alerts) >= 1
        assert any(a.severity == "major" for a in resolved.drug_alerts)

    async def test_no_conflict_minor_interaction(self, orchestrator):
        response = ClinicalResponse(
            assessment="Test", recommendation="Test", confidence_score=0.85,
        )
        agent_outputs = {
            "drug_safety": AgentOutput(
                agent_name="drug_safety",
                latency_ms=100,
                sources_retrieved=1,
                summary="Minor interaction.",
                raw_data={
                    "interactions": [
                        {"severity": "minor", "description": "Minor effect"}
                    ]
                },
            ),
        }
        resolved = orchestrator._resolve_conflicts(response, agent_outputs)
        assert len(resolved.drug_alerts) == 0  # minor interactions not escalated


class TestLogInteraction:
    """Test _log_interaction: conversation and audit saved."""

    async def test_conversation_saved(self, orchestrator, sample_clinical_query, mock_cosmos_client):
        agent_outputs = {
            "patient_context": AgentOutput(
                agent_name="patient_context", latency_ms=100,
                sources_retrieved=1, summary="Patient data.",
            ),
        }
        response = ClinicalResponse(
            assessment="Test", recommendation="Test rec", confidence_score=0.85,
        )
        await orchestrator._log_interaction(sample_clinical_query, agent_outputs, response)

        mock_cosmos_client.save_conversation_turn.assert_called_once()

    async def test_audit_log_created(self, orchestrator, sample_clinical_query, mock_cosmos_client):
        agent_outputs = {}
        response = ClinicalResponse(
            assessment="Test", recommendation="Test rec", confidence_score=0.85,
        )
        await orchestrator._log_interaction(sample_clinical_query, agent_outputs, response)

        mock_cosmos_client.log_audit_event.assert_called_once()
        audit_event = mock_cosmos_client.log_audit_event.call_args[0][0]
        assert audit_event["type"] == "query_processed"


class TestErrorHandling:
    """Test orchestrator error handling for various failure modes."""

    async def test_llm_failure_during_synthesis(self, orchestrator, sample_clinical_query, mock_openai_client):
        mock_openai_client.chat_completion.side_effect = Exception("LLM API failure")

        with pytest.raises(Exception, match="LLM API failure"):
            await orchestrator.process_query(sample_clinical_query)

    async def test_classification_failure(self, orchestrator, sample_clinical_query, mock_openai_client):
        mock_openai_client.classify_query.side_effect = Exception("Classification failed")

        with pytest.raises(Exception, match="Classification failed"):
            await orchestrator.process_query(sample_clinical_query)

    async def test_all_agents_fail_still_returns(self, orchestrator, sample_clinical_query, mock_agents):
        for agent in mock_agents.values():
            agent.execute.side_effect = AgentError("Agent failed")

        # Even with all agents failing, synthesis should attempt (may fail at LLM)
        # but dispatch should not raise
        plan = QueryPlan(query_type="treatment", required_agents=["patient_context"])
        outputs = await orchestrator._dispatch_agents(plan, sample_clinical_query)
        # Outputs should still contain results (with failure summaries)
        assert "patient_context" in outputs


class TestQueryTypes:
    """Test different query types produce correct plans and dispatches."""

    async def test_diagnosis_query(self, orchestrator, mock_openai_client):
        mock_openai_client.classify_query.return_value = {
            "query_type": "diagnosis",
            "entities": ["elevated troponin"],
            "required_agents": ["patient_history", "literature"],
        }
        query = ClinicalQuery(text="What is the differential for elevated troponin?", patient_id="P-001")
        plan = await orchestrator._plan_query(query)
        assert plan.query_type == "diagnosis"
        assert "patient_context" in plan.required_agents

    async def test_drug_check_query(self, orchestrator, mock_openai_client):
        mock_openai_client.classify_query.return_value = {
            "query_type": "drug_check",
            "entities": ["warfarin", "aspirin"],
            "required_agents": ["drug_interaction"],
        }
        query = ClinicalQuery(text="Check interaction between warfarin and aspirin")
        plan = await orchestrator._plan_query(query)
        assert plan.query_type == "drug_check"
        assert "drug_safety" in plan.required_agents

    async def test_emergency_query_high_priority(self, orchestrator, mock_openai_client):
        mock_openai_client.classify_query.return_value = {
            "query_type": "emergency",
            "entities": ["anaphylaxis"],
            "required_agents": [],
        }
        query = ClinicalQuery(text="Patient in anaphylactic shock, what to do?")
        plan = await orchestrator._plan_query(query)
        assert plan.query_type == "emergency"
        assert plan.priority == "high"
