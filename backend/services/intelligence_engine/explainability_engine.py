"""Deterministic, data-minimizing explanations for ASTRA Intelligence."""

from backend.services.intelligence_engine.schemas import (
    ActionExecutionResult,
    ActionExplanation,
    ContextExplanation,
    Decision,
    DecisionCategory,
    ExecutionExplanation,
    ExecutionPlan,
    IntelligenceContext,
    IntelligenceExplanation,
    PlanStepExplanation,
)


class ExplainabilityEngine:
    """Explain pipeline artifacts without accessing data stores or providers."""

    _UNDERSTANDINGS = {
        DecisionCategory.CONVERSATIONAL: "Conversational request.",
        DecisionCategory.READ: "Request to retrieve existing user information.",
        DecisionCategory.ANALYZE: "Planning or recommendation request.",
        DecisionCategory.CREATE: "Request to create new user information.",
        DecisionCategory.UPDATE: "Request to update existing user information.",
        DecisionCategory.DELETE: "Request to remove existing user information.",
        DecisionCategory.MULTI_ACTION: "Request with multiple user-information actions.",
        DecisionCategory.UNKNOWN: "Request needs clarification before ASTRA can act.",
    }

    def explain(
        self,
        *,
        context: IntelligenceContext,
        decision: Decision,
        plan: ExecutionPlan,
        execution: ActionExecutionResult | None = None,
    ) -> IntelligenceExplanation:
        """Create a safe structured explanation from supplied pipeline outputs only."""
        return IntelligenceExplanation(
            understanding=self._UNDERSTANDINGS[decision.category],
            relevant_context=self._context_summary(context),
            decision=decision.category,
            selected_actions=[
                ActionExplanation(
                    operation=action.operation,
                    resource_type=action.resource_type,
                    supported=action.supported,
                    confirmation_required=action.confirmation_required,
                )
                for action in decision.actions
            ],
            reasons=[reason.message for reason in decision.reasons]
            + [reason.message for reason in plan.reasons],
            confirmation_required=plan.confirmation_required,
            planned_steps=[
                PlanStepExplanation(
                    step_id=step.id,
                    operation=step.operation,
                    resource_type=step.resource_type,
                    depends_on=step.depends_on,
                    confirmation_required=step.confirmation_required,
                )
                for step in plan.steps
            ],
            execution_result=self._execution_summary(execution) if execution else None,
        )

    @staticmethod
    def _context_summary(context: IntelligenceContext) -> list[ContextExplanation]:
        summaries: list[ContextExplanation] = []
        category_data = (
            ("tasks", len(context.tasks), "incomplete task(s) considered"),
            ("calendar", len(context.calendar_events), "upcoming calendar event(s) considered"),
            ("reminders", len(context.reminders), "active reminder(s) considered"),
            ("notes", len(context.notes), "saved note(s) considered"),
            ("focus_sessions", len(context.focus_sessions), "recent focus session(s) considered"),
            ("settings", len(context.relevant_settings), "relevant setting category considered"),
            ("recent_chat", len(context.recent_chat), "recent conversation message(s) considered"),
        )
        selected = set(context.relevant_categories)
        for category, count, description in category_data:
            if category in selected:
                summaries.append(
                    ContextExplanation(
                        category=category,
                        item_count=count,
                        description=description,
                    )
                )
        return summaries

    @staticmethod
    def _execution_summary(execution: ActionExecutionResult) -> ExecutionExplanation:
        completed = sum(step.succeeded for step in execution.steps)
        failed = len(execution.steps) - completed
        message = {
            "completed": "All planned steps completed.",
            "failed": "One or more planned steps did not complete.",
            "requires_confirmation": "Execution is waiting for confirmation.",
            "requires_clarification": "Execution is waiting for clarification.",
            "unsupported": "Execution was not attempted because the plan is unsupported.",
            "no_action": "No execution was needed.",
        }[execution.status.value]
        return ExecutionExplanation(
            status=execution.status,
            completed_steps=completed,
            failed_steps=failed,
            message=message,
        )
