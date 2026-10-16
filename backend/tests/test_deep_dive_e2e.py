"""
test_deep_dive_e2e.py
=====================
End-to-end integration and verification suite testing Deep Dive Knowledge Map:
1. Session creation with real AI concept tree generation
2. Session listing & retrieval
3. Session updating (selected concept, explored concepts, dynamic branches, challenge history)
4. AI action endpoints: explain, example, compare, question, challenge
5. User privacy & data isolation
"""

import unittest
from datetime import datetime
from fastapi.testclient import TestClient

from backend.main import app


class DeepDiveE2ETests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        timestamp = int(datetime.now().timestamp() * 1000)
        cls.email_a = f"dive_user_a_{timestamp}@astra.ai"
        cls.email_b = f"dive_user_b_{timestamp}@astra.ai"
        cls.password = "SecurePassword123!"

        # Register User A
        res_a = cls.client.post("/api/auth/register", json={
            "name": "Deep Dive Explorer",
            "email": cls.email_a,
            "password": cls.password
        })
        assert res_a.status_code == 201, res_a.text
        cls.token_a = res_a.json()["data"]["token"]
        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}

        # Register User B
        res_b = cls.client.post("/api/auth/register", json={
            "name": "Second User",
            "email": cls.email_b,
            "password": cls.password
        })
        assert res_b.status_code == 201, res_b.text
        cls.token_b = res_b.json()["data"]["token"]
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

    def test_01_create_and_list_deep_dive(self):
        """Test creating a Deep Dive knowledge map and listing sessions."""
        topic = "Quantum Superposition"
        create_res = self.client.post("/api/deep-dives", json={"topic": topic}, headers=self.headers_a)
        self.assertEqual(create_res.status_code, 201, create_res.text)
        data = create_res.json()["data"]
        self.assertIn("id", data)
        self.assertEqual(data["topic"], topic)
        self.assertIn("knowledge_map", data)
        nodes = data["knowledge_map"].get("nodes", [])
        self.assertGreaterEqual(len(nodes), 2, "Expected root and at least one concept node")

        root = nodes[0]
        self.assertEqual(root["id"], "root")
        self.assertEqual(root["label"], topic)

        # Verify listing
        list_res = self.client.get("/api/deep-dives", headers=self.headers_a)
        self.assertEqual(list_res.status_code, 200)
        sessions = list_res.json()["data"]
        self.assertTrue(any(s["id"] == data["id"] for s in sessions))

        # Verify User B cannot see User A's session in their list
        list_b = self.client.get("/api/deep-dives", headers=self.headers_b)
        self.assertEqual(list_b.status_code, 200)
        self.assertFalse(any(s["id"] == data["id"] for s in list_b.json()["data"]))

        # Verify User B cannot access User A's session directly
        get_b = self.client.get(f"/api/deep-dives/{data['id']}", headers=self.headers_b)
        self.assertEqual(get_b.status_code, 404)

        # Store session ID for subsequent tests
        DeepDiveE2ETests.session_id = data["id"]
        DeepDiveE2ETests.initial_nodes = nodes

    def test_02_get_and_update_session(self):
        """Test retrieving and updating session state (explored nodes, dynamic branches, challenges)."""
        session_id = DeepDiveE2ETests.session_id
        nodes = DeepDiveE2ETests.initial_nodes

        # Retrieve session
        get_res = self.client.get(f"/api/deep-dives/{session_id}", headers=self.headers_a)
        self.assertEqual(get_res.status_code, 200)
        data = get_res.json()["data"]
        self.assertEqual(data["id"], session_id)

        # Dynamic branch addition
        new_branch = {
            "id": "qubit-bloch-sphere",
            "label": "Bloch Sphere Representation",
            "parent": nodes[1]["id"] if len(nodes) > 1 else "root",
            "difficulty": "Intermediate",
            "summary": "Geometrical representation of the pure state space of a two-level quantum mechanical system."
        }
        updated_nodes = nodes + [new_branch]

        patch_res = self.client.patch(
            f"/api/deep-dives/{session_id}",
            json={
                "selected_concept": new_branch["id"],
                "explored_concepts": ["root", new_branch["id"]],
                "knowledge_map": {"nodes": updated_nodes},
                "challenge_history": [{
                    "concept": "Quantum Superposition",
                    "question": "What is superposition?",
                    "user_answer": 1,
                    "correct_answer": 1,
                    "is_correct": True
                }]
            },
            headers=self.headers_a
        )
        self.assertEqual(patch_res.status_code, 200)
        updated_data = patch_res.json()["data"]
        self.assertEqual(updated_data["selected_concept"], new_branch["id"])
        self.assertIn(new_branch["id"], updated_data["explored_concepts"])
        self.assertEqual(len(updated_data["knowledge_map"]["nodes"]), len(updated_nodes))
        self.assertEqual(len(updated_data["challenge_history"]), 1)

    def test_03_ai_actions(self):
        """Test AI explanation, example, compare, question, and challenge generation."""
        session_id = DeepDiveE2ETests.session_id

        # 1. Action: Explain
        explain_res = self.client.post(
            f"/api/deep-dives/{session_id}/ai",
            json={"concept": "Superposition", "action": "explain"},
            headers=self.headers_a
        )
        self.assertEqual(explain_res.status_code, 200, explain_res.text)
        explain_data = explain_res.json()["data"]
        self.assertIn("answer", explain_data)
        self.assertTrue(len(explain_data["answer"]) > 10)

        # 2. Action: Example
        example_res = self.client.post(
            f"/api/deep-dives/{session_id}/ai",
            json={"concept": "Superposition", "action": "example"},
            headers=self.headers_a
        )
        self.assertEqual(example_res.status_code, 200, example_res.text)
        example_data = example_res.json()["data"]
        self.assertIn("answer", example_data)

        # 3. Action: Compare
        compare_res = self.client.post(
            f"/api/deep-dives/{session_id}/ai",
            json={
                "concept": "Superposition",
                "action": "compare",
                "related_concepts": ["Entanglement", "Classical Probability"]
            },
            headers=self.headers_a
        )
        self.assertEqual(compare_res.status_code, 200, compare_res.text)
        compare_data = compare_res.json()["data"]
        self.assertIn("answer", compare_data)

        # 4. Action: Question
        question_res = self.client.post(
            f"/api/deep-dives/{session_id}/ai",
            json={
                "concept": "Superposition",
                "action": "question",
                "prompt": "How does decoherence destroy quantum superposition?"
            },
            headers=self.headers_a
        )
        self.assertEqual(question_res.status_code, 200, question_res.text)
        q_data = question_res.json()["data"]
        self.assertIn("answer", q_data)

        # 5. Action: Challenge (Quiz)
        challenge_res = self.client.post(
            f"/api/deep-dives/{session_id}/ai",
            json={"concept": "Superposition", "action": "challenge"},
            headers=self.headers_a
        )
        self.assertEqual(challenge_res.status_code, 200, challenge_res.text)
        ch_data = challenge_res.json()["data"]
        self.assertIn("question", ch_data)
        self.assertIn("options", ch_data)
        self.assertIn("answer", ch_data)
        self.assertIsInstance(ch_data["options"], list)


if __name__ == "__main__":
    unittest.main()
