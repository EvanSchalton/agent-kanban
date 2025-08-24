#!/usr/bin/env python3
"""API Integration Tests for Agent Kanban Board - Port 18000"""

from datetime import datetime

import requests

BASE_URL = "http://localhost:18000"
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
        status_symbol = "✓" if status == "PASS" else "✗" if status == "FAIL" else "!"
        print(f"[{status_symbol}] {test_name}: {details[:100]}")

    def test_health_check(self):
        """Test health check endpoint"""
        try:
            response = requests.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                data = response.json()
                self.log_result("Health Check", "PASS", f"Service healthy: {data}")
            else:
                self.log_result("Health Check", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Health Check", "ERROR", str(e))

    def test_get_boards(self):
        """Test getting all boards"""
        try:
            response = requests.get(f"{API_URL}/boards/")
            if response.status_code == 200:
                boards = response.json()
                self.log_result("Get Boards", "PASS", f"Found {len(boards)} boards")
                if boards:
                    self.board_id = boards[0].get("id")
                    print(f"  Using board ID: {self.board_id}")
            else:
                self.log_result("Get Boards", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Get Boards", "ERROR", str(e))

    def test_create_board(self):
        """Test board creation"""
        try:
            payload = {
                "name": f"QA Test Board {datetime.now().strftime('%H%M%S')}",
                "description": "Automated testing board",
            }
            response = requests.post(f"{API_URL}/boards/", json=payload)
            if response.status_code in [200, 201]:
                data = response.json()
                board_id = data.get("id")
                self.log_result("Create Board", "PASS", f"Created board ID: {board_id}")
                if not self.board_id:
                    self.board_id = board_id
            else:
                self.log_result(
                    "Create Board",
                    "FAIL",
                    f"Status code: {response.status_code}, Response: {response.text[:100]}",
                )
        except Exception as e:
            self.log_result("Create Board", "ERROR", str(e))

    def test_get_board_columns(self):
        """Test getting board columns"""
        if not self.board_id:
            self.log_result("Get Columns", "SKIP", "No board available")
            return

        try:
            response = requests.get(f"{API_URL}/boards/{self.board_id}/columns")
            if response.status_code == 200:
                columns = response.json()
                self.column_ids = [col.get("id") for col in columns]
                column_names = [col.get("name") for col in columns]
                self.log_result(
                    "Get Columns",
                    "PASS",
                    f"Found {len(columns)} columns: {', '.join(column_names)}",
                )
            else:
                self.log_result("Get Columns", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Get Columns", "ERROR", str(e))

    def test_create_tickets(self, count: int = 5):
        """Test ticket creation"""
        if not self.board_id:
            self.log_result("Create Tickets", "SKIP", "No board available")
            return

        created = 0
        for i in range(count):
            try:
                payload = {
                    "title": f"Test Ticket {i + 1}",
                    "description": f"Description for test ticket {i + 1}",
                    "priority": ["Low", "Medium", "High", "Critical"][i % 4],
                    "assigned_to": f"tester_{i % 3}",
                }

                # Try with board_id as query parameter
                response = requests.post(
                    f"{API_URL}/tickets/?board_id={self.board_id}", json=payload
                )

                if response.status_code in [200, 201]:
                    ticket = response.json()
                    self.ticket_ids.append(ticket.get("id"))
                    created += 1
                else:
                    print(f"  Failed to create ticket {i + 1}: {response.status_code}")

            except Exception as e:
                print(f"  Error creating ticket {i + 1}: {str(e)}")

        self.log_result(
            "Create Tickets",
            "PASS" if created > 0 else "FAIL",
            f"Created {created}/{count} tickets",
        )

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
        """Test moving ticket between columns"""
        if not self.ticket_ids or not self.column_ids:
            self.log_result("Move Ticket", "SKIP", "No tickets or columns available")
            return

        try:
            ticket_id = self.ticket_ids[0]
            target_column = self.column_ids[1] if len(self.column_ids) > 1 else self.column_ids[0]

            payload = {"ticket_id": ticket_id, "target_column_id": target_column, "position": 0}

            response = requests.post(f"{API_URL}/tickets/move", json=payload)

            if response.status_code in [200, 201]:
                self.log_result(
                    "Move Ticket", "PASS", f"Moved ticket {ticket_id} to column {target_column}"
                )
            else:
                self.log_result(
                    "Move Ticket",
                    "FAIL",
                    f"Status code: {response.status_code}, Response: {response.text[:100]}",
                )

        except Exception as e:
            self.log_result("Move Ticket", "ERROR", str(e))

    def test_update_ticket(self):
        """Test updating ticket"""
        if not self.ticket_ids:
            self.log_result("Update Ticket", "SKIP", "No tickets available")
            return

        try:
            ticket_id = self.ticket_ids[0]
            payload = {
                "title": "Updated Test Ticket",
                "priority": "Critical",
                "description": "Updated description",
            }

            response = requests.put(f"{API_URL}/tickets/{ticket_id}", json=payload)

            if response.status_code == 200:
                self.log_result("Update Ticket", "PASS", f"Updated ticket {ticket_id}")
            else:
                self.log_result("Update Ticket", "FAIL", f"Status code: {response.status_code}")

        except Exception as e:
            self.log_result("Update Ticket", "ERROR", str(e))

    def test_add_comment(self):
        """Test adding comment to ticket"""
        if not self.ticket_ids:
            self.log_result("Add Comment", "SKIP", "No tickets available")
            return

        try:
            ticket_id = self.ticket_ids[0]
            payload = {
                "content": f"Test comment at {datetime.now().isoformat()}",
                "author": "QA_Tester",
            }

            response = requests.post(f"{API_URL}/tickets/{ticket_id}/comments", json=payload)

            if response.status_code in [200, 201]:
                self.log_result("Add Comment", "PASS", f"Added comment to ticket {ticket_id}")
            else:
                self.log_result(
                    "Add Comment",
                    "FAIL",
                    f"Status code: {response.status_code}, Response: {response.text[:100]}",
                )

        except Exception as e:
            self.log_result("Add Comment", "ERROR", str(e))

    def test_websocket_status(self):
        """Test WebSocket endpoint status"""
        try:
            response = requests.get(f"{BASE_URL}/ws/status")
            if response.status_code == 200:
                self.log_result("WebSocket Status", "PASS", "WebSocket endpoint accessible")
            else:
                self.log_result("WebSocket Status", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("WebSocket Status", "ERROR", str(e))

    def test_api_docs(self):
        """Test API documentation endpoint"""
        try:
            response = requests.get(f"{BASE_URL}/docs")
            if response.status_code == 200:
                self.log_result("API Docs", "PASS", "API documentation accessible")
            else:
                self.log_result("API Docs", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("API Docs", "ERROR", str(e))

    def test_delete_ticket(self):
        """Test deleting a ticket"""
        if not self.ticket_ids:
            self.log_result("Delete Ticket", "SKIP", "No tickets available")
            return

        try:
            ticket_id = self.ticket_ids[-1]  # Delete last ticket
            response = requests.delete(f"{API_URL}/tickets/{ticket_id}")

            if response.status_code in [200, 204]:
                self.log_result("Delete Ticket", "PASS", f"Deleted ticket {ticket_id}")
                self.ticket_ids.remove(ticket_id)
            else:
                self.log_result("Delete Ticket", "FAIL", f"Status code: {response.status_code}")

        except Exception as e:
            self.log_result("Delete Ticket", "ERROR", str(e))

    def run_all_tests(self):
        """Run complete test suite"""
        print("\n" + "=" * 70)
        print("API INTEGRATION TESTS - Port 18000")
        print("=" * 70 + "\n")

        # Basic tests
        self.test_health_check()
        self.test_api_docs()
        self.test_websocket_status()

        # Board tests
        self.test_get_boards()
        self.test_create_board()
        self.test_get_board_columns()

        # Ticket tests
        self.test_create_tickets(5)
        self.test_get_tickets()
        self.test_move_ticket()
        self.test_update_ticket()
        self.test_add_comment()
        self.test_delete_ticket()

        # Summary
        print("\n" + "=" * 70)
        print("TEST SUMMARY")
        print("=" * 70)

        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        errors = sum(1 for r in self.test_results if r["status"] == "ERROR")
        skipped = sum(1 for r in self.test_results if r["status"] == "SKIP")
        total = len(self.test_results)

        print(f"Total Tests: {total}")
        print(f"✓ Passed: {passed}")
        print(f"✗ Failed: {failed}")
        print(f"! Errors: {errors}")
        print(f"- Skipped: {skipped}")
        if total > 0:
            print(f"Success Rate: {(passed / total * 100):.1f}%")
        print("=" * 70 + "\n")

        return self.test_results


if __name__ == "__main__":
    tester = APITester()
    results = tester.run_all_tests()
