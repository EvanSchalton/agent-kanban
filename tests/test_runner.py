#!/usr/bin/env python3
"""
Comprehensive test runner for Agent Kanban Board
Executes all test suites and generates reports
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestRunner:
    def __init__(self):
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "suites": {},
            "summary": {"total": 0, "passed": 0, "failed": 0, "skipped": 0},
        }

    async def run_mcp_tests(self):
        """Test all MCP tools"""
        print("\n" + "=" * 60)
        print("MCP TOOLS TESTING")
        print("=" * 60)

        from backend.app.mcp.server import (
            add_comment,
            claim_task,
            create_task,
            get_board_state,
            get_task,
            list_tasks,
            update_task_status,
        )

        suite_results = {"passed": 0, "failed": 0, "tests": []}

        # Test 1: List tasks
        try:
            print("\n[TEST] list_tasks with board_id filter")
            tasks = await list_tasks(board_id=1)
            assert isinstance(tasks, list), "list_tasks should return a list"
            print(f"✅ PASS: Retrieved {len(tasks)} tasks")
            suite_results["passed"] += 1
            suite_results["tests"].append({"name": "list_tasks", "status": "passed"})
        except Exception as e:
            print(f"❌ FAIL: {str(e)}")
            suite_results["failed"] += 1
            suite_results["tests"].append(
                {"name": "list_tasks", "status": "failed", "error": str(e)}
            )

        # Test 2: Create task
        try:
            print("\n[TEST] create_task with all fields")
            new_task = await create_task(
                title="QA Test Task",
                board_id=1,
                description="Testing task creation via MCP",
                priority="99.0",
                acceptance_criteria="Task should be created successfully",
            )
            assert "id" in new_task, "create_task should return task with ID"
            print(f"✅ PASS: Created task ID {new_task['id']}")
            suite_results["passed"] += 1
            suite_results["tests"].append({"name": "create_task", "status": "passed"})
            test_task_id = new_task["id"]
        except Exception as e:
            print(f"❌ FAIL: {str(e)}")
            suite_results["failed"] += 1
            suite_results["tests"].append(
                {"name": "create_task", "status": "failed", "error": str(e)}
            )
            test_task_id = None

        # Test 3: Get task details
        if test_task_id:
            try:
                print("\n[TEST] get_task for existing ID")
                task_detail = await get_task(ticket_id=test_task_id)
                assert task_detail["title"] == "QA Test Task", "Task title should match"
                print("✅ PASS: Retrieved task details")
                suite_results["passed"] += 1
                suite_results["tests"].append({"name": "get_task", "status": "passed"})
            except Exception as e:
                print(f"❌ FAIL: {str(e)}")
                suite_results["failed"] += 1
                suite_results["tests"].append(
                    {"name": "get_task", "status": "failed", "error": str(e)}
                )

        # Test 4: Claim task
        if test_task_id:
            try:
                print("\n[TEST] claim_task assignment")
                result = await claim_task(ticket_id=test_task_id, agent_id="qa_agent_001")
                assert "success" in result["message"].lower(), "Claim should succeed"
                print("✅ PASS: Task claimed by qa_agent_001")
                suite_results["passed"] += 1
                suite_results["tests"].append({"name": "claim_task", "status": "passed"})
            except Exception as e:
                print(f"❌ FAIL: {str(e)}")
                suite_results["failed"] += 1
                suite_results["tests"].append(
                    {"name": "claim_task", "status": "failed", "error": str(e)}
                )

        # Test 5: Update task status
        if test_task_id:
            try:
                print("\n[TEST] update_task_status column transition")
                result = await update_task_status(ticket_id=test_task_id, column="In Progress")
                assert "success" in result["message"].lower(), "Status update should succeed"
                print("✅ PASS: Task moved to In Progress")
                suite_results["passed"] += 1
                suite_results["tests"].append({"name": "update_task_status", "status": "passed"})
            except Exception as e:
                print(f"❌ FAIL: {str(e)}")
                suite_results["failed"] += 1
                suite_results["tests"].append(
                    {"name": "update_task_status", "status": "failed", "error": str(e)}
                )

        # Test 6: Add comment
        if test_task_id:
            try:
                print("\n[TEST] add_comment with attribution")
                comment = await add_comment(
                    ticket_id=test_task_id, text="QA testing in progress", author="qa_agent_001"
                )
                assert "id" in comment, "Comment should have ID"
                print(f"✅ PASS: Comment added (ID: {comment['id']})")
                suite_results["passed"] += 1
                suite_results["tests"].append({"name": "add_comment", "status": "passed"})
            except Exception as e:
                print(f"❌ FAIL: {str(e)}")
                suite_results["failed"] += 1
                suite_results["tests"].append(
                    {"name": "add_comment", "status": "failed", "error": str(e)}
                )

        # Test 7: Get board state
        try:
            print("\n[TEST] get_board_state comprehensive view")
            board_state = await get_board_state(board_id=1)
            assert "board_name" in board_state, "Board state should include name"
            assert "tickets_by_column" in board_state, "Should include tickets by column"
            print(f"✅ PASS: Board state retrieved - {board_state['total_tickets']} total tickets")
            suite_results["passed"] += 1
            suite_results["tests"].append({"name": "get_board_state", "status": "passed"})
        except Exception as e:
            print(f"❌ FAIL: {str(e)}")
            suite_results["failed"] += 1
            suite_results["tests"].append(
                {"name": "get_board_state", "status": "failed", "error": str(e)}
            )

        self.results["suites"]["mcp_tools"] = suite_results
        return suite_results

    def run_api_tests(self):
        """Test REST API endpoints"""
        print("\n" + "=" * 60)
        print("REST API TESTING")
        print("=" * 60)

        import requests

        base_url = "http://localhost:18000"
        suite_results = {"passed": 0, "failed": 0, "tests": []}

        # Test 1: Health check
        try:
            print("\n[TEST] API health check")
            response = requests.get(f"{base_url}/health")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            print("✅ PASS: API is healthy")
            suite_results["passed"] += 1
            suite_results["tests"].append({"name": "health_check", "status": "passed"})
        except Exception as e:
            print(f"❌ FAIL: {str(e)}")
            suite_results["failed"] += 1
            suite_results["tests"].append(
                {"name": "health_check", "status": "failed", "error": str(e)}
            )

        # Test 2: Get boards
        try:
            print("\n[TEST] GET /api/boards")
            response = requests.get(f"{base_url}/api/boards")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            boards = response.json()
            assert isinstance(boards, list), "Should return list of boards"
            print(f"✅ PASS: Retrieved {len(boards)} boards")
            suite_results["passed"] += 1
            suite_results["tests"].append({"name": "get_boards", "status": "passed"})
        except Exception as e:
            print(f"❌ FAIL: {str(e)}")
            suite_results["failed"] += 1
            suite_results["tests"].append(
                {"name": "get_boards", "status": "failed", "error": str(e)}
            )

        # Test 3: Create ticket via API
        try:
            print("\n[TEST] POST /api/tickets")
            ticket_data = {
                "title": "API Test Ticket",
                "description": "Created via REST API test",
                "board_id": 1,
                "priority": "50.0",
                "column": "Not Started",
            }
            response = requests.post(f"{base_url}/api/tickets", json=ticket_data)
            assert response.status_code in [200, 201], (
                f"Expected 200/201, got {response.status_code}"
            )
            created_ticket = response.json()
            assert created_ticket["title"] == ticket_data["title"], "Title should match"
            print(f"✅ PASS: Created ticket ID {created_ticket['id']}")
            suite_results["passed"] += 1
            suite_results["tests"].append({"name": "create_ticket_api", "status": "passed"})
            api_ticket_id = created_ticket["id"]
        except Exception as e:
            print(f"❌ FAIL: {str(e)}")
            suite_results["failed"] += 1
            suite_results["tests"].append(
                {"name": "create_ticket_api", "status": "failed", "error": str(e)}
            )
            api_ticket_id = None

        # Test 4: Update ticket
        if api_ticket_id:
            try:
                print("\n[TEST] PUT /api/tickets/{id}")
                update_data = {"column": "In Progress", "assignee": "api_tester"}
                response = requests.put(f"{base_url}/api/tickets/{api_ticket_id}", json=update_data)
                assert response.status_code == 200, f"Expected 200, got {response.status_code}"
                print("✅ PASS: Ticket updated successfully")
                suite_results["passed"] += 1
                suite_results["tests"].append({"name": "update_ticket_api", "status": "passed"})
            except Exception as e:
                print(f"❌ FAIL: {str(e)}")
                suite_results["failed"] += 1
                suite_results["tests"].append(
                    {"name": "update_ticket_api", "status": "failed", "error": str(e)}
                )

        self.results["suites"]["api"] = suite_results
        return suite_results

    def run_database_tests(self):
        """Test database operations"""
        print("\n" + "=" * 60)
        print("DATABASE TESTING")
        print("=" * 60)

        from backend.app.core.database import get_session
        from backend.app.models import Board, Ticket

        suite_results = {"passed": 0, "failed": 0, "tests": []}

        # Test 1: Database connection
        try:
            print("\n[TEST] Database connection")
            with next(get_session()) as session:
                # Simple query to test connection
                board_count = session.query(Board).count()
                print(f"✅ PASS: Connected to database ({board_count} boards found)")
                suite_results["passed"] += 1
                suite_results["tests"].append({"name": "db_connection", "status": "passed"})
        except Exception as e:
            print(f"❌ FAIL: {str(e)}")
            suite_results["failed"] += 1
            suite_results["tests"].append(
                {"name": "db_connection", "status": "failed", "error": str(e)}
            )

        # Test 2: Model relationships
        try:
            print("\n[TEST] Model relationships")
            with next(get_session()) as session:
                # Get a ticket with comments
                ticket = session.query(Ticket).first()
                if ticket:
                    comments = ticket.comments
                    history = ticket.history
                    print(
                        f"✅ PASS: Relationships working (Ticket has {len(comments)} comments, {len(history)} history entries)"
                    )
                    suite_results["passed"] += 1
                    suite_results["tests"].append(
                        {"name": "model_relationships", "status": "passed"}
                    )
                else:
                    print("⚠️ SKIP: No tickets found for relationship test")
                    suite_results["tests"].append(
                        {"name": "model_relationships", "status": "skipped"}
                    )
        except Exception as e:
            print(f"❌ FAIL: {str(e)}")
            suite_results["failed"] += 1
            suite_results["tests"].append(
                {"name": "model_relationships", "status": "failed", "error": str(e)}
            )

        # Test 3: Transaction rollback
        try:
            print("\n[TEST] Transaction rollback on error")
            with next(get_session()) as session:
                initial_count = session.query(Ticket).count()
                try:
                    # Try to create invalid ticket (missing required field)
                    bad_ticket = Ticket(board_id=999999)  # Non-existent board
                    session.add(bad_ticket)
                    session.commit()
                except:
                    session.rollback()
                final_count = session.query(Ticket).count()
                assert initial_count == final_count, "Count should remain same after rollback"
                print("✅ PASS: Transaction rollback working")
                suite_results["passed"] += 1
                suite_results["tests"].append({"name": "transaction_rollback", "status": "passed"})
        except Exception as e:
            print(f"❌ FAIL: {str(e)}")
            suite_results["failed"] += 1
            suite_results["tests"].append(
                {"name": "transaction_rollback", "status": "failed", "error": str(e)}
            )

        self.results["suites"]["database"] = suite_results
        return suite_results

    def generate_report(self):
        """Generate test report"""
        print("\n" + "=" * 60)
        print("TEST EXECUTION SUMMARY")
        print("=" * 60)

        total = 0
        passed = 0
        failed = 0

        for suite_name, suite_results in self.results["suites"].items():
            suite_total = suite_results["passed"] + suite_results["failed"]
            total += suite_total
            passed += suite_results["passed"]
            failed += suite_results["failed"]

            print(f"\n{suite_name.upper()}:")
            print(f"  Passed: {suite_results['passed']}/{suite_total}")
            print(f"  Failed: {suite_results['failed']}/{suite_total}")

            if suite_results["failed"] > 0:
                print("  Failed tests:")
                for test in suite_results["tests"]:
                    if test["status"] == "failed":
                        print(f"    - {test['name']}: {test.get('error', 'Unknown error')}")

        self.results["summary"]["total"] = total
        self.results["summary"]["passed"] = passed
        self.results["summary"]["failed"] = failed

        print("\n" + "-" * 60)
        print(f"OVERALL: {passed}/{total} tests passed ({(passed / total * 100):.1f}%)")

        if failed > 0:
            print(f"⚠️  {failed} tests failed - investigation required")
        else:
            print("✅ All tests passed!")

        # Save results to file
        report_path = Path("test_results.json")
        with open(report_path, "w") as f:
            json.dump(self.results, f, indent=2)
        print(f"\nDetailed report saved to: {report_path}")

        return self.results


async def main():
    runner = TestRunner()

    print("Starting comprehensive test suite...")
    print(f"Timestamp: {datetime.now().isoformat()}")

    # Run test suites
    try:
        # MCP tests (async)
        await runner.run_mcp_tests()
    except Exception as e:
        print(f"Error in MCP tests: {e}")

    try:
        # API tests
        runner.run_api_tests()
    except Exception as e:
        print(f"Error in API tests: {e}")

    try:
        # Database tests
        runner.run_database_tests()
    except Exception as e:
        print(f"Error in database tests: {e}")

    # Generate report
    runner.generate_report()


if __name__ == "__main__":
    asyncio.run(main())
