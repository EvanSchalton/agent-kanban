#!/usr/bin/env python3
"""Phase 1 MCP Tools Testing - No Authentication Required"""

import json
from datetime import datetime

import requests

BASE_URL = "http://localhost:18000"
API_URL = f"{BASE_URL}/api"


class Phase1MCPTester:
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
        print(f"[{status_symbol}] {test_name}: {details[:80]}")

    def test_api_connectivity(self):
        """Test basic API connectivity"""
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=5)
            if response.status_code == 200:
                self.log_result("API Connectivity", "PASS", f"Health check OK: {response.json()}")
            else:
                self.log_result(
                    "API Connectivity", "FAIL", f"Health check failed: {response.status_code}"
                )
        except Exception as e:
            self.log_result("API Connectivity", "ERROR", str(e))

    def test_get_boards(self):
        """MCP Tool 1: Get all boards"""
        try:
            response = requests.get(f"{API_URL}/boards/", timeout=5)
            if response.status_code == 200:
                boards = response.json()
                self.log_result("MCP Get Boards", "PASS", f"Retrieved {len(boards)} boards")
                if boards:
                    self.board_id = boards[0].get("id")
                    return True
            else:
                self.log_result("MCP Get Boards", "FAIL", f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("MCP Get Boards", "ERROR", str(e))
        return False

    def test_create_board(self):
        """MCP Tool 2: Create new board"""
        try:
            board_data = {
                "name": f"Phase 1 Test Board {datetime.now().strftime('%H%M%S')}",
                "description": "Testing MCP tools - no auth required",
            }
            response = requests.post(f"{API_URL}/boards/", json=board_data, timeout=5)
            if response.status_code in [200, 201]:
                board = response.json()
                new_board_id = board.get("id")
                if not self.board_id:
                    self.board_id = new_board_id
                self.log_result("MCP Create Board", "PASS", f"Created board ID: {new_board_id}")
                return True
            else:
                self.log_result(
                    "MCP Create Board",
                    "FAIL",
                    f"Status: {response.status_code}, Response: {response.text[:100]}",
                )
        except Exception as e:
            self.log_result("MCP Create Board", "ERROR", str(e))
        return False

    def test_get_board_columns(self):
        """MCP Tool 3: Get board columns"""
        if not self.board_id:
            self.log_result("MCP Get Columns", "SKIP", "No board available")
            return False

        try:
            response = requests.get(f"{API_URL}/boards/{self.board_id}/columns", timeout=5)
            if response.status_code == 200:
                columns = response.json()
                self.column_ids = [col.get("id") for col in columns if col.get("id")]
                column_names = [col.get("name", "Unknown") for col in columns]
                expected_columns = ["Not Started", "In Progress", "Blocked", "Ready for QC", "Done"]

                # Check if we have the expected Phase 1 columns
                has_expected = all(col in column_names for col in expected_columns)
                self.log_result(
                    "MCP Get Columns",
                    "PASS" if has_expected else "WARNING",
                    f"Found columns: {', '.join(column_names)}",
                )
                return True
            else:
                self.log_result("MCP Get Columns", "FAIL", f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("MCP Get Columns", "ERROR", str(e))
        return False

    def test_create_tickets(self, count: int = 5):
        """MCP Tool 4: Create tickets (test bulk creation)"""
        if not self.board_id:
            self.log_result("MCP Create Tickets", "SKIP", "No board available")
            return False

        created_count = 0
        priorities = ["Low", "Medium", "High", "Critical"]

        for i in range(count):
            try:
                ticket_data = {
                    "title": f"Phase 1 Test Ticket {i + 1}",
                    "description": f"Testing MCP tools - ticket {i + 1} with no authentication required",
                    "priority": priorities[i % len(priorities)],
                    "assigned_to": f"agent_{(i % 3) + 1}",
                    "estimate_hours": [1, 2, 4, 8][i % 4],
                }

                response = requests.post(
                    f"{API_URL}/tickets/?board_id={self.board_id}", json=ticket_data, timeout=5
                )

                if response.status_code in [200, 201]:
                    ticket = response.json()
                    self.ticket_ids.append(ticket.get("id"))
                    created_count += 1
                else:
                    # Log the specific error for the 422 issue mentioned in the sprint plan
                    error_details = (
                        response.text[:200] if response.text else f"Status {response.status_code}"
                    )
                    print(f"  Ticket {i + 1} creation failed: {error_details}")

            except Exception as e:
                print(f"  Ticket {i + 1} error: {str(e)}")

        if created_count > 0:
            self.log_result(
                "MCP Create Tickets", "PASS", f"Created {created_count}/{count} tickets"
            )
        else:
            self.log_result(
                "MCP Create Tickets", "FAIL", f"Created 0/{count} tickets - 422 validation errors"
            )

        return created_count > 0

    def test_get_tickets(self):
        """MCP Tool 5: Get all tickets"""
        try:
            response = requests.get(f"{API_URL}/tickets/", timeout=5)
            if response.status_code == 200:
                tickets = response.json()
                self.log_result("MCP Get Tickets", "PASS", f"Retrieved {len(tickets)} tickets")
                return True
            else:
                self.log_result("MCP Get Tickets", "FAIL", f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("MCP Get Tickets", "ERROR", str(e))
        return False

    def test_update_ticket(self):
        """MCP Tool 6: Update ticket"""
        if not self.ticket_ids:
            self.log_result("MCP Update Ticket", "SKIP", "No tickets available")
            return False

        try:
            ticket_id = self.ticket_ids[0]
            update_data = {
                "title": "Updated Phase 1 Test Ticket",
                "description": "Updated via MCP tools testing",
                "priority": "Critical",
            }

            response = requests.put(f"{API_URL}/tickets/{ticket_id}", json=update_data, timeout=5)

            if response.status_code == 200:
                self.log_result("MCP Update Ticket", "PASS", f"Updated ticket {ticket_id}")
                return True
            else:
                self.log_result("MCP Update Ticket", "FAIL", f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("MCP Update Ticket", "ERROR", str(e))
        return False

    def test_move_ticket(self):
        """MCP Tool 7: Move ticket between columns"""
        if not self.ticket_ids or not self.column_ids:
            self.log_result("MCP Move Ticket", "SKIP", "No tickets or columns available")
            return False

        try:
            ticket_id = self.ticket_ids[0]
            target_column = self.column_ids[1] if len(self.column_ids) > 1 else self.column_ids[0]

            move_data = {"ticket_id": ticket_id, "target_column_id": target_column, "position": 0}

            response = requests.post(f"{API_URL}/tickets/move", json=move_data, timeout=5)

            if response.status_code in [200, 201]:
                self.log_result(
                    "MCP Move Ticket", "PASS", f"Moved ticket {ticket_id} to column {target_column}"
                )
                return True
            else:
                self.log_result(
                    "MCP Move Ticket",
                    "FAIL",
                    f"Status: {response.status_code}, Response: {response.text[:100]}",
                )
        except Exception as e:
            self.log_result("MCP Move Ticket", "ERROR", str(e))
        return False

    def test_add_comment(self):
        """MCP Tool 8: Add comment to ticket"""
        if not self.ticket_ids:
            self.log_result("MCP Add Comment", "SKIP", "No tickets available")
            return False

        try:
            ticket_id = self.ticket_ids[0]
            comment_data = {
                "content": f"Phase 1 test comment added at {datetime.now().isoformat()}",
                "author": "mcp_tester",
            }

            response = requests.post(
                f"{API_URL}/tickets/{ticket_id}/comments", json=comment_data, timeout=5
            )

            if response.status_code in [200, 201]:
                self.log_result("MCP Add Comment", "PASS", f"Added comment to ticket {ticket_id}")
                return True
            else:
                self.log_result("MCP Add Comment", "FAIL", f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("MCP Add Comment", "ERROR", str(e))
        return False

    def test_delete_ticket(self):
        """MCP Tool 9: Delete ticket"""
        if len(self.ticket_ids) < 2:
            self.log_result("MCP Delete Ticket", "SKIP", "Not enough tickets for safe deletion")
            return False

        try:
            ticket_id = self.ticket_ids[-1]  # Delete last ticket
            response = requests.delete(f"{API_URL}/tickets/{ticket_id}", timeout=5)

            if response.status_code in [200, 204]:
                self.log_result("MCP Delete Ticket", "PASS", f"Deleted ticket {ticket_id}")
                self.ticket_ids.remove(ticket_id)
                return True
            else:
                self.log_result("MCP Delete Ticket", "FAIL", f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("MCP Delete Ticket", "ERROR", str(e))
        return False

    def test_websocket_endpoint(self):
        """Test WebSocket endpoint availability"""
        try:
            # Test WebSocket status endpoint
            response = requests.get(f"{BASE_URL}/ws/status", timeout=5)
            if response.status_code == 200:
                self.log_result(
                    "WebSocket Endpoint", "PASS", "WebSocket status endpoint accessible"
                )
            elif response.status_code == 404:
                self.log_result(
                    "WebSocket Endpoint", "WARNING", "WebSocket status endpoint not found"
                )
            else:
                self.log_result("WebSocket Endpoint", "FAIL", f"Status: {response.status_code}")
        except Exception as e:
            self.log_result("WebSocket Endpoint", "ERROR", str(e))

    def run_all_mcp_tests(self):
        """Execute all MCP tools tests"""
        print("\n" + "=" * 70)
        print("PHASE 1 MCP TOOLS TESTING - NO AUTHENTICATION")
        print("=" * 70 + "\n")

        # Basic connectivity
        print("🔍 Phase 1: Basic Connectivity")
        print("-" * 40)
        self.test_api_connectivity()
        self.test_websocket_endpoint()

        # Board operations
        print("\n📋 Phase 2: Board Operations")
        print("-" * 40)
        board_success = self.test_get_boards()
        if not board_success:
            board_success = self.test_create_board()
        self.test_get_board_columns()

        # Ticket operations
        print("\n🎫 Phase 3: Ticket Operations")
        print("-" * 40)
        self.test_create_tickets(5)
        self.test_get_tickets()
        self.test_update_ticket()
        self.test_move_ticket()
        self.test_add_comment()
        self.test_delete_ticket()

        # Results summary
        print("\n" + "=" * 70)
        print("MCP TOOLS TEST SUMMARY")
        print("=" * 70)

        passed = sum(1 for r in self.test_results if r["status"] == "PASS")
        failed = sum(1 for r in self.test_results if r["status"] == "FAIL")
        errors = sum(1 for r in self.test_results if r["status"] == "ERROR")
        warnings = sum(1 for r in self.test_results if r["status"] == "WARNING")
        skipped = sum(1 for r in self.test_results if r["status"] == "SKIP")
        total = len(self.test_results)

        print(f"Total Tests: {total}")
        print(f"✓ Passed: {passed}")
        print(f"✗ Failed: {failed}")
        print(f"! Errors: {errors}")
        print(f"⚠ Warnings: {warnings}")
        print(f"- Skipped: {skipped}")

        if total > 0:
            success_rate = (passed / total) * 100
            print(f"Success Rate: {success_rate:.1f}%")

            if success_rate >= 80:
                print("🎯 MCP TOOLS: READY FOR AGENT USE")
            elif success_rate >= 60:
                print("⚠️ MCP TOOLS: MOSTLY WORKING, SOME ISSUES")
            else:
                print("❌ MCP TOOLS: MAJOR ISSUES, NOT READY")

        print("=" * 70 + "\n")

        return {
            "results": self.test_results,
            "summary": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "errors": errors,
                "warnings": warnings,
                "success_rate": success_rate if total > 0 else 0,
            },
            "board_id": self.board_id,
            "tickets_created": len(self.ticket_ids),
        }


if __name__ == "__main__":
    tester = Phase1MCPTester()
    results = tester.run_all_mcp_tests()

    # Save results
    with open("/workspaces/agent-kanban/tests/phase1_mcp_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print("📁 Results saved to phase1_mcp_results.json")
