"""Deterministic orchestration for ASTRA Intelligence Engine phases 1 through 5."""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.services.intelligence_engine.action_executor import ActionExecutor
from backend.services.intelligence_engine.context_engine import ContextEngine
from backend.services.intelligence_engine.decision_engine import DecisionEngine
from backend.services.intelligence_engine.explainability_engine import ExplainabilityEngine
from backend.services.intelligence_engine.planning_engine import PlanningEngine
from backend.services.intelligence_engine.schemas import (
    IntelligenceContext,
    IntelligenceResult,
    PlanStatus,
)


class IntelligenceEngine:
    """Orchestrate local context, decision, planning, and explicit execution.

    The engine deliberately has no provider or AIService dependency. It remains
    unconnected to routes; callers must supply the authenticated user ID and may
    explicitly grant confirmation before a material action is dispatched.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db
        self._context_engine = ContextEngine(db)
        self._decision_engine = DecisionEngine()
        self._planning_engine = PlanningEngine()
        self._action_executor = ActionExecutor()
        self._explainability_engine = ExplainabilityEngine()

    async def build_context(self, user_id: str, message: str) -> IntelligenceContext:
        """Build read-only context without making decisions, plans, or actions."""
        return await self._context_engine.build_context(user_id=user_id, message=message)

    async def process(
        self,
        user_id: str,
        message: str,
        *,
        confirmation_granted: bool = False,
        action_arguments: list[dict[str, Any]] | None = None,
    ) -> IntelligenceResult:
        """Run the Phase 1–5 pipeline without invoking any AI provider."""
        context = await self.build_context(user_id=user_id, message=message)
        decision = self._decision_engine.decide(
            user_id=user_id,
            message=message,
            context=context,
        )
        plan = self._planning_engine.plan(context=context, decision=decision)
        reasons = [reason.message for reason in decision.reasons]
        reasons.extend(reason.message for reason in plan.reasons)

        if plan.requires_clarification or plan.status == PlanStatus.REQUIRES_CLARIFICATION:
            return IntelligenceResult(
                context=context,
                decision=decision,
                plan=plan,
                explanation=self._explainability_engine.explain(
                    context=context, decision=decision, plan=plan
                ),
                status=PlanStatus.REQUIRES_CLARIFICATION.value,
                reasons=reasons,
            )

        if not plan.supported or plan.status == PlanStatus.UNSUPPORTED:
            return IntelligenceResult(
                context=context,
                decision=decision,
                plan=plan,
                explanation=self._explainability_engine.explain(
                    context=context, decision=decision, plan=plan
                ),
                status=PlanStatus.UNSUPPORTED.value,
                reasons=reasons,
            )

        if not plan.steps or plan.status == PlanStatus.NO_ACTION:
            return IntelligenceResult(
                context=context,
                decision=decision,
                plan=plan,
                explanation=self._explainability_engine.explain(
                    context=context, decision=decision, plan=plan
                ),
                status=PlanStatus.NO_ACTION.value,
                reasons=reasons,
            )

        if plan.confirmation_required and not confirmation_granted:
            return IntelligenceResult(
                context=context,
                decision=decision,
                plan=plan,
                explanation=self._explainability_engine.explain(
                    context=context, decision=decision, plan=plan
                ),
                status=PlanStatus.REQUIRES_CONFIRMATION.value,
                reasons=reasons,
            )

        execution_kwargs: dict[str, Any] = {
            "plan": plan,
            "db": self._db,
            "user_id": user_id,
            "confirmation_granted": confirmation_granted,
        }
        if action_arguments is not None:
            execution_kwargs["action_arguments"] = action_arguments
        execution = await self._action_executor.execute(**execution_kwargs)
        reasons.extend(
            outcome.error
            for outcome in execution.steps
            if outcome.error
        )
        return IntelligenceResult(
            context=context,
            decision=decision,
            plan=plan,
            execution=execution,
            explanation=self._explainability_engine.explain(
                context=context, decision=decision, plan=plan, execution=execution
            ),
            status=execution.status.value,
            reasons=reasons,
        )

    async def orchestrate(
        self,
        user_id: str,
        message: str,
        *,
        confirmation_granted: bool = False,
        action_arguments: list[dict[str, Any]] | None = None,
    ) -> IntelligenceResult:
        """Compatibility alias for callers that name the pipeline operation."""
        return await self.process(
            user_id=user_id,
            message=message,
            confirmation_granted=confirmation_granted,
            action_arguments=action_arguments,
        )
