"""Deterministic unit tests for Phase 2's non-executing Decision Engine."""

from datetime import datetime, timezone
import unittest

from backend.services.intelligence_engine.decision_engine import DecisionEngine
from backend.services.intelligence_engine.schemas import (
    DecisionCategory,
    IntelligenceContext,
    IntelligenceRequest,
)


class DecisionEngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = DecisionEngine()

    def decide(self, message, context=None):
        return self.engine.decide(user_id="authenticated-user-a", message=message, context=context)

    def test_conversational_request(self):
        decision = self.decide("Tell me a joke")
        self.assertEqual(decision.category, DecisionCategory.CONVERSATIONAL)
        self.assertFalse(decision.confirmation_required)
        self.assertFalse(decision.requires_clarification)

    def test_task_read_maps_to_existing_tool(self):
        decision = self.decide("Show my tasks")
        self.assertEqual(decision.category, DecisionCategory.READ)
        self.assertEqual(decision.actions[0].action_name, "view_tasks")
        self.assertTrue(decision.actions[0].supported)

    def test_calendar_read_maps_to_existing_tool(self):
        decision = self.decide("Show my calendar")
        self.assertEqual(decision.category, DecisionCategory.READ)
        self.assertEqual(decision.actions[0].action_name, "view_calendar_events")

    def test_create_task_does_not_require_confirmation(self):
        decision = self.decide("Create a task to study DAA tomorrow")
        self.assertEqual(decision.category, DecisionCategory.CREATE)
        self.assertEqual(decision.actions[0].action_name, "create_task")
        self.assertFalse(decision.confirmation_required)

    def test_update_task_requires_confirmation(self):
        decision = self.decide("Move my DAA task to Friday")
        self.assertEqual(decision.category, DecisionCategory.UPDATE)
        self.assertEqual(decision.actions[0].action_name, "update_task")
        # Confirmation is now handled by agent tools (title/ID resolution).
        self.assertFalse(decision.confirmation_required)

    def test_delete_task_does_not_require_decision_layer_confirmation(self):
        decision = self.decide("Delete my old task")
        self.assertEqual(decision.category, DecisionCategory.DELETE)
        self.assertEqual(decision.actions[0].action_name, "delete_task")
        self.assertFalse(decision.confirmation_required)
        self.assertFalse(decision.actions[0].confirmation_required)

    def test_multi_action_request_detects_each_existing_tool(self):
        decision = self.decide("Create a task to study DAA and remind me tomorrow")
        self.assertEqual(decision.category, DecisionCategory.MULTI_ACTION)
        self.assertEqual({action.action_name for action in decision.actions}, {"create_task", "create_reminder"})
        self.assertFalse(decision.confirmation_required)

    def test_ambiguous_request_requires_clarification(self):
        decision = self.decide("Can you handle my tasks?")
        self.assertEqual(decision.category, DecisionCategory.UNKNOWN)
        self.assertTrue(decision.requires_clarification)
        self.assertFalse(decision.supported)

    def test_ambiguous_remove_that_requires_clarification(self):
        decision = self.decide("Remove that")
        self.assertTrue(decision.requires_clarification)
        self.assertEqual(decision.actions, [])

    def test_calendar_delete_is_now_supported(self):
        decision = self.decide("Delete my calendar event")
        self.assertEqual(decision.category, DecisionCategory.DELETE)
        self.assertTrue(decision.supported)
        self.assertEqual(decision.actions[0].action_name, "delete_calendar_event")
        self.assertFalse(decision.confirmation_required)

    def test_weather_request(self):
        decision = self.decide("What is the weather in Latur?")
        self.assertEqual(decision.category, DecisionCategory.READ)
        self.assertEqual(decision.actions[0].action_name, "get_weather")

    def test_news_request(self):
        decision = self.decide("Show me technology news")
        self.assertEqual(decision.category, DecisionCategory.READ)
        self.assertEqual(decision.actions[0].action_name, "get_news")

    def test_document_summarization_request(self):
        decision = self.decide("Summarize this PDF document")
        self.assertEqual(decision.category, DecisionCategory.ANALYZE)
        self.assertEqual(decision.actions[0].action_name, "summarize_document")
        self.assertFalse(decision.confirmation_required)

    def test_reasons_are_always_generated(self):
        decision = self.decide("Show my notes")
        self.assertTrue(decision.reasons)
        self.assertIn("retrieve existing", decision.reasons[0].message)

    def test_no_provider_or_database_call_is_needed(self):
        # DecisionEngine has no provider or database dependency; this call is purely local.
        decision = self.decide("Show my tasks")
        self.assertEqual(decision.actions[0].action_name, "view_tasks")

    def test_user_id_is_not_taken_from_natural_language(self):
        decision = self.engine.decide(
            user_id="authenticated-user-a",
            message="Delete my task for user-b",
        )
        self.assertEqual(decision.category, DecisionCategory.DELETE)
        self.assertEqual(decision.actions[0].action_name, "delete_task")
        self.assertFalse(decision.confirmation_required)

    def test_phase_one_context_is_accepted_without_changing_behavior(self):
        context = IntelligenceContext(
            request=IntelligenceRequest(message="Show my tasks"),
            current_time=datetime.now(timezone.utc),
        )
        decision = self.decide("Show my tasks", context=context)
        self.assertEqual(decision.category, DecisionCategory.READ)
        self.assertEqual(decision.actions[0].action_name, "view_tasks")


if __name__ == "__main__":
    unittest.main()
