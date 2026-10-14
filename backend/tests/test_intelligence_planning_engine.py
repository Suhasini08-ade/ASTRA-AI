"""Focused tests for Phase 3's deterministic, non-executing Planning Engine."""

from datetime import datetime, timezone
import unittest

from backend.services.intelligence_engine.planning_engine import PlanningEngine
from backend.services.intelligence_engine.schemas import (
    Decision,
    DecisionAction,
    DecisionCategory,
    DecisionOperation,
    IntelligenceContext,
    IntelligenceRequest,
    PlanStatus,
)


class PlanningEngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = PlanningEngine()
        self.context = IntelligenceContext(
            request=IntelligenceRequest(message="Show my tasks"),
            current_time=datetime.now(timezone.utc),
        )

    def plan(self, decision):
        return self.engine.plan(context=self.context, decision=decision)

    def test_supported_action_creates_a_ready_plan(self):
        plan = self.plan(
            Decision(
                category=DecisionCategory.READ,
                actions=[
                    DecisionAction(
                        action_name="view_tasks",
                        resource_type="task",
                        operation=DecisionOperation.READ,
                        supported=True,
                    )
                ],
            )
        )

        self.assertEqual(plan.status, PlanStatus.READY)
        self.assertEqual(plan.steps[0].action_name, "view_tasks")
        self.assertEqual(plan.steps[0].depends_on, [])
        self.assertFalse(plan.confirmation_required)

    def test_delete_plan_is_ready_and_directly_executable(self):
        """DELETE actions no longer require confirmation — plans are READY immediately."""
        plan = self.plan(
            Decision(
                category=DecisionCategory.DELETE,
                confirmation_required=False,
                actions=[
                    DecisionAction(
                        action_name="delete_task",
                        resource_type="task",
                        operation=DecisionOperation.DELETE,
                        supported=True,
                        confirmation_required=False,
                    )
                ],
            )
        )

        self.assertEqual(plan.status, PlanStatus.READY)
        self.assertFalse(plan.confirmation_required)
        self.assertFalse(plan.steps[0].confirmation_required)

    def test_clarification_decision_never_creates_steps(self):
        plan = self.plan(
            Decision(
                category=DecisionCategory.UNKNOWN,
                requires_clarification=True,
                supported=False,
            )
        )

        self.assertEqual(plan.status, PlanStatus.REQUIRES_CLARIFICATION)
        self.assertTrue(plan.requires_clarification)
        self.assertEqual(plan.steps, [])

    def test_unsupported_action_never_enters_a_plan(self):
        plan = self.plan(
            Decision(
                category=DecisionCategory.READ,
                supported=False,
                actions=[
                    DecisionAction(
                        action_name=None,
                        resource_type="task",
                        operation=DecisionOperation.READ,
                        supported=False,
                        confirmation_required=False,
                    )
                ],
            )
        )

        self.assertEqual(plan.status, PlanStatus.UNSUPPORTED)
        self.assertFalse(plan.supported)
        self.assertEqual(plan.steps, [])

    def test_unknown_tool_is_rejected_even_if_a_decision_marks_it_supported(self):
        plan = self.plan(
            Decision(
                category=DecisionCategory.READ,
                actions=[
                    DecisionAction(
                        action_name="invented_tool",
                        resource_type="task",
                        operation=DecisionOperation.READ,
                        supported=True,
                    )
                ],
            )
        )

        self.assertEqual(plan.status, PlanStatus.UNSUPPORTED)
        self.assertEqual(plan.steps, [])

    def test_multi_action_plan_is_deterministically_sequenced(self):
        plan = self.plan(
            Decision(
                category=DecisionCategory.MULTI_ACTION,
                actions=[
                    DecisionAction(
                        action_name="create_task",
                        resource_type="task",
                        operation=DecisionOperation.CREATE,
                        supported=True,
                    ),
                    DecisionAction(
                        action_name="create_reminder",
                        resource_type="reminder",
                        operation=DecisionOperation.CREATE,
                        supported=True,
                    ),
                ],
            )
        )

        self.assertEqual([step.id for step in plan.steps], ["step-1", "step-2"])
        self.assertEqual(plan.steps[1].depends_on, ["step-1"])

    def test_non_action_decision_creates_no_execution_steps(self):
        plan = self.plan(Decision(category=DecisionCategory.ANALYZE))

        self.assertEqual(plan.status, PlanStatus.NO_ACTION)
        self.assertEqual(plan.steps, [])


if __name__ == "__main__":
    unittest.main()
