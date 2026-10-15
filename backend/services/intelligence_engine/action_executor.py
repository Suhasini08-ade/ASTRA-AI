"""Explicit, dependency-aware execution of a validated ASTRA action plan."""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.services.agent_tools import AGENT_TOOLS, execute_agent_tool
from backend.services.intelligence_engine.schemas import (
    ActionExecutionResult,
    ActionExecutionStatus,
    ActionExecutionStep,
    ExecutionPlan,
    PlanStatus,
)


AVAILABLE_TOOL_NAMES = frozenset(
    tool["function"]["name"]
    for tool in AGENT_TOOLS
    if tool.get("type") == "function" and tool.get("function", {}).get("name")
)


class ActionExecutor:
    """Execute an approved plan using only the existing tool dispatcher.

    This is deliberately not connected to the intelligence facade or AIService.
    The caller remains responsible for authentication and for obtaining explicit
    confirmation before a confirmation-gated plan is run.
    """

    async def execute(
        self,
        *,
        plan: ExecutionPlan,
        db: AsyncIOMotorDatabase,
        user_id: str,
        confirmation_granted: bool = False,
        action_arguments: list[dict[str, Any]] | None = None,
    ) -> ActionExecutionResult:
        """Run valid plan steps in dependency order through the existing dispatcher."""
        guarded_result = self._guarded_result(plan, confirmation_granted)
        if guarded_result is not None:
            return guarded_result

        if action_arguments is not None and len(action_arguments) != len(plan.steps):
            return ActionExecutionResult(
                status=ActionExecutionStatus.FAILED,
                error="Action arguments must correspond one-to-one with planned steps.",
            )

        invalid_steps = [
            step
            for step in plan.steps
            if step.action_name not in AVAILABLE_TOOL_NAMES
        ]
        if invalid_steps:
            return ActionExecutionResult(
                status=ActionExecutionStatus.UNSUPPORTED,
                supported=False,
                error="Plan contains an action that is not in the existing agent-tool allowlist.",
            )

        completed_step_ids: set[str] = set()
        outcomes: list[ActionExecutionStep] = []
        for index, step in enumerate(plan.steps):
            missing_dependencies = set(step.depends_on) - completed_step_ids
            if missing_dependencies:
                return ActionExecutionResult(
                    status=ActionExecutionStatus.FAILED,
                    steps=outcomes,
                    error=(
                        f"Step '{step.id}' cannot run before dependencies: "
                        f"{', '.join(sorted(missing_dependencies))}."
                    ),
                )

            try:
                result = await execute_agent_tool(
                    step.action_name,
                    action_arguments[index] if action_arguments is not None else {},
                    db,
                    user_id,
                )
            except Exception as error:  # Existing dispatcher errors must not execute later dependencies.
                outcomes.append(
                    ActionExecutionStep(
                        step_id=step.id,
                        action_name=step.action_name,
                        succeeded=False,
                        error=str(error),
                    )
                )
                return ActionExecutionResult(
                    status=ActionExecutionStatus.FAILED,
                    steps=outcomes,
                    error=f"Step '{step.id}' failed: {error}",
                )

            if not isinstance(result, dict) or result.get("error"):
                error_message = (
                    str(result.get("error"))
                    if isinstance(result, dict) and result.get("error")
                    else "Existing agent tool returned an invalid result."
                )
                outcomes.append(
                    ActionExecutionStep(
                        step_id=step.id,
                        action_name=step.action_name,
                        succeeded=False,
                        result=result if isinstance(result, dict) else None,
                        error=error_message,
                    )
                )
                return ActionExecutionResult(
                    status=ActionExecutionStatus.FAILED,
                    steps=outcomes,
                    error=f"Step '{step.id}' failed: {error_message}",
                )

            outcomes.append(
                ActionExecutionStep(
                    step_id=step.id,
                    action_name=step.action_name,
                    succeeded=True,
                    result=result,
                )
            )
            completed_step_ids.add(step.id)

        return ActionExecutionResult(
            status=ActionExecutionStatus.COMPLETED,
            steps=outcomes,
        )

    @staticmethod
    def _guarded_result(
        plan: ExecutionPlan,
        confirmation_granted: bool,
    ) -> ActionExecutionResult | None:
        if plan.requires_clarification or plan.status == PlanStatus.REQUIRES_CLARIFICATION:
            return ActionExecutionResult(
                status=ActionExecutionStatus.REQUIRES_CLARIFICATION,
                requires_clarification=True,
                supported=False,
            )
        if not plan.supported or plan.status == PlanStatus.UNSUPPORTED:
            return ActionExecutionResult(
                status=ActionExecutionStatus.UNSUPPORTED,
                supported=False,
            )
        if not plan.steps or plan.status == PlanStatus.NO_ACTION:
            return ActionExecutionResult(status=ActionExecutionStatus.NO_ACTION)
        if plan.confirmation_required and not confirmation_granted:
            return ActionExecutionResult(
                status=ActionExecutionStatus.REQUIRES_CONFIRMATION,
                confirmation_required=True,
            )
        return None
