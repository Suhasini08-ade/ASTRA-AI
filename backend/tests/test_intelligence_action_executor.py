"""Focused tests for Phase 4's explicit ASTRA Action Executor."""

from unittest.mock import AsyncMock, patch
import unittest

from backend.services.intelligence_engine.action_executor import ActionExecutor
from backend.services.intelligence_engine.schemas import (
    ActionExecutionStatus,
    ExecutionPlan,
    PlanStatus,
    PlanStep,
)


class ActionExecutorTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.executor = ActionExecutor()
        self.db = object()

    async def execute(self, plan, confirmation_granted=False):
        return await self.executor.execute(
            plan=plan,
            db=self.db,
            user_id="authenticated-user-a",
            confirmation_granted=confirmation_granted,
        )

    async def test_valid_step_uses_existing_dispatcher(self):
        plan = ExecutionPlan(
            status=PlanStatus.READY,
            steps=[PlanStep(id="step-1", action_name="view_tasks", resource_type="task", operation="read")],
        )
        with patch(
            "backend.services.intelligence_engine.action_executor.execute_agent_tool",
            new=AsyncMock(return_value={"status": "success"}),
        ) as dispatch:
            result = await self.execute(plan)

        self.assertEqual(result.status, ActionExecutionStatus.COMPLETED)
        dispatch.assert_awaited_once_with("view_tasks", {}, self.db, "authenticated-user-a")

    async def test_confirmation_gated_plan_does_not_dispatch_without_grant(self):
        plan = ExecutionPlan(
            status=PlanStatus.REQUIRES_CONFIRMATION,
            confirmation_required=True,
            steps=[PlanStep(id="step-1", action_name="delete_task", resource_type="task", operation="delete", confirmation_required=True)],
        )
        with patch("backend.services.intelligence_engine.action_executor.execute_agent_tool", new=AsyncMock()) as dispatch:
            result = await self.execute(plan)

        self.assertEqual(result.status, ActionExecutionStatus.REQUIRES_CONFIRMATION)
        dispatch.assert_not_awaited()

    async def test_confirmation_grant_allows_execution(self):
        plan = ExecutionPlan(
            status=PlanStatus.REQUIRES_CONFIRMATION,
            confirmation_required=True,
            steps=[PlanStep(id="step-1", action_name="delete_task", resource_type="task", operation="delete", confirmation_required=True)],
        )
        with patch(
            "backend.services.intelligence_engine.action_executor.execute_agent_tool",
            new=AsyncMock(return_value={"status": "success"}),
        ) as dispatch:
            result = await self.execute(plan, confirmation_granted=True)

        self.assertEqual(result.status, ActionExecutionStatus.COMPLETED)
        dispatch.assert_awaited_once()

    async def test_clarification_and_unsupported_plans_never_dispatch(self):
        clarification = ExecutionPlan(status=PlanStatus.REQUIRES_CLARIFICATION, requires_clarification=True, supported=False)
        unsupported = ExecutionPlan(status=PlanStatus.UNSUPPORTED, supported=False)
        with patch("backend.services.intelligence_engine.action_executor.execute_agent_tool", new=AsyncMock()) as dispatch:
            clarification_result = await self.execute(clarification)
            unsupported_result = await self.execute(unsupported)

        self.assertEqual(clarification_result.status, ActionExecutionStatus.REQUIRES_CLARIFICATION)
        self.assertEqual(unsupported_result.status, ActionExecutionStatus.UNSUPPORTED)
        dispatch.assert_not_awaited()

    async def test_unknown_tool_is_rejected_without_dispatch(self):
        plan = ExecutionPlan(
            status=PlanStatus.READY,
            steps=[PlanStep(id="step-1", action_name="invented_tool", resource_type="task", operation="read")],
        )
        with patch("backend.services.intelligence_engine.action_executor.execute_agent_tool", new=AsyncMock()) as dispatch:
            result = await self.execute(plan)

        self.assertEqual(result.status, ActionExecutionStatus.UNSUPPORTED)
        dispatch.assert_not_awaited()

    async def test_steps_run_in_order_when_dependencies_are_satisfied(self):
        plan = ExecutionPlan(
            status=PlanStatus.READY,
            steps=[
                PlanStep(id="step-1", action_name="view_tasks", resource_type="task", operation="read"),
                PlanStep(id="step-2", action_name="view_notes", resource_type="note", operation="read", depends_on=["step-1"]),
            ],
        )
        with patch(
            "backend.services.intelligence_engine.action_executor.execute_agent_tool",
            new=AsyncMock(side_effect=[{"status": "success"}, {"status": "success"}]),
        ) as dispatch:
            result = await self.execute(plan)

        self.assertEqual(result.status, ActionExecutionStatus.COMPLETED)
        self.assertEqual([call.args[0] for call in dispatch.await_args_list], ["view_tasks", "view_notes"])

    async def test_failed_dependency_prevents_later_steps(self):
        plan = ExecutionPlan(
            status=PlanStatus.READY,
            steps=[
                PlanStep(id="step-1", action_name="view_tasks", resource_type="task", operation="read"),
                PlanStep(id="step-2", action_name="view_notes", resource_type="note", operation="read", depends_on=["step-1"]),
            ],
        )
        with patch(
            "backend.services.intelligence_engine.action_executor.execute_agent_tool",
            new=AsyncMock(return_value={"error": "tool failure"}),
        ) as dispatch:
            result = await self.execute(plan)

        self.assertEqual(result.status, ActionExecutionStatus.FAILED)
        self.assertEqual(len(result.steps), 1)
        dispatch.assert_awaited_once()
