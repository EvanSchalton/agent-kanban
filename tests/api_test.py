#!/usr/bin/env python3
"""API Integration Tests for Agent Kanban Board"""

import json
import random
import time
from datetime import datetime

import requests

BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api"


class APITester:
    def __init__(self):
        self.test_results = []
        self.board_id = None
        self.agent_ids = []
        self.task_ids = []

    def log_result(self, test_name: str, status: str, details: str = ""):
        result = {
            "test": test_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details,
        }
        self.test_results.append(result)
        print(f"[{status}] {test_name}: {details}")

    def test_health_check(self):
        """Test health check endpoint"""
        try:
            response = requests.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                self.log_result("Health Check", "PASS", f"Response: {response.json()}")
            else:
                self.log_result("Health Check", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Health Check", "ERROR", str(e))

    def test_create_board(self):
        """Test board creation"""
        try:
            payload = {"name": f"QA Test Board {datetime.now().strftime('%Y%m%d_%H%M%S')}"}
            response = requests.post(f"{API_URL}/boards/", json=payload)
            if response.status_code == 200:
                data = response.json()
                self.board_id = data.get("id")
                self.log_result("Create Board", "PASS", f"Board ID: {self.board_id}")
                return True
            else:
                self.log_result("Create Board", "FAIL", f"Status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Create Board", "ERROR", str(e))
            return False

    def test_get_boards(self):
        """Test getting all boards"""
        try:
            response = requests.get(f"{API_URL}/boards/")
            if response.status_code == 200:
                boards = response.json()
                self.log_result("Get Boards", "PASS", f"Found {len(boards)} boards")
            else:
                self.log_result("Get Boards", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Get Boards", "ERROR", str(e))

    def test_create_agents(self, count: int = 5):
        """Test agent creation"""
        try:
            for i in range(count):
                payload = {"name": f"QA Agent {i + 1}", "board_id": self.board_id}
                response = requests.post(f"{API_URL}/agents/", json=payload)
                if response.status_code == 200:
                    agent_data = response.json()
                    self.agent_ids.append(agent_data.get("id"))
                    self.log_result(
                        f"Create Agent {i + 1}", "PASS", f"Agent ID: {agent_data.get('id')}"
                    )
                else:
                    self.log_result(
                        f"Create Agent {i + 1}", "FAIL", f"Status code: {response.status_code}"
                    )
        except Exception as e:
            self.log_result("Create Agents", "ERROR", str(e))

    def test_create_tasks(self, count: int = 10):
        """Test task creation"""
        try:
            columns = ["backlog", "todo", "in_progress", "review", "done"]
            for i in range(count):
                payload = {
                    "title": f"QA Task {i + 1}",
                    "description": f"Test task description for task {i + 1}",
                    "column": random.choice(columns[:3]),  # Start tasks in first 3 columns
                    "board_id": self.board_id,
                    "priority": random.choice(["low", "medium", "high", "critical"]),
                    "story_points": random.choice([1, 2, 3, 5, 8]),
                }
                # Assign to random agent if available
                if self.agent_ids:
                    payload["agent_id"] = random.choice(self.agent_ids)

                response = requests.post(f"{API_URL}/tasks/", json=payload)
                if response.status_code == 200:
                    task_data = response.json()
                    self.task_ids.append(task_data.get("id"))
                    self.log_result(
                        f"Create Task {i + 1}", "PASS", f"Task ID: {task_data.get('id')}"
                    )
                else:
                    self.log_result(
                        f"Create Task {i + 1}", "FAIL", f"Status code: {response.status_code}"
                    )
        except Exception as e:
            self.log_result("Create Tasks", "ERROR", str(e))

    def test_move_task(self):
        """Test moving tasks between columns"""
        if not self.task_ids:
            self.log_result("Move Task", "SKIP", "No tasks available")
            return

        try:
            task_id = self.task_ids[0]
            columns = ["todo", "in_progress", "review", "done"]

            for column in columns:
                payload = {"column": column}
                response = requests.patch(f"{API_URL}/tasks/{task_id}/move", json=payload)
                if response.status_code == 200:
                    self.log_result(f"Move Task to {column}", "PASS", f"Task {task_id} moved")
                    time.sleep(0.5)  # Small delay to observe changes
                else:
                    self.log_result(
                        f"Move Task to {column}", "FAIL", f"Status code: {response.status_code}"
                    )
        except Exception as e:
            self.log_result("Move Task", "ERROR", str(e))

    def test_assign_task(self):
        """Test assigning tasks to agents"""
        if not self.task_ids or not self.agent_ids:
            self.log_result("Assign Task", "SKIP", "No tasks or agents available")
            return

        try:
            task_id = self.task_ids[1] if len(self.task_ids) > 1 else self.task_ids[0]
            agent_id = self.agent_ids[0]

            payload = {"agent_id": agent_id}
            response = requests.patch(f"{API_URL}/tasks/{task_id}/assign", json=payload)
            if response.status_code == 200:
                self.log_result(
                    "Assign Task", "PASS", f"Task {task_id} assigned to agent {agent_id}"
                )
            else:
                self.log_result("Assign Task", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Assign Task", "ERROR", str(e))

    def test_update_task_priority(self):
        """Test updating task priority"""
        if not self.task_ids:
            self.log_result("Update Priority", "SKIP", "No tasks available")
            return

        try:
            task_id = self.task_ids[0]
            priorities = ["low", "medium", "high", "critical"]

            for priority in priorities:
                payload = {"priority": priority}
                response = requests.patch(f"{API_URL}/tasks/{task_id}", json=payload)
                if response.status_code == 200:
                    self.log_result(f"Update Priority to {priority}", "PASS", f"Task {task_id}")
                else:
                    self.log_result(
                        f"Update Priority to {priority}",
                        "FAIL",
                        f"Status code: {response.status_code}",
                    )
        except Exception as e:
            self.log_result("Update Priority", "ERROR", str(e))

    def test_board_statistics(self):
        """Test board statistics endpoint"""
        if not self.board_id:
            self.log_result("Board Statistics", "SKIP", "No board available")
            return

        try:
            response = requests.get(f"{API_URL}/boards/{self.board_id}/stats")
            if response.status_code == 200:
                stats = response.json()
                self.log_result("Board Statistics", "PASS", f"Stats: {json.dumps(stats, indent=2)}")
            else:
                self.log_result("Board Statistics", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Board Statistics", "ERROR", str(e))

    def test_delete_operations(self):
        """Test delete operations"""
        try:
            # Delete a task
            if self.task_ids:
                task_id = self.task_ids[0]
                response = requests.delete(f"{API_URL}/tasks/{task_id}")
                if response.status_code == 200:
                    self.log_result("Delete Task", "PASS", f"Task {task_id} deleted")
                else:
                    self.log_result("Delete Task", "FAIL", f"Status code: {response.status_code}")

            # Delete an agent
            if self.agent_ids:
                agent_id = self.agent_ids[0]
                response = requests.delete(f"{API_URL}/agents/{agent_id}")
                if response.status_code == 200:
                    self.log_result("Delete Agent", "PASS", f"Agent {agent_id} deleted")
                else:
                    self.log_result("Delete Agent", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Delete Operations", "ERROR", str(e))

    def run_all_tests(self):
        """Run all API tests"""
        print("\n" + "=" * 60)
        print("Starting API Integration Tests")
        print("=" * 60 + "\n")

        self.test_health_check()
        self.test_create_board()
        self.test_get_boards()
        self.test_create_agents(5)
        self.test_create_tasks(10)
        self.test_move_task()
        self.test_assign_task()
        self.test_update_task_priority()
        self.test_board_statistics()
        self.test_delete_operations()

        # Summary
        print("\n" + "=" * 60)
        print("Test Summary")
        print("=" * 60)
        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        errors = sum(1 for r in self.test_results if r["status"] == "ERROR")
        skipped = sum(1 for r in self.test_results if r["status"] == "SKIP")

        print(f"Total Tests: {len(self.test_results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Errors: {errors}")
        print(f"Skipped: {skipped}")
        print(f"Success Rate: {(passed / len(self.test_results) * 100):.1f}%")

        return self.test_results


if __name__ == "__main__":
    tester = APITester()
    results = tester.run_all_tests()
