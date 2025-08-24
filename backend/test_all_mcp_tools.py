#!/usr/bin/env python3
"""
COMPREHENSIVE MCP TOOL VALIDATION SUITE
Tests ALL MCP tools to ensure complete functionality
"""

import asyncio
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from app.mcp.server import (
    add_comment,
    claim_task,
    create_task,
    edit_task,
    get_board_state,
    get_task,
    list_columns,
    list_tasks,
    update_task_status,
)

# Test configuration
TEST_BOARD_ID = 1
TEST_AGENT_ID = "comprehensive_mcp_test_agent"


class ComprehensiveMCPTestSuite:
    """Complete MCP functionality test suite"""

    def __init__(self):
        self.results = []
        self.created_tickets = []
        self.passed = 0
        self.failed = 0

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.results.append(
            {
                "test": name,
                "success": success,
                "details": details,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

        if success:
            self.passed += 1
            print(f"✅ PASS: {name}")
        else:
            self.failed += 1
            print(f"❌ FAIL: {name}")

        if details:
            print(f"    → {details}")

    async def test_list_columns(self):
        """Test list_columns MCP tool"""
        print("\n" + "=" * 60)
        print("TEST: list_columns")
        print("=" * 60)

        try:
            columns = await list_columns(board_id=TEST_BOARD_ID)
            print(f"Board {TEST_BOARD_ID} columns: {columns}")

            if isinstance(columns, list) and len(columns) > 0:
                self.log_test("list_columns", True, f"Found {len(columns)} columns")
            else:
                self.log_test("list_columns", False, "No columns returned")

        except Exception as e:
            self.log_test("list_columns", False, f"Error: {str(e)}")

    async def test_get_board_state(self):
        """Test get_board_state MCP tool"""
        print("\n" + "=" * 60)
        print("TEST: get_board_state")
        print("=" * 60)

        try:
            board_state = await get_board_state(board_id=TEST_BOARD_ID)

            required_fields = [
                "board_id",
                "board_name",
                "columns",
                "tickets_by_column",
                "total_tickets",
            ]
            missing_fields = [field for field in required_fields if field not in board_state]

            if not missing_fields:
                print(f"Board: {board_state['board_name']}")
                print(f"Total tickets: {board_state['total_tickets']}")
                print(f"Columns: {len(board_state['columns'])}")
                self.log_test("get_board_state", True, "All required fields present")
            else:
                self.log_test("get_board_state", False, f"Missing fields: {missing_fields}")

        except Exception as e:
            self.log_test("get_board_state", False, f"Error: {str(e)}")

    async def test_list_tasks(self):
        """Test list_tasks MCP tool with various filters"""
        print("\n" + "=" * 60)
        print("TEST: list_tasks (with filters)")
        print("=" * 60)

        try:
            # Test without filters
            all_tasks = await list_tasks()
            print(f"All tasks: {len(all_tasks)}")
            self.log_test("list_tasks (no filter)", True, f"Found {len(all_tasks)} tasks")

            # Test with board filter
            board_tasks = await list_tasks(board_id=TEST_BOARD_ID)
            print(f"Board {TEST_BOARD_ID} tasks: {len(board_tasks)}")
            self.log_test("list_tasks (board filter)", True, f"Found {len(board_tasks)} tasks")

            # Test with column filter
            not_started_tasks = await list_tasks(column="Not Started")
            print(f"'Not Started' tasks: {len(not_started_tasks)}")
            self.log_test(
                "list_tasks (column filter)", True, f"Found {len(not_started_tasks)} tasks"
            )

        except Exception as e:
            self.log_test("list_tasks", False, f"Error: {str(e)}")

    async def test_create_task(self):
        """Test create_task MCP tool"""
        print("\n" + "=" * 60)
        print("TEST: create_task")
        print("=" * 60)

        try:
            timestamp = datetime.utcnow().strftime("%H:%M:%S.%f")[:-3]

            # Test comprehensive ticket creation
            new_ticket = await create_task(
                title=f"Comprehensive MCP Test - {timestamp}",
                board_id=TEST_BOARD_ID,
                description="Testing all MCP create_task parameters",
                acceptance_criteria="Should create ticket with all fields populated",
                priority="1.5",
                assignee=None,
                created_by=TEST_AGENT_ID,
            )

            self.created_tickets.append(new_ticket["id"])

            print(f"Created ticket ID: {new_ticket['id']}")
            print(f"Title: {new_ticket['title']}")
            print(f"Priority: {new_ticket['priority']}")
            print(f"Column: {new_ticket['column']}")

            # Verify creation
            if new_ticket["board_id"] == TEST_BOARD_ID and new_ticket["column"] == "Not Started":
                self.log_test(
                    "create_task", True, f"Ticket {new_ticket['id']} created successfully"
                )
            else:
                self.log_test("create_task", False, "Ticket not created with correct parameters")

        except Exception as e:
            self.log_test("create_task", False, f"Error: {str(e)}")

    async def test_get_task(self):
        """Test get_task MCP tool"""
        print("\n" + "=" * 60)
        print("TEST: get_task")
        print("=" * 60)

        if not self.created_tickets:
            self.log_test("get_task", False, "No tickets available to test")
            return

        try:
            ticket_id = self.created_tickets[0]
            ticket_details = await get_task(ticket_id=ticket_id)

            required_fields = [
                "id",
                "title",
                "description",
                "priority",
                "column",
                "board_id",
                "comments",
                "history",
            ]
            missing_fields = [field for field in required_fields if field not in ticket_details]

            if not missing_fields:
                print(f"Retrieved ticket {ticket_id}:")
                print(f"  Title: {ticket_details['title']}")
                print(f"  Priority: {ticket_details['priority']}")
                print(f"  Column: {ticket_details['column']}")
                print(f"  Comments: {len(ticket_details['comments'])}")
                print(f"  History: {len(ticket_details['history'])}")
                self.log_test("get_task", True, "All required fields present")
            else:
                self.log_test("get_task", False, f"Missing fields: {missing_fields}")

        except Exception as e:
            self.log_test("get_task", False, f"Error: {str(e)}")

    async def test_claim_task(self):
        """Test claim_task MCP tool"""
        print("\n" + "=" * 60)
        print("TEST: claim_task")
        print("=" * 60)

        if not self.created_tickets:
            self.log_test("claim_task", False, "No tickets available to test")
            return

        try:
            ticket_id = self.created_tickets[0]

            # First verify ticket is unclaimed
            ticket_before = await get_task(ticket_id=ticket_id)
            if ticket_before["assignee"]:
                print(f"Ticket already assigned to {ticket_before['assignee']}")
                # Create another ticket for this test
                new_ticket = await create_task(
                    title=f"Claim Test Ticket - {datetime.utcnow().strftime('%H:%M:%S')}",
                    board_id=TEST_BOARD_ID,
                    description="For testing claim functionality",
                    created_by=TEST_AGENT_ID,
                )
                ticket_id = new_ticket["id"]
                self.created_tickets.append(ticket_id)

            # Claim the ticket
            claim_result = await claim_task(ticket_id=ticket_id, agent_id=TEST_AGENT_ID)

            print(f"Claim result: {claim_result['message']}")

            # Verify claim
            ticket_after = await get_task(ticket_id=ticket_id)
            if ticket_after["assignee"] == TEST_AGENT_ID:
                self.log_test("claim_task", True, f"Ticket claimed by {TEST_AGENT_ID}")
            else:
                self.log_test("claim_task", False, "Assignee not set correctly")

        except Exception as e:
            self.log_test("claim_task", False, f"Error: {str(e)}")

    async def test_edit_task(self):
        """Test edit_task MCP tool"""
        print("\n" + "=" * 60)
        print("TEST: edit_task")
        print("=" * 60)

        if not self.created_tickets:
            self.log_test("edit_task", False, "No tickets available to test")
            return

        try:
            ticket_id = self.created_tickets[-1]  # Use last created ticket

            # Edit multiple fields
            edit_result = await edit_task(
                ticket_id=ticket_id,
                title="EDITED: Comprehensive MCP Test",
                description="EDITED: Updated via edit_task MCP tool",
                priority="2.5",
                acceptance_criteria="EDITED: Should update all specified fields",
                changed_by=TEST_AGENT_ID,
            )

            print(f"Edit result: {edit_result['message']}")

            # Verify edits
            updated_ticket = await get_task(ticket_id=ticket_id)

            checks = [
                ("title", "EDITED: Comprehensive MCP Test"),
                ("description", "EDITED: Updated via edit_task MCP tool"),
                ("priority", "2.5"),
                ("acceptance_criteria", "EDITED: Should update all specified fields"),
            ]

            all_correct = True
            for field, expected in checks:
                if updated_ticket[field] != expected:
                    print(f"Field {field}: expected '{expected}', got '{updated_ticket[field]}'")
                    all_correct = False

            if all_correct:
                self.log_test("edit_task", True, "All fields updated correctly")
            else:
                self.log_test("edit_task", False, "Some fields not updated correctly")

        except Exception as e:
            self.log_test("edit_task", False, f"Error: {str(e)}")

    async def test_add_comment(self):
        """Test add_comment MCP tool"""
        print("\n" + "=" * 60)
        print("TEST: add_comment")
        print("=" * 60)

        if not self.created_tickets:
            self.log_test("add_comment", False, "No tickets available to test")
            return

        try:
            ticket_id = self.created_tickets[0]

            # Add a comment
            comment_text = f"MCP test comment added at {datetime.utcnow().isoformat()}"
            comment_result = await add_comment(
                ticket_id=ticket_id, text=comment_text, author=TEST_AGENT_ID
            )

            print(f"Added comment ID: {comment_result['id']}")

            # Verify comment was added
            ticket_with_comment = await get_task(ticket_id=ticket_id)

            comment_found = any(
                c["text"] == comment_text and c["author"] == TEST_AGENT_ID
                for c in ticket_with_comment["comments"]
            )

            if comment_found:
                self.log_test("add_comment", True, f"Comment added to ticket {ticket_id}")
            else:
                self.log_test("add_comment", False, "Comment not found in ticket")

        except Exception as e:
            self.log_test("add_comment", False, f"Error: {str(e)}")

    async def test_update_task_status(self):
        """Test update_task_status MCP tool"""
        print("\n" + "=" * 60)
        print("TEST: update_task_status")
        print("=" * 60)

        if not self.created_tickets:
            self.log_test("update_task_status", False, "No tickets available to test")
            return

        try:
            ticket_id = self.created_tickets[0]

            # Get available columns
            columns = await list_columns(board_id=TEST_BOARD_ID)

            # Test moving through columns
            test_moves = [
                ("Not Started", "In Progress"),
                ("In Progress", "Ready for QC"),
                ("Ready for QC", "Done"),
            ]

            moves_successful = 0

            for from_col, to_col in test_moves:
                if to_col in columns:
                    move_result = await update_task_status(
                        ticket_id=ticket_id, column=to_col, updated_by=TEST_AGENT_ID
                    )

                    print(
                        f"Moved from '{move_result['from_column']}' to '{move_result['to_column']}'"
                    )

                    # Verify move
                    updated_ticket = await get_task(ticket_id=ticket_id)
                    if updated_ticket["column"] == to_col:
                        moves_successful += 1
                    else:
                        print(
                            f"Move verification failed: expected {to_col}, "
                            f"got {updated_ticket['column']}"
                        )
                        break

            if moves_successful == len(test_moves):
                self.log_test(
                    "update_task_status",
                    True,
                    f"Successfully moved through {moves_successful} columns",
                )
            else:
                self.log_test(
                    "update_task_status",
                    False,
                    f"Only {moves_successful}/{len(test_moves)} moves successful",
                )

        except Exception as e:
            self.log_test("update_task_status", False, f"Error: {str(e)}")

    async def run_all_tests(self):
        """Run all comprehensive MCP tests"""
        print("\n" + "=" * 80)
        print("COMPREHENSIVE MCP TOOL VALIDATION SUITE")
        print("=" * 80)
        print(f"Test Board: {TEST_BOARD_ID}")
        print(f"Test Agent: {TEST_AGENT_ID}")
        print(f"Start Time: {datetime.utcnow().isoformat()}")

        # Run all tests in order
        await self.test_list_columns()
        await self.test_get_board_state()
        await self.test_list_tasks()
        await self.test_create_task()
        await self.test_get_task()
        await self.test_claim_task()
        await self.test_edit_task()
        await self.test_add_comment()
        await self.test_update_task_status()

        # Summary
        print("\n" + "=" * 80)
        print("COMPREHENSIVE TEST RESULTS")
        print("=" * 80)

        total = self.passed + self.failed
        success_rate = (self.passed / total * 100) if total > 0 else 0

        print(f"Total Tests: {total}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"Success Rate: {success_rate:.1f}%")

        # List failed tests
        if self.failed > 0:
            print("\nFailed Tests:")
            for result in self.results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")

        # Cleanup info
        if self.created_tickets:
            print(f"\nCreated Test Tickets: {len(self.created_tickets)}")
            print(f"Ticket IDs: {self.created_tickets}")
            print("Note: Test tickets remain in system (no delete MCP tool)")

        # Save detailed results
        results_file = (
            f"comprehensive_mcp_results_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        )
        with open(results_file, "w") as f:
            json.dump(
                {
                    "test_run": datetime.utcnow().isoformat(),
                    "summary": {
                        "total": total,
                        "passed": self.passed,
                        "failed": self.failed,
                        "success_rate": success_rate,
                    },
                    "created_tickets": self.created_tickets,
                    "detailed_results": self.results,
                },
                f,
                indent=2,
            )

        print(f"Detailed results saved to: {results_file}")

        # Final status
        if self.failed == 0:
            print("\n🎉 ALL MCP TOOLS VALIDATED SUCCESSFULLY!")
            print("✅ MCP server is fully functional and ready for agent use")
            return True
        else:
            print(f"\n⚠️  {self.failed} MCP tool(s) failed validation")
            return False


async def main():
    """Main test runner"""
    suite = ComprehensiveMCPTestSuite()
    success = await suite.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
