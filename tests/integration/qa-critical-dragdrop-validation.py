#!/usr/bin/env python3
"""
CRITICAL QA VALIDATION: Drag-Drop Data Corruption Bug
Tests for the critical data corruption issues reported in drag-drop operations
"""

import json
import sys
from datetime import datetime

import requests


class CriticalDragDropValidator:
    def __init__(self):
        self.base_url = "http://localhost:18000"
        self.results = []
        self.critical_issues = []

    def log_result(self, test_name, status, details=None):
        result = {
            "test": test_name,
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "details": details or {},
        }
        self.results.append(result)

        if status == "CRITICAL_FAIL":
            self.critical_issues.append(result)

        status_symbol = "🚨" if status == "CRITICAL_FAIL" else ("✅" if status == "PASS" else "❌")
        print(f"{status_symbol} {test_name}: {status}")
        if details:
            print(f"   Details: {details}")

    def test_api_accessibility(self):
        """Test if API endpoints are accessible"""
        try:
            # Test health endpoint
            health_resp = requests.get(f"{self.base_url}/health", timeout=5)
            if health_resp.status_code == 200:
                self.log_result("API Health", "PASS", {"port": 18000})
            else:
                self.log_result("API Health", "FAIL", {"status": health_resp.status_code})
                return False

            # Test boards endpoint
            boards_resp = requests.get(f"{self.base_url}/api/boards/", timeout=5)
            if boards_resp.status_code == 200:
                boards = boards_resp.json()
                self.log_result("Boards API", "PASS", {"board_count": len(boards)})
                return boards[0]["id"] if boards else None
            else:
                self.log_result("Boards API", "FAIL", {"status": boards_resp.status_code})
                return None

        except Exception as e:
            self.log_result("API Accessibility", "CRITICAL_FAIL", {"error": str(e)})
            return None

    def create_test_ticket(self, board_id):
        """Create a test ticket for drag-drop testing"""
        try:
            ticket_data = {
                "title": "CRITICAL QA Test - Drag Drop Validation",
                "description": "Testing for data corruption in drag-drop operations",
                "current_column": "Not Started",
                "board_id": board_id,
                "priority": "High",
            }

            response = requests.post(f"{self.base_url}/api/tickets/", json=ticket_data, timeout=5)
            if response.status_code == 201:
                ticket = response.json()
                self.log_result("Test Ticket Creation", "PASS", {"ticket_id": ticket["id"]})
                return ticket
            else:
                self.log_result(
                    "Test Ticket Creation",
                    "FAIL",
                    {"status": response.status_code, "response": response.text},
                )
                return None

        except Exception as e:
            self.log_result("Test Ticket Creation", "CRITICAL_FAIL", {"error": str(e)})
            return None

    def test_drag_drop_operation(self, ticket_id, from_column, to_column):
        """Test critical drag-drop operation for data corruption"""
        try:
            print(f"\n🔄 TESTING DRAG-DROP: {from_column} → {to_column}")

            # Prepare move data - this is where corruption happens
            move_data = {
                "column": to_column,  # This should be column NAME, not ID
                "moved_by": "qa-critical-test",
            }

            print(f"📤 API Request: POST /api/tickets/{ticket_id}/move")
            print(f"📤 Payload: {json.dumps(move_data, indent=2)}")

            # Make the move request
            response = requests.post(
                f"{self.base_url}/api/tickets/{ticket_id}/move", json=move_data, timeout=5
            )

            if response.status_code == 200:
                result_ticket = response.json()
                actual_column = result_ticket.get("current_column")

                print(f"📥 Response: {json.dumps(result_ticket, indent=2)}")

                # CRITICAL CHECK: Is the column value corrupted?
                if actual_column == to_column:
                    self.log_result(
                        f"Drag-Drop {from_column}→{to_column}",
                        "PASS",
                        {
                            "expected_column": to_column,
                            "actual_column": actual_column,
                            "ticket_id": ticket_id,
                        },
                    )
                    return True
                else:
                    # This is the CRITICAL BUG - column gets corrupted
                    self.log_result(
                        f"Drag-Drop {from_column}→{to_column}",
                        "CRITICAL_FAIL",
                        {
                            "expected_column": to_column,
                            "actual_column": actual_column,
                            "corruption_type": "Column value corruption",
                            "ticket_id": ticket_id,
                        },
                    )
                    return False
            else:
                self.log_result(
                    f"Drag-Drop {from_column}→{to_column}",
                    "CRITICAL_FAIL",
                    {
                        "status_code": response.status_code,
                        "response": response.text,
                        "api_error": True,
                    },
                )
                return False

        except Exception as e:
            self.log_result(
                f"Drag-Drop {from_column}→{to_column}",
                "CRITICAL_FAIL",
                {"error": str(e), "exception_type": type(e).__name__},
            )
            return False

    def check_database_corruption(self, board_id):
        """Check for existing corrupted cards in database"""
        try:
            # Get all tickets for the board
            response = requests.get(f"{self.base_url}/api/tickets?board_id={board_id}", timeout=5)

            if response.status_code == 200:
                tickets_data = response.json()
                tickets = (
                    tickets_data.get("items", tickets_data)
                    if isinstance(tickets_data, dict)
                    else tickets_data
                )

                valid_columns = ["Not Started", "In Progress", "Blocked", "Ready for QC", "Done"]
                corrupted_tickets = []

                for ticket in tickets:
                    current_column = ticket.get("current_column")
                    if current_column not in valid_columns:
                        corrupted_tickets.append(
                            {
                                "ticket_id": ticket.get("id"),
                                "invalid_column": current_column,
                                "title": ticket.get("title", "Unknown"),
                            }
                        )

                if corrupted_tickets:
                    self.log_result(
                        "Database Corruption Check",
                        "CRITICAL_FAIL",
                        {
                            "corrupted_count": len(corrupted_tickets),
                            "corrupted_tickets": corrupted_tickets,
                            "valid_columns": valid_columns,
                        },
                    )
                    return False
                else:
                    self.log_result(
                        "Database Corruption Check",
                        "PASS",
                        {"total_tickets": len(tickets), "corrupted_count": 0},
                    )
                    return True
            else:
                self.log_result(
                    "Database Corruption Check", "FAIL", {"status_code": response.status_code}
                )
                return False

        except Exception as e:
            self.log_result("Database Corruption Check", "CRITICAL_FAIL", {"error": str(e)})
            return False

    def run_critical_validation(self):
        """Run comprehensive critical validation"""
        print("🚨 CRITICAL DRAG-DROP VALIDATION STARTING")
        print("=" * 60)
        print("Checking for data corruption bugs that block deployment")
        print("=" * 60)

        # 1. Test API accessibility
        board_id = self.test_api_accessibility()
        if not board_id:
            print("🚨 CRITICAL: Cannot access API - aborting tests")
            return self.generate_critical_report()

        # 2. Check for existing database corruption
        self.check_database_corruption(board_id)

        # 3. Create test ticket for drag-drop testing
        test_ticket = self.create_test_ticket(board_id)
        if not test_ticket:
            print("🚨 CRITICAL: Cannot create test ticket - aborting drag-drop tests")
            return self.generate_critical_report()

        ticket_id = test_ticket["id"]

        # 4. Test critical drag-drop operations
        test_moves = [
            ("Not Started", "In Progress"),
            ("In Progress", "Blocked"),
            ("Blocked", "Ready for QC"),
            ("Ready for QC", "Done"),
        ]

        for from_col, to_col in test_moves:
            success = self.test_drag_drop_operation(ticket_id, from_col, to_col)
            if not success:
                print(f"🚨 CRITICAL FAILURE in {from_col} → {to_col}")
                break

        # 5. Clean up test ticket
        try:
            requests.delete(f"{self.base_url}/api/tickets/{ticket_id}")
        except:
            pass

        return self.generate_critical_report()

    def generate_critical_report(self):
        """Generate critical validation report"""
        critical_count = len(self.critical_issues)
        passed = len([r for r in self.results if r["status"] == "PASS"])
        failed = len([r for r in self.results if r["status"] in ["FAIL", "CRITICAL_FAIL"]])

        print("\n" + "=" * 60)
        print("🚨 CRITICAL VALIDATION RESULTS")
        print("=" * 60)
        print(f"CRITICAL ISSUES FOUND: {critical_count}")
        print(f"Total Tests: {len(self.results)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")

        if critical_count > 0:
            print("\n🚨 DEPLOYMENT BLOCKING ISSUES:")
            for issue in self.critical_issues:
                print(f"   - {issue['test']}: {issue['details']}")
            print("\n🚨 RECOMMENDATION: DO NOT DEPLOY - CRITICAL BUGS PRESENT")
        else:
            print("\n✅ NO CRITICAL ISSUES FOUND")
            print("✅ DRAG-DROP FUNCTIONALITY APPEARS SAFE")

        return {
            "critical_issues": critical_count,
            "deployment_safe": critical_count == 0,
            "results": self.results,
            "timestamp": datetime.now().isoformat(),
        }


if __name__ == "__main__":
    validator = CriticalDragDropValidator()
    report = validator.run_critical_validation()

    # Save critical report
    with open("qa-critical-dragdrop-results.json", "w") as f:
        json.dump(report, f, indent=2)

    print("\n📄 Critical report saved to: qa-critical-dragdrop-results.json")

    # Exit with error code if critical issues found
    sys.exit(1 if report["critical_issues"] > 0 else 0)
