"""Deterministic, non-executing planning for ASTRA Intelligence."""

from backend.services.agent_tools import AGENT_TOOLS
from backend.services.intelligence_engine.schemas import (
    Decision,
    ExecutionPlan,
    IntelligenceContext,
    PlanReason,
    PlanStatus,
    PlanStep,
)


AVAILABLE_TOOL_NAMES = frozenset(
    tool["function"]["name"]
    for tool in AGENT_TOOLS
    if tool.get("type") == "function" and tool.get("function", {}).get("name")
)


class PlanningEngine:
    """Convert an existing decision into a safe, validated plan.

    This class is deliberately stateless. It receives context only as an input
    boundary for Phase 3 and never reads databases, invokes providers, or
    dispatches agent tools.
    """

    def plan(
        self,
        *,
        context: IntelligenceContext,
        decision: Decision,
    ) -> ExecutionPlan:
        """Build a deterministic proposal from a Phase 1 context and Phase 2 decision."""
        del context  # Context has already been safely selected by Phase 1.

        if decision.requires_clarification:
            return ExecutionPlan(
                status=PlanStatus.REQUIRES_CLARIFICATION,
                requires_clarification=True,
                supported=False,
                reasons=[
                    PlanReason(message="No plan was created because the request needs clarification."),
                    *[PlanReason(message=reason.message) for reason in decision.reasons],
                ],
            )

        invalid_actions = [
            action
            for action in decision.actions
            if not action.supported
            or not action.action_name
            or action.action_name not in AVAILABLE_TOOL_NAMES
        ]
        if not decision.supported or invalid_actions:
            return ExecutionPlan(
                status=PlanStatus.UNSUPPORTED,
                confirmation_required=decision.confirmation_required,
                supported=False,
                reasons=[
                    PlanReason(
                        message="No plan was created because one or more requested actions are unsupported."
                    ),
                    *[PlanReason(message=reason.message) for reason in decision.reasons],
                ],
            )

        if not decision.actions:
            return ExecutionPlan(
                status=PlanStatus.NO_ACTION,
                reasons=[
                    PlanReason(message="The request does not require an existing agent-tool action."),
                    *[PlanReason(message=reason.message) for reason in decision.reasons],
                ],
            )

        steps: list[PlanStep] = []
        for index, action in enumerate(decision.actions, start=1):
            previous_step_id = steps[-1].id if steps else None
            steps.append(
                PlanStep(
                    id=f"step-{index}",
                    action_name=action.action_name,
                    resource_type=action.resource_type,
                    operation=action.operation,
                    depends_on=[previous_step_id] if previous_step_id else [],
                    confirmation_required=action.confirmation_required,
                )
            )

        confirmation_required = decision.confirmation_required or any(
            step.confirmation_required for step in steps
        )
        return ExecutionPlan(
            status=(
                PlanStatus.REQUIRES_CONFIRMATION
                if confirmation_required
                else PlanStatus.READY
            ),
            steps=steps,
            confirmation_required=confirmation_required,
            reasons=[PlanReason(message=reason.message) for reason in decision.reasons],
        )
