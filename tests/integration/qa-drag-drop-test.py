#!/usr/bin/env python3
"""
QA Engineer - Critical P0 Drag & Drop Bug Testing
Automated testing for the Board.tsx drag & drop fix
"""

import json
import sys
import time
from datetime import datetime

import requests


class DragDropQATester:
    def __init__(self):
        self.base_url = "http://localhost:18000"
        self.api_url = f"{self.base_url}/api"
        self.test_results = []
        self.error_count = 0

    def log_test(self, test_name, status, details=""):
        """Log test results"""
        result = {
            "test": test_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details,
        }
        self.test_results.append(result)
        status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"{status_icon} {test_name}: {status}")
        if details:
            print(f"   Details: {details}")
        if status == "FAIL":
            self.error_count += 1

    def test_backend_health(self):
        """Test backend API health"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.log_test("Backend Health Check", "PASS", f"Status: {data.get('status')}")
            else:
                self.log_test("Backend Health Check", "FAIL", f"HTTP {response.status_code}")
        except Exception as e:
            self.log_test("Backend Health Check", "FAIL", str(e))

    def test_boards_api(self):
        """Test boards API endpoint"""
        try:
            response = requests.get(f"{self.api_url}/boards/", timeout=5)
            if response.status_code == 200:
                boards = response.json()
                board_count = len(boards)
                self.log_test("Boards API", "PASS", f"Found {board_count} boards")
                return boards
            else:
                self.log_test("Boards API", "FAIL", f"HTTP {response.status_code}")
                return []
        except Exception as e:
            self.log_test("Boards API", "FAIL", str(e))
            return []

    def test_tickets_api(self, board_id):
        """Test tickets API endpoint"""
        try:
            response = requests.get(f"{self.api_url}/tickets/?board_id={board_id}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                tickets = data.get("items", [])
                ticket_count = len(tickets)
                self.log_test(
                    "Tickets API", "PASS", f"Found {ticket_count} tickets in board {board_id}"
                )
                return tickets
            else:
                self.log_test("Tickets API", "FAIL", f"HTTP {response.status_code}")
                return []
        except Exception as e:
            self.log_test("Tickets API", "FAIL", str(e))
            return []

    def test_create_ticket(self, board_id):
        """Test ticket creation"""
        try:
            ticket_data = {
                "title": f"QA Test Ticket - {datetime.now().strftime('%H:%M:%S')}",
                "description": "Automated test ticket for drag & drop testing",
                "priority": "high",
                "current_column": "Not Started",
                "board_id": board_id,
            }

            response = requests.post(f"{self.api_url}/tickets/", json=ticket_data, timeout=5)

            if response.status_code in [200, 201]:
                ticket = response.json()
                self.log_test("Create Ticket", "PASS", f"Created ticket ID: {ticket.get('id')}")
                return ticket
            else:
                self.log_test(
                    "Create Ticket", "FAIL", f"HTTP {response.status_code}: {response.text}"
                )
                return None
        except Exception as e:
            self.log_test("Create Ticket", "FAIL", str(e))
            return None

    def test_move_ticket_api(self, ticket_id, target_column):
        """Test the critical move ticket API (core of P0 bug)"""
        try:
            print(f"\n🚨 CRITICAL P0 TEST: Moving ticket {ticket_id} to {target_column}")

            # Test the move API endpoint directly
            move_data = {"column": target_column}

            response = requests.post(
                f"{self.api_url}/tickets/{ticket_id}/move", json=move_data, timeout=10
            )

            if response.status_code == 200:
                result = response.json()
                new_column = result.get("current_column", "UNKNOWN")
                if new_column == target_column:
                    self.log_test("Move Ticket API", "PASS", f"Moved to {new_column}")
                    return True
                else:
                    self.log_test(
                        "Move Ticket API", "FAIL", f"Expected {target_column}, got {new_column}"
                    )
                    return False
            else:
                error_text = response.text
                self.log_test(
                    "Move Ticket API", "FAIL", f"HTTP {response.status_code}: {error_text}"
                )
                return False

        except Exception as e:
            self.log_test("Move Ticket API", "FAIL", f"Exception: {str(e)}")
            return False

    def test_drag_drop_sequence(self, ticket_id):
        """Test complete drag & drop sequence through all columns"""
        columns = ["Not Started", "In Progress", "Blocked", "Ready for QC", "Done"]

        print(f"\n🎯 Testing drag & drop sequence for ticket {ticket_id}")

        for i, target_column in enumerate(columns[1:], 1):  # Skip first column
            print(f"   Step {i}: Moving to '{target_column}'")
            success = self.test_move_ticket_api(ticket_id, target_column)
            if not success:
                self.log_test("Drag Drop Sequence", "FAIL", f"Failed at step {i}: {target_column}")
                return False
            time.sleep(0.5)  # Brief pause between moves

        self.log_test("Drag Drop Sequence", "PASS", "All column transitions successful")
        return True

    def test_data_persistence(self, ticket_id):
        """Test that ticket data persists after moves"""
        try:
            # Get ticket details before and after a move
            response = requests.get(f"{self.api_url}/tickets/{ticket_id}", timeout=5)
            if response.status_code != 200:
                self.log_test("Data Persistence Check", "FAIL", "Could not fetch ticket details")
                return False

            before_data = response.json()
            original_title = before_data.get("title")
            original_description = before_data.get("description")

            # Move the ticket
            success = self.test_move_ticket_api(ticket_id, "In Progress")
            if not success:
                self.log_test("Data Persistence Check", "FAIL", "Move operation failed")
                return False

            # Check data after move
            response = requests.get(f"{self.api_url}/tickets/{ticket_id}", timeout=5)
            if response.status_code != 200:
                self.log_test("Data Persistence Check", "FAIL", "Could not fetch ticket after move")
                return False

            after_data = response.json()
            after_title = after_data.get("title")
            after_description = after_data.get("description")

            if original_title == after_title and original_description == after_description:
                self.log_test("Data Persistence Check", "PASS", "Title and description preserved")
                return True
            else:
                self.log_test("Data Persistence Check", "FAIL", "Data corruption detected!")
                return False

        except Exception as e:
            self.log_test("Data Persistence Check", "FAIL", str(e))
            return False

    def test_invalid_column(self, ticket_id):
        """Test handling of invalid column IDs"""
        try:
            # Try to move to an invalid column
            move_data = {"column": "Invalid Column"}

            response = requests.post(
                f"{self.api_url}/tickets/{ticket_id}/move", json=move_data, timeout=5
            )

            if response.status_code in [400, 422]:  # Should reject invalid column
                self.log_test("Invalid Column Handling", "PASS", "Properly rejected invalid column")
                return True
            else:
                self.log_test(
                    "Invalid Column Handling",
                    "FAIL",
                    f"Unexpected response: {response.status_code}",
                )
                return False

        except Exception as e:
            self.log_test("Invalid Column Handling", "FAIL", str(e))
            return False

    def run_comprehensive_test(self):
        """Run complete QA test suite"""
        print("🚨 QA ENGINEER - P0 DRAG & DROP BUG TESTING")
        print("=" * 60)
        print(f"Testing Backend: {self.base_url}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        # Basic connectivity tests
        self.test_backend_health()
        boards = self.test_boards_api()

        if not boards:
            print("❌ CRITICAL: No boards available for testing")
            return False

        # Use first available board
        board_id = boards[0]["id"]
        board_name = boards[0]["name"]
        print(f"🎯 Testing with board: '{board_name}' (ID: {board_id})")

        # Get existing tickets
        tickets = self.test_tickets_api(board_id)

        # Create a test ticket if needed
        test_ticket = self.test_create_ticket(board_id)
        if not test_ticket:
            if tickets:
                test_ticket = tickets[0]  # Use existing ticket
                print(f"⚠️  Using existing ticket: {test_ticket.get('id')}")
            else:
                print("❌ CRITICAL: Could not create or find tickets for testing")
                return False

        ticket_id = test_ticket.get("id")

        print(f"\n🎯 STARTING P0 CRITICAL TESTS with ticket {ticket_id}")
        print("-" * 50)

        # Core P0 drag & drop tests
        self.test_data_persistence(ticket_id)
        self.test_drag_drop_sequence(ticket_id)
        self.test_invalid_column(ticket_id)

        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)

        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t["status"] == "PASS"])
        failed_tests = self.error_count

        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests / total_tests) * 100:.1f}%")

        if failed_tests == 0:
            print("\n🎉 ALL TESTS PASSED - P0 Bug appears to be FIXED!")
        else:
            print(f"\n🚨 {failed_tests} FAILURES DETECTED - P0 Bug may still exist!")

        # Save detailed results
        results_file = f"qa-test-results-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        with open(results_file, "w") as f:
            json.dump(
                {
                    "timestamp": datetime.now().isoformat(),
                    "summary": {
                        "total": total_tests,
                        "passed": passed_tests,
                        "failed": failed_tests,
                        "success_rate": (passed_tests / total_tests) * 100,
                    },
                    "results": self.test_results,
                },
                f,
                indent=2,
            )

        print(f"\n💾 Detailed results saved to: {results_file}")

        return failed_tests == 0


if __name__ == "__main__":
    tester = DragDropQATester()
    success = tester.run_comprehensive_test()
    sys.exit(0 if success else 1)
