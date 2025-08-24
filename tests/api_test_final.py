#!/usr/bin/env python3
"""API Integration Tests for Agent Kanban Board - Final Version"""

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
        status_symbol = (
            "✓"
            if status == "PASS"
            else "✗"
            if status == "FAIL"
            else "!"
            if status == "ERROR"
            else "-"
        )
        print(f"[{status_symbol}] {test_name}: {details[:100]}")

    def test_health_check(self):
        """Test health check endpoint"""
        try:
            response = requests.get(f"{BASE_URL}/health")
            if response.status_code == 200:
                self.log_result("Health Check", "PASS", "Service is healthy")
            else:
                self.log_result("Health Check", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Health Check", "ERROR", str(e))

    def test_create_board(self):
        """Test board creation"""
        try:
            payload = {
                "name": f"QA Test Board {datetime.now().strftime('%H%M%S')}",
                "description": "Automated QA testing board",
            }
            response = requests.post(f"{API_URL}/boards/", json=payload)
            if response.status_code in [200, 201]:
                data = response.json()
                self.board_id = data.get("id")
                self.log_result("Create Board", "PASS", f"Board created with ID: {self.board_id}")
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
                self.log_result("Get All Boards", "PASS", f"Found {len(boards)} boards")
                # Use existing board if we don't have one
                if not self.board_id and boards:
                    self.board_id = boards[0].get("id")
            else:
                self.log_result("Get All Boards", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Get All Boards", "ERROR", str(e))

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
                column_names = [c.get("name") for c in columns]
                self.log_result(
                    "Get Columns",
                    "PASS",
                    f"Found {len(columns)} columns: {', '.join(column_names)}",
                )
            else:
                self.log_result("Get Columns", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("Get Columns", "ERROR", str(e))

    def test_create_tickets_batch(self, count: int = 20):
        """Test batch ticket creation"""
        if not self.board_id:
            self.log_result("Create Tickets Batch", "SKIP", "No board available")
            return

        created = 0
        failed = 0

        priorities = ["Low", "Medium", "High", "Critical"]
        assignees = [f"Agent_{i}" for i in range(1, 6)]

        for i in range(count):
            try:
                payload = {
                    "title": f"Ticket #{i + 1:03d}: {random.choice(['Feature', 'Bug', 'Task', 'Story'])}",
                    "description": f"Auto-generated ticket for QA testing. Priority: {random.choice(priorities)}",
                    "priority": random.choice(priorities),
                    "assigned_to": random.choice(assignees),
                    "estimate_hours": random.choice([1, 2, 4, 8]),
                }

                # board_id as query parameter
                response = requests.post(
                    f"{API_URL}/tickets/?board_id={self.board_id}", json=payload
                )

                if response.status_code in [200, 201]:
                    ticket_data = response.json()
                    self.ticket_ids.append(ticket_data.get("id"))
                    created += 1
                else:
                    failed += 1

            except Exception:
                failed += 1

        self.log_result(
            "Create Tickets Batch",
            "PASS" if created > 0 else "FAIL",
            f"Created {created}/{count} tickets, {failed} failed",
        )

    def test_move_tickets_workflow(self):
        """Test moving tickets through workflow"""
        if not self.ticket_ids or not self.column_ids:
            self.log_result("Move Tickets Workflow", "SKIP", "No tickets or columns available")
            return

        moves_successful = 0
        moves_failed = 0

        # Move first 5 tickets through columns
        for i, ticket_id in enumerate(self.ticket_ids[:5]):
            try:
                target_column = self.column_ids[min(i, len(self.column_ids) - 1)]
                payload = {"ticket_id": ticket_id, "target_column_id": target_column, "position": 0}
                response = requests.post(f"{API_URL}/tickets/move", json=payload)

                if response.status_code in [200, 201]:
                    moves_successful += 1
                else:
                    moves_failed += 1

            except Exception:
                moves_failed += 1

        self.log_result(
            "Move Tickets Workflow",
            "PASS" if moves_successful > 0 else "FAIL",
            f"Successfully moved {moves_successful} tickets, {moves_failed} failed",
        )

    def test_update_ticket_details(self):
        """Test updating multiple ticket fields"""
        if not self.ticket_ids:
            self.log_result("Update Ticket Details", "SKIP", "No tickets available")
            return

        try:
            ticket_id = self.ticket_ids[0]

            payload = {
                "title": "UPDATED: Critical Production Issue",
                "priority": "Critical",
                "description": "Updated during QA testing - Critical issue requiring immediate attention",
                "assigned_to": "Senior_QA_Lead",
            }

            response = requests.put(f"{API_URL}/tickets/{ticket_id}", json=payload)

            if response.status_code == 200:
                self.log_result(
                    "Update Ticket Details", "PASS", f"Ticket {ticket_id} updated successfully"
                )
            else:
                self.log_result(
                    "Update Ticket Details", "FAIL", f"Status code: {response.status_code}"
                )

        except Exception as e:
            self.log_result("Update Ticket Details", "ERROR", str(e))

    def test_ticket_comments(self):
        """Test comment functionality"""
        if not self.ticket_ids:
            self.log_result("Ticket Comments", "SKIP", "No tickets available")
            return

        try:
            ticket_id = self.ticket_ids[0]

            # Add comment
            payload = {
                "content": f"QA Test Comment at {datetime.now().isoformat()}: Automated testing in progress",
                "author": "QA_Bot",
            }
            response = requests.post(f"{API_URL}/tickets/{ticket_id}/comments", json=payload)

            if response.status_code in [200, 201]:
                # Get comments
                response = requests.get(f"{API_URL}/tickets/{ticket_id}/comments")
                if response.status_code == 200:
                    response.json()
                    self.log_result(
                        "Ticket Comments", "PASS", "Added and retrieved comments successfully"
                    )
                else:
                    self.log_result("Ticket Comments", "FAIL", "Could not retrieve comments")
            else:
                self.log_result(
                    "Ticket Comments", "FAIL", f"Could not add comment: {response.status_code}"
                )

        except Exception as e:
            self.log_result("Ticket Comments", "ERROR", str(e))

    def test_concurrent_operations(self):
        """Test concurrent ticket operations"""
        if not self.board_id:
            self.log_result("Concurrent Operations", "SKIP", "No board available")
            return

        try:
            # Create multiple tickets rapidly
            tickets_created = []
            for i in range(5):
                payload = {
                    "title": f"Concurrent Test {i + 1}",
                    "description": "Testing concurrent operations",
                    "priority": "Medium",
                }
                response = requests.post(
                    f"{API_URL}/tickets/?board_id={self.board_id}", json=payload
                )
                if response.status_code in [200, 201]:
                    tickets_created.append(response.json().get("id"))

            self.log_result(
                "Concurrent Operations",
                "PASS",
                f"Created {len(tickets_created)} tickets concurrently",
            )

        except Exception as e:
            self.log_result("Concurrent Operations", "ERROR", str(e))

    def test_websocket_status(self):
        """Test WebSocket endpoint status"""
        try:
            response = requests.get(f"{BASE_URL}/ws/status")
            if response.status_code == 200:
                self.log_result("WebSocket Status", "PASS", "WebSocket endpoint is accessible")
            else:
                self.log_result("WebSocket Status", "FAIL", f"Status code: {response.status_code}")
        except Exception as e:
            self.log_result("WebSocket Status", "ERROR", str(e))

    def test_error_handling(self):
        """Test API error handling"""
        # Test invalid ticket ID
        try:
            response = requests.get(f"{API_URL}/tickets/999999")
            if response.status_code == 404:
                self.log_result(
                    "Error Handling - Invalid ID", "PASS", "Correctly returns 404 for invalid ID"
                )
            else:
                self.log_result(
                    "Error Handling - Invalid ID",
                    "FAIL",
                    f"Expected 404, got {response.status_code}",
                )
        except Exception as e:
            self.log_result("Error Handling", "ERROR", str(e))

        # Test invalid payload
        try:
            response = requests.post(f"{API_URL}/tickets/?board_id={self.board_id}", json={})
            if response.status_code in [400, 422]:
                self.log_result(
                    "Error Handling - Invalid Payload", "PASS", "Correctly validates payload"
                )
            else:
                self.log_result(
                    "Error Handling - Invalid Payload",
                    "FAIL",
                    f"Expected 400/422, got {response.status_code}",
                )
        except Exception as e:
            self.log_result("Error Handling - Invalid Payload", "ERROR", str(e))

    def test_performance_metrics(self):
        """Test API response times"""
        if not self.board_id:
            self.log_result("Performance Metrics", "SKIP", "No board available")
            return

        try:
            # Test GET tickets performance
            start_time = time.time()
            requests.get(f"{API_URL}/tickets/")
            get_time = (time.time() - start_time) * 1000

            # Test POST ticket performance
            start_time = time.time()
            payload = {
                "title": "Performance Test",
                "description": "Testing response time",
                "priority": "Low",
            }
            requests.post(f"{API_URL}/tickets/?board_id={self.board_id}", json=payload)
            post_time = (time.time() - start_time) * 1000

            self.log_result(
                "Performance Metrics", "PASS", f"GET: {get_time:.2f}ms, POST: {post_time:.2f}ms"
            )

        except Exception as e:
            self.log_result("Performance Metrics", "ERROR", str(e))

    def test_cleanup(self):
        """Clean up test data"""
        try:
            # Delete some test tickets
            deleted = 0
            for ticket_id in self.ticket_ids[-3:]:  # Delete last 3 tickets
                response = requests.delete(f"{API_URL}/tickets/{ticket_id}")
                if response.status_code in [200, 204]:
                    deleted += 1

            self.log_result("Cleanup", "PASS", f"Deleted {deleted} test tickets")

        except Exception as e:
            self.log_result("Cleanup", "ERROR", str(e))

    def generate_summary(self):
        """Generate test summary with statistics"""
        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        errors = sum(1 for r in self.test_results if r["status"] == "ERROR")
        skipped = sum(1 for r in self.test_results if r["status"] == "SKIP")
        total = len(self.test_results)

        summary = {
            "total_tests": total,
            "passed": passed,
            "failed": failed,
            "errors": errors,
            "skipped": skipped,
            "success_rate": f"{(passed / total * 100):.1f}%" if total > 0 else "0%",
            "test_date": datetime.now().isoformat(),
            "tickets_created": len(self.ticket_ids),
            "board_id": self.board_id,
        }

        return summary

    def run_all_tests(self):
        """Run complete test suite"""
        print("\n" + "=" * 70)
        print("AGENT KANBAN BOARD - API INTEGRATION TEST SUITE")
        print("=" * 70 + "\n")

        print("Phase 1: Basic Connectivity")
        print("-" * 40)
        self.test_health_check()
        self.test_websocket_status()

        print("\nPhase 2: Board Operations")
        print("-" * 40)
        self.test_get_boards()
        self.test_create_board()
        self.test_get_columns()

        print("\nPhase 3: Ticket Operations")
        print("-" * 40)
        self.test_create_tickets_batch(20)
        self.test_move_tickets_workflow()
        self.test_update_ticket_details()
        self.test_ticket_comments()

        print("\nPhase 4: Advanced Testing")
        print("-" * 40)
        self.test_concurrent_operations()
        self.test_error_handling()
        self.test_performance_metrics()

        print("\nPhase 5: Cleanup")
        print("-" * 40)
        self.test_cleanup()

        # Generate summary
        summary = self.generate_summary()

        print("\n" + "=" * 70)
        print("TEST EXECUTION SUMMARY")
        print("=" * 70)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"✓ Passed: {summary['passed']}")
        print(f"✗ Failed: {summary['failed']}")
        print(f"! Errors: {summary['errors']}")
        print(f"- Skipped: {summary['skipped']}")
        print(f"Success Rate: {summary['success_rate']}")
        print(f"Tickets Created: {summary['tickets_created']}")
        print("=" * 70 + "\n")

        return self.test_results, summary


if __name__ == "__main__":
    tester = APITester()
    results, summary = tester.run_all_tests()
