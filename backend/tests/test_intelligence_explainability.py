"""Focused tests for Phase 6's deterministic Intelligence explanations."""

from datetime import datetime, timezone
import unittest

from backend.services.intelligence_engine.explainability_engine import ExplainabilityEngine
from backend.services.intelligence_engine.schemas import (
    ActionExecutionResult,
    ActionExecutionStatus,
    ActionExecutionStep,
    CalendarContext,
    Decision,
    DecisionAction,
    DecisionCategory,
    DecisionOperation,
    DecisionReason,
    ExecutionPlan,
    IntelligenceContext,
    IntelligenceRequest,
    NoteContext,
    PlanReason,
    PlanStatus,
    PlanStep,
    ReminderContext,
    TaskContext,
)


class ExplainabilityEngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = ExplainabilityEngine()
        self.context = IntelligenceContext(
            request=IntelligenceRequest(message="What should I work on tonight?"),
            current_time=datetime.now(timezone.utc),
            relevant_categories=["tasks", "calendar", "reminders", "notes", "recent_chat"],
            tasks=[TaskContext(id="private-task-id", title="Private task", description="Private description")],
            calendar_events=[CalendarContext(id="private-event-id", title="Private event")],
            reminders=[ReminderContext(id="private-reminder-id", message="Private reminder")],
            notes=[NoteContext(id="private-note-id", title="Private title", content="Sensitive note content")],
            recent_chat=[{"content": "Sensitive previous chat", "token": "never expose"}],
        )

    def test_analysis_explanation_uses_actual_context_categories_and_counts(self):
        decision = Decision(
            category=DecisionCategory.ANALYZE,
            reasons=[DecisionReason(message="Request asks for productivity analysis.")],
        )
        plan = ExecutionPlan(
            status=PlanStatus.NO_ACTION,
            reasons=[PlanReason(message="The request does not require an existing agent-tool action.")],
        )

        explanation = self.engine.explain(context=self.context, decision=decision, plan=plan)

        self.assertEqual(explanation.understanding, "Planning or recommendation request.")
        self.assertEqual(explanation.decision, DecisionCategory.ANALYZE)
        self.assertEqual(
            [(item.category, item.item_count) for item in explanation.relevant_context],
            [("tasks", 1), ("calendar", 1), ("reminders", 1), ("notes", 1), ("recent_chat", 1)],
        )
        self.assertEqual(explanation.selected_actions, [])
        self.assertEqual(explanation.planned_steps, [])

    def test_action_and_plan_explanation_preserves_confirmation_and_dependencies(self):
        decision = Decision(
            category=DecisionCategory.DELETE,
            confirmation_required=True,
            actions=[
                DecisionAction(
                    action_name="delete_task",
                    resource_type="task",
                    operation=DecisionOperation.DELETE,
                    supported=True,
                    confirmation_required=True,
                )
            ],
        )
        plan = ExecutionPlan(
            status=PlanStatus.REQUIRES_CONFIRMATION,
            confirmation_required=True,
            steps=[
                PlanStep(
                    id="step-1",
                    action_name="delete_task",
                    resource_type="task",
                    operation=DecisionOperation.DELETE,
                    confirmation_required=True,
                ),
                PlanStep(
                    id="step-2",
                    action_name="view_tasks",
                    resource_type="task",
                    operation=DecisionOperation.READ,
                    depends_on=["step-1"],
                ),
            ],
        )

        explanation = self.engine.explain(context=self.context, decision=decision, plan=plan)

        self.assertTrue(explanation.confirmation_required)
        self.assertEqual(explanation.selected_actions[0].operation, DecisionOperation.DELETE)
        self.assertEqual(explanation.planned_steps[1].depends_on, ["step-1"])

    def test_execution_summary_exposes_status_counts_but_not_raw_tool_data_or_errors(self):
        decision = Decision(category=DecisionCategory.READ)
        plan = ExecutionPlan(status=PlanStatus.READY)
        execution = ActionExecutionResult(
            status=ActionExecutionStatus.FAILED,
            error="internal stack trace and token",
            steps=[
                ActionExecutionStep(
                    step_id="step-1",
                    action_name="view_tasks",
                    succeeded=True,
                    result={"task_id": "private-id", "title": "Private title"},
                ),
                ActionExecutionStep(
                    step_id="step-2",
                    action_name="view_notes",
                    succeeded=False,
                    error="provider detail should not appear",
                ),
            ],
        )

        explanation = self.engine.explain(
            context=self.context, decision=decision, plan=plan, execution=execution
        )

        self.assertEqual(explanation.execution_result.status, ActionExecutionStatus.FAILED)
        self.assertEqual(explanation.execution_result.completed_steps, 1)
        self.assertEqual(explanation.execution_result.failed_steps, 1)
        rendered = explanation.model_dump_json()
        for sensitive_value in (
            "private-task-id", "Private description", "Sensitive note content",
            "Sensitive previous chat", "never expose", "private-id",
            "internal stack trace", "provider detail",
        ):
            self.assertNotIn(sensitive_value, rendered)

    def test_explainability_engine_has_no_database_or_provider_dependencies(self):
        self.assertFalse(hasattr(self.engine, "_db"))
        self.assertFalse(hasattr(self.engine, "_ai_service"))


if __name__ == "__main__":
    unittest.main()
