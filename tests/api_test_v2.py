#!/usr/bin/env python3
"""API Integration Tests for Agent Kanban Board - V2"""

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
        self.ticket_ids = []
        self.column_ids = []

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
            payload = {
                "name": f"QA Test Board {datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "description": "Board created for QA testing",
            }
            response = requests.post(f"{API_URL}/boards/", json=payload)
            if response.status_code in [200, 201]:
                data = response.json()
                self.board_id = data.get("id")
                self.log_result(
                    "Create Board", "PASS", f"Board ID: {self.board_id}, Name: {data.get('name')}"
                )
                return True
            else:
                self.log_result(
                    "Create Board",
                    "FAIL",
                    f"Status code: {response.status_code}, Response: {response.text}",
                )
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
                # Use the first board if we don't have one
                if not self.board_id and boards:
                    self.board_id = boards[0].get("id")
            else:
                self.log_result("Get Boards", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Get Boards", "ERROR", str(e))

    def test_get_board_details(self):
        """Test getting specific board details"""
        if not self.board_id:
            self.log_result("Get Board Details", "SKIP", "No board available")
            return

        try:
            response = requests.get(f"{API_URL}/boards/{self.board_id}")
            if response.status_code == 200:
                board = response.json()
                self.log_result("Get Board Details", "PASS", f"Board: {board.get('name')}")
            else:
                self.log_result("Get Board Details", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Get Board Details", "ERROR", str(e))

    def test_get_columns(self):
        """Test getting board columns"""
        if not self.board_id:
            self.log_result("Get Columns", "SKIP", "No board available")
            return

        try:
            response = requests.get(f"{API_URL}/boards/{self.board_id}/columns")
            if response.status_code == 200:
                columns = response.json()
                self.column_ids = [col.get("id") for col in columns]
                self.log_result(
                    "Get Columns",
                    "PASS",
                    f"Found {len(columns)} columns: {[c.get('name') for c in columns]}",
                )
            else:
                self.log_result("Get Columns", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Get Columns", "ERROR", str(e))

    def test_create_tickets(self, count: int = 10):
        """Test ticket creation"""
        if not self.board_id:
            self.log_result("Create Tickets", "SKIP", "No board available")
            return

        try:
            for i in range(count):
                payload = {
                    "title": f"QA Ticket {i + 1}",
                    "description": f"Test ticket description for ticket {i + 1}. This ticket tests the creation and management functionality.",
                    "board_id": self.board_id,
                    "priority": random.choice(["Low", "Medium", "High", "Critical"]),
                    "status": random.choice(["To Do", "In Progress", "Review"]),
                    "assigned_to": f"qa_agent_{random.randint(1, 5)}",
                    "estimate_hours": random.choice([1, 2, 4, 8, 16]),
                }

                response = requests.post(f"{API_URL}/tickets/", json=payload)
                if response.status_code in [200, 201]:
                    ticket_data = response.json()
                    self.ticket_ids.append(ticket_data.get("id"))
                    self.log_result(
                        f"Create Ticket {i + 1}", "PASS", f"Ticket ID: {ticket_data.get('id')}"
                    )
                else:
                    self.log_result(
                        f"Create Ticket {i + 1}",
                        "FAIL",
                        f"Status code: {response.status_code}, Response: {response.text}",
                    )
        except Exception as e:
            self.log_result("Create Tickets", "ERROR", str(e))

    def test_get_tickets(self):
        """Test getting all tickets"""
        try:
            response = requests.get(f"{API_URL}/tickets/")
            if response.status_code == 200:
                tickets = response.json()
                self.log_result("Get Tickets", "PASS", f"Found {len(tickets)} tickets")
            else:
                self.log_result("Get Tickets", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Get Tickets", "ERROR", str(e))

    def test_move_ticket(self):
        """Test moving tickets between columns"""
        if not self.ticket_ids or not self.column_ids:
            self.log_result("Move Ticket", "SKIP", "No tickets or columns available")
            return

        try:
            ticket_id = self.ticket_ids[0]

            # Try to move through different columns
            for i, column_id in enumerate(self.column_ids[:4]):  # Test first 4 columns
                payload = {"ticket_id": ticket_id, "target_column_id": column_id, "position": 0}
                response = requests.post(f"{API_URL}/tickets/move", json=payload)
                if response.status_code in [200, 201]:
                    self.log_result(
                        f"Move Ticket to Column {i + 1}",
                        "PASS",
                        f"Ticket {ticket_id} moved to column {column_id}",
                    )
                    time.sleep(0.5)  # Small delay to observe changes
                else:
                    self.log_result(
                        f"Move Ticket to Column {i + 1}",
                        "FAIL",
                        f"Status code: {response.status_code}, Response: {response.text}",
                    )
        except Exception as e:
            self.log_result("Move Ticket", "ERROR", str(e))

    def test_update_ticket(self):
        """Test updating ticket details"""
        if not self.ticket_ids:
            self.log_result("Update Ticket", "SKIP", "No tickets available")
            return

        try:
            ticket_id = self.ticket_ids[0]

            # Update priority
            payload = {
                "priority": "Critical",
                "status": "In Progress",
                "description": "Updated description during QA testing",
                "assigned_to": "qa_lead",
            }
            response = requests.put(f"{API_URL}/tickets/{ticket_id}", json=payload)
            if response.status_code == 200:
                self.log_result("Update Ticket", "PASS", f"Ticket {ticket_id} updated")
            else:
                self.log_result("Update Ticket", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Update Ticket", "ERROR", str(e))

    def test_add_comment(self):
        """Test adding comments to tickets"""
        if not self.ticket_ids:
            self.log_result("Add Comment", "SKIP", "No tickets available")
            return

        try:
            ticket_id = self.ticket_ids[0]
            payload = {
                "content": "QA Test Comment: This is a test comment added during integration testing.",
                "author": "QA Tester",
            }
            response = requests.post(f"{API_URL}/tickets/{ticket_id}/comments", json=payload)
            if response.status_code in [200, 201]:
                self.log_result("Add Comment", "PASS", f"Comment added to ticket {ticket_id}")
            else:
                self.log_result("Add Comment", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Add Comment", "ERROR", str(e))

    def test_get_ticket_history(self):
        """Test getting ticket history"""
        if not self.ticket_ids:
            self.log_result("Get Ticket History", "SKIP", "No tickets available")
            return

        try:
            ticket_id = self.ticket_ids[0]
            response = requests.get(f"{API_URL}/tickets/{ticket_id}/history")
            if response.status_code == 200:
                history = response.json()
                self.log_result(
                    "Get Ticket History",
                    "PASS",
                    f"Retrieved {len(history) if isinstance(history, list) else 'history'} entries",
                )
            else:
                self.log_result(
                    "Get Ticket History", "FAIL", f"Status code: {response.status_code}"
                )
        except Exception as e:
            self.log_result("Get Ticket History", "ERROR", str(e))

    def test_websocket_endpoint(self):
        """Test WebSocket status endpoint"""
        try:
            response = requests.get(f"{BASE_URL}/ws/status")
            if response.status_code == 200:
                self.log_result("WebSocket Status", "PASS", "WebSocket endpoint accessible")
            else:
                self.log_result("WebSocket Status", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("WebSocket Status", "ERROR", str(e))

    def test_delete_operations(self):
        """Test delete operations"""
        try:
            # Delete a ticket
            if self.ticket_ids:
                ticket_id = self.ticket_ids[-1]  # Delete last ticket
                response = requests.delete(f"{API_URL}/tickets/{ticket_id}")
                if response.status_code in [200, 204]:
                    self.log_result("Delete Ticket", "PASS", f"Ticket {ticket_id} deleted")
                else:
                    self.log_result("Delete Ticket", "FAIL", f"Status code: {response.status_code}")

        except Exception as e:
            self.log_result("Delete Operations", "ERROR", str(e))

    def run_all_tests(self):
        """Run all API tests"""
        print("\n" + "=" * 60)
        print("Starting API Integration Tests - V2")
        print("=" * 60 + "\n")

        # Basic connectivity tests
        self.test_health_check()
        self.test_get_boards()

        # Board operations
        self.test_create_board()
        self.test_get_board_details()
        self.test_get_columns()

        # Ticket operations
        self.test_create_tickets(10)
        self.test_get_tickets()
        self.test_move_ticket()
        self.test_update_ticket()
        self.test_add_comment()
        self.test_get_ticket_history()

        # WebSocket and cleanup
        self.test_websocket_endpoint()
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
        if len(self.test_results) > 0:
            print(f"Success Rate: {(passed / len(self.test_results) * 100):.1f}%")

        return self.test_results


if __name__ == "__main__":
    tester = APITester()
    results = tester.run_all_tests()
