"""Focused tests for Phase 5's deterministic Intelligence Engine orchestrator."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock
import unittest

from backend.services.intelligence_engine.engine import IntelligenceEngine
from backend.services.intelligence_engine.schemas import (
    ActionExecutionResult,
    ActionExecutionStatus,
    Decision,
    DecisionAction,
    DecisionCategory,
    DecisionOperation,
    ExecutionPlan,
    IntelligenceContext,
    IntelligenceRequest,
    PlanStatus,
    PlanStep,
)


class IntelligenceEngineTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = object()
        self.engine = IntelligenceEngine(self.db)
        self.context = IntelligenceContext(
            request=IntelligenceRequest(message="Show my tasks"),
            current_time=datetime.now(timezone.utc),
        )
        self.engine._context_engine = Mock()
        self.engine._context_engine.build_context = AsyncMock(return_value=self.context)
        self.engine._decision_engine = Mock()
        self.engine._planning_engine = Mock()
        self.engine._action_executor = Mock()
        self.engine._action_executor.execute = AsyncMock()

    def set_pipeline(self, decision, plan):
        self.engine._decision_engine.decide.return_value = decision
        self.engine._planning_engine.plan.return_value = plan

    @staticmethod
    def supported_decision():
        return Decision(
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

    @staticmethod
    def ready_plan():
        return ExecutionPlan(
            status=PlanStatus.READY,
            steps=[
                PlanStep(
                    id="step-1",
                    action_name="view_tasks",
                    resource_type="task",
                    operation=DecisionOperation.READ,
                )
            ],
        )

    async def test_context_decision_plan_flow_executes(self):
        decision = self.supported_decision()
        plan = self.ready_plan()
        self.set_pipeline(decision, plan)
        self.engine._action_executor.execute.return_value = ActionExecutionResult(
            status=ActionExecutionStatus.COMPLETED
        )

        result = await self.engine.process("user-a", "Show my tasks")

        self.engine._context_engine.build_context.assert_awaited_once_with(
            user_id="user-a", message="Show my tasks"
        )
        self.engine._decision_engine.decide.assert_called_once_with(
            user_id="user-a", message="Show my tasks", context=self.context
        )
        self.engine._planning_engine.plan.assert_called_once_with(
            context=self.context, decision=decision
        )
        self.assertEqual(result.context, self.context)
        self.assertEqual(result.decision, decision)
        self.assertEqual(result.plan, plan)
        self.assertEqual(result.status, "completed")

    async def test_clarification_stops_execution(self):
        decision = Decision(category=DecisionCategory.UNKNOWN, requires_clarification=True, supported=False)
        plan = ExecutionPlan(
            status=PlanStatus.REQUIRES_CLARIFICATION,
            requires_clarification=True,
            supported=False,
        )
        self.set_pipeline(decision, plan)

        result = await self.engine.process("user-a", "Remove that")

        self.assertEqual(result.status, "requires_clarification")
        self.assertIsNone(result.execution)
        self.engine._action_executor.execute.assert_not_awaited()

    async def test_unsupported_action_stops_execution(self):
        decision = Decision(category=DecisionCategory.DELETE, supported=False)
        plan = ExecutionPlan(status=PlanStatus.UNSUPPORTED, supported=False)
        self.set_pipeline(decision, plan)

        result = await self.engine.process("user-a", "Delete calendar event")

        self.assertEqual(result.status, "unsupported")
        self.engine._action_executor.execute.assert_not_awaited()

    async def test_confirmation_stops_execution_until_granted(self):
        decision = self.supported_decision()
        plan = self.ready_plan()
        plan.status = PlanStatus.REQUIRES_CONFIRMATION
        plan.confirmation_required = True
        self.set_pipeline(decision, plan)

        result = await self.engine.process("user-a", "Delete my task")

        self.assertEqual(result.status, "requires_confirmation")
        self.engine._action_executor.execute.assert_not_awaited()

    async def test_confirmed_action_executes_with_authenticated_user(self):
        decision = self.supported_decision()
        plan = self.ready_plan()
        plan.confirmation_required = True
        plan.status = PlanStatus.REQUIRES_CONFIRMATION
        self.set_pipeline(decision, plan)
        self.engine._action_executor.execute.return_value = ActionExecutionResult(
            status=ActionExecutionStatus.COMPLETED
        )

        result = await self.engine.process(
            "authenticated-user-a", "Delete my task", confirmation_granted=True
        )

        self.assertEqual(result.status, "completed")
        self.engine._action_executor.execute.assert_awaited_once_with(
            plan=plan,
            db=self.db,
            user_id="authenticated-user-a",
            confirmation_granted=True,
        )

    async def test_multi_action_execution_uses_one_plan(self):
        decision = Decision(category=DecisionCategory.MULTI_ACTION)
        plan = ExecutionPlan(
            status=PlanStatus.READY,
            steps=[
                PlanStep(id="step-1", action_name="view_tasks", resource_type="task", operation=DecisionOperation.READ),
                PlanStep(id="step-2", action_name="view_notes", resource_type="note", operation=DecisionOperation.READ, depends_on=["step-1"]),
            ],
        )
        self.set_pipeline(decision, plan)
        self.engine._action_executor.execute.return_value = ActionExecutionResult(
            status=ActionExecutionStatus.COMPLETED
        )

        result = await self.engine.process("user-a", "Show tasks and notes")

        self.assertEqual(result.status, "completed")
        self.engine._action_executor.execute.assert_awaited_once()

    async def test_execution_failure_is_returned(self):
        decision = self.supported_decision()
        plan = self.ready_plan()
        self.set_pipeline(decision, plan)
        self.engine._action_executor.execute.return_value = ActionExecutionResult(
            status=ActionExecutionStatus.FAILED,
            error="Tool failed",
        )

        result = await self.engine.process("user-a", "Show my tasks")

        self.assertEqual(result.status, "failed")
        self.assertEqual(result.execution.error, "Tool failed")

    async def test_orchestrator_has_no_ai_provider_dependency(self):
        decision = self.supported_decision()
        plan = self.ready_plan()
        self.set_pipeline(decision, plan)
        self.engine._action_executor.execute.return_value = ActionExecutionResult(
            status=ActionExecutionStatus.COMPLETED
        )

        await self.engine.orchestrate("user-a", "Show my tasks")

        self.assertFalse(hasattr(self.engine, "_ai_service"))


if __name__ == "__main__":
    unittest.main()
