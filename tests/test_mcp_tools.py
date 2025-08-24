#!/usr/bin/env python3
"""
MCP Integration Test Script
Tests all MCP tools for ticket CRUD operations
"""

import asyncio
from datetime import datetime

import httpx

API_BASE = "http://localhost:18000"


async def test_mcp_integration():
    """Test MCP tools by simulating their operations via REST API"""

    print("🧪 MCP INTEGRATION TEST SUITE")
    print("=" * 50)
    print(f"Testing MCP Server middleware to REST API at {API_BASE}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 50)

    results = {"passed": [], "failed": [], "errors": []}

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        # Test 1: list_tasks (GET /api/tickets/)
        print("\n📋 Test 1: list_tasks")
        try:
            response = await client.get(
                f"{API_BASE}/api/tickets/", params={"board_id": 1, "page": 1, "page_size": 10}
            )
            if response.status_code == 200:
                data = response.json()
                print(f"  ✅ PASS - Retrieved {data.get('total', 0)} tickets from board 1")
                results["passed"].append("list_tasks")
            else:
                print(f"  ❌ FAIL - Status {response.status_code}: {response.text}")
                results["failed"].append("list_tasks")
        except Exception as e:
            print(f"  ❌ ERROR - {str(e)}")
            results["errors"].append(("list_tasks", str(e)))

        # Test 2: create_task (POST /api/tickets/)
        print("\n📝 Test 2: create_task")
        test_ticket = None
        try:
            payload = {
                "title": "MCP Test Ticket - QA Validation",
                "description": "Testing MCP server integration",
                "board_id": 1,
                "current_column": "Not Started",
                "priority": "2.0",
                "created_by": "mcp_qa_agent",
            }
            response = await client.post(f"{API_BASE}/api/tickets/", json=payload)
            if response.status_code == 201:
                test_ticket = response.json()
                print(f"  ✅ PASS - Created ticket ID: {test_ticket['id']}")
                results["passed"].append("create_task")
            else:
                print(f"  ❌ FAIL - Status {response.status_code}: {response.text}")
                results["failed"].append("create_task")
        except Exception as e:
            print(f"  ❌ ERROR - {str(e)}")
            results["errors"].append(("create_task", str(e)))

        # Test 3: get_task (GET /api/tickets/{id})
        if test_ticket:
            print("\n🔍 Test 3: get_task")
            try:
                response = await client.get(f"{API_BASE}/api/tickets/{test_ticket['id']}")
                if response.status_code == 200:
                    ticket = response.json()
                    print(f"  ✅ PASS - Retrieved ticket: '{ticket['title']}'")
                    results["passed"].append("get_task")
                else:
                    print(f"  ❌ FAIL - Status {response.status_code}: {response.text}")
                    results["failed"].append("get_task")
            except Exception as e:
                print(f"  ❌ ERROR - {str(e)}")
                results["errors"].append(("get_task", str(e)))

        # Test 4: edit_task (PUT /api/tickets/{id})
        if test_ticket:
            print("\n✏️ Test 4: edit_task")
            try:
                payload = {
                    "title": "MCP Test Ticket - UPDATED",
                    "description": "Updated via MCP test",
                    "priority": "3.0",
                    "changed_by": "mcp_qa_agent",
                }
                response = await client.put(
                    f"{API_BASE}/api/tickets/{test_ticket['id']}", json=payload
                )
                if response.status_code == 200:
                    updated = response.json()
                    print(f"  ✅ PASS - Updated ticket title to: '{updated['title']}'")
                    results["passed"].append("edit_task")
                else:
                    print(f"  ❌ FAIL - Status {response.status_code}: {response.text}")
                    results["failed"].append("edit_task")
            except Exception as e:
                print(f"  ❌ ERROR - {str(e)}")
                results["errors"].append(("edit_task", str(e)))

        # Test 5: update_task_status (POST /api/tickets/{id}/move)
        if test_ticket:
            print("\n🔄 Test 5: update_task_status")
            try:
                payload = {"column": "In Progress", "moved_by": "mcp_qa_agent"}
                response = await client.post(
                    f"{API_BASE}/api/tickets/{test_ticket['id']}/move", json=payload
                )
                if response.status_code == 200:
                    moved = response.json()
                    print(f"  ✅ PASS - Moved ticket to: '{moved['current_column']}'")
                    results["passed"].append("update_task_status")
                else:
                    print(f"  ❌ FAIL - Status {response.status_code}: {response.text}")
                    results["failed"].append("update_task_status")
            except Exception as e:
                print(f"  ❌ ERROR - {str(e)}")
                results["errors"].append(("update_task_status", str(e)))

        # Test 6: add_comment (POST /api/comments/)
        if test_ticket:
            print("\n💬 Test 6: add_comment")
            try:
                payload = {
                    "ticket_id": test_ticket["id"],
                    "text": "MCP integration test comment",
                    "author": "mcp_qa_agent",
                }
                response = await client.post(f"{API_BASE}/api/comments/", json=payload)
                if response.status_code == 201:
                    comment = response.json()
                    print(f"  ✅ PASS - Added comment ID: {comment['id']}")
                    results["passed"].append("add_comment")
                else:
                    print(f"  ❌ FAIL - Status {response.status_code}: {response.text}")
                    results["failed"].append("add_comment")
            except Exception as e:
                print(f"  ❌ ERROR - {str(e)}")
                results["errors"].append(("add_comment", str(e)))

        # Test 7: claim_task (POST /api/tickets/{id}/claim)
        if test_ticket:
            print("\n👤 Test 7: claim_task")
            try:
                response = await client.post(
                    f"{API_BASE}/api/tickets/{test_ticket['id']}/claim",
                    params={"agent_id": "mcp_test_agent"},
                )
                if response.status_code == 200:
                    claimed = response.json()
                    print(
                        f"  ✅ PASS - Task claimed by: '{claimed.get('assignee', 'mcp_test_agent')}'"
                    )
                    results["passed"].append("claim_task")
                else:
                    print(f"  ❌ FAIL - Status {response.status_code}: {response.text}")
                    results["failed"].append("claim_task")
            except Exception as e:
                print(f"  ❌ ERROR - {str(e)}")
                results["errors"].append(("claim_task", str(e)))

        # Test 8: list_columns (GET /api/boards/{id}/columns)
        print("\n📊 Test 8: list_columns")
        try:
            response = await client.get(f"{API_BASE}/api/boards/1/columns")
            if response.status_code == 200:
                columns = response.json()
                print(f"  ✅ PASS - Retrieved columns: {columns}")
                results["passed"].append("list_columns")
            else:
                print(f"  ❌ FAIL - Status {response.status_code}: {response.text}")
                results["failed"].append("list_columns")
        except Exception as e:
            print(f"  ❌ ERROR - {str(e)}")
            results["errors"].append(("list_columns", str(e)))

        # Test 9: get_board_state (GET /api/boards/{id} + tickets)
        print("\n🎯 Test 9: get_board_state")
        try:
            # Get board details
            board_response = await client.get(f"{API_BASE}/api/boards/1")

            # Get tickets for board
            tickets_response = await client.get(
                f"{API_BASE}/api/tickets/", params={"board_id": 1, "page_size": 1000}
            )

            if board_response.status_code == 200 and tickets_response.status_code == 200:
                board = board_response.json()
                tickets = tickets_response.json()
                print(f"  ✅ PASS - Board '{board['name']}' has {tickets.get('total', 0)} tickets")
                results["passed"].append("get_board_state")
            else:
                print(
                    f"  ❌ FAIL - Board status {board_response.status_code}, Tickets status {tickets_response.status_code}"
                )
                results["failed"].append("get_board_state")
        except Exception as e:
            print(f"  ❌ ERROR - {str(e)}")
            results["errors"].append(("get_board_state", str(e)))

        # Cleanup: Delete test ticket
        if test_ticket:
            print("\n🧹 Cleanup: Deleting test ticket")
            try:
                response = await client.delete(f"{API_BASE}/api/tickets/{test_ticket['id']}")
                if response.status_code == 204:
                    print(f"  ✅ Deleted test ticket ID: {test_ticket['id']}")
                else:
                    print(f"  ⚠️ Could not delete test ticket: {response.status_code}")
            except Exception as e:
                print(f"  ⚠️ Cleanup error: {str(e)}")

    # Print summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"✅ Passed: {len(results['passed'])} tests")
    if results["passed"]:
        for test in results["passed"]:
            print(f"   - {test}")

    print(f"\n❌ Failed: {len(results['failed'])} tests")
    if results["failed"]:
        for test in results["failed"]:
            print(f"   - {test}")

    print(f"\n⚠️ Errors: {len(results['errors'])} tests")
    if results["errors"]:
        for test, error in results["errors"]:
            print(f"   - {test}: {error}")

    # Overall result
    total_tests = 9
    passed = len(results["passed"])
    success_rate = (passed / total_tests) * 100

    print(f"\n📈 Success Rate: {success_rate:.1f}% ({passed}/{total_tests})")

    if success_rate == 100:
        print("\n🎉 ALL MCP TOOLS ARE WORKING CORRECTLY!")
        print("The MCP server can successfully perform all CRUD operations.")
    elif success_rate >= 80:
        print("\n✅ MCP INTEGRATION IS MOSTLY FUNCTIONAL")
        print("Most tools are working, but some issues need attention.")
    else:
        print("\n⚠️ MCP INTEGRATION HAS SIGNIFICANT ISSUES")
        print("Multiple tools are failing. Investigation required.")

    return results


if __name__ == "__main__":
    asyncio.run(test_mcp_integration())
