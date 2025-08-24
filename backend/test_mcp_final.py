#!/usr/bin/env python3
"""
Final MCP Integration Tests
Tests the three core requirements:
1. List boards (via get_board_state)
2. Create tickets
3. Update ticket status
"""

import asyncio
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from app.mcp.server import create_task, get_board_state, get_task, update_task_status


async def test_mcp_core_functionality():
    """Test the three core MCP requirements"""
    print("\n" + "=" * 60)
    print("MCP INTEGRATION TEST - CORE REQUIREMENTS")
    print("=" * 60)

    results = {"passed": 0, "failed": 0}
    created_tickets = []

    # TEST 1: List Boards (via get_board_state)
    print("\n1. TESTING: List Boards")
    print("-" * 30)

    try:
        # Get board 1 state
        board1_state = await get_board_state(board_id=1)
        print(f"✅ Board 1: {board1_state['board_name']}")
        print(f"   - Total tickets: {board1_state['total_tickets']}")
        print(f"   - Columns: {board1_state['columns']}")

        # Get board 2 state
        board2_state = await get_board_state(board_id=2)
        print(f"✅ Board 2: {board2_state['board_name']}")
        print(f"   - Total tickets: {board2_state['total_tickets']}")
        print(f"   - Columns: {board2_state['columns']}")

        results["passed"] += 1
        print("✅ PASS: MCP can list boards via get_board_state")

    except Exception as e:
        print(f"❌ FAIL: List boards failed - {str(e)}")
        results["failed"] += 1

    # TEST 2: Create Tickets
    print("\n2. TESTING: Create Tickets")
    print("-" * 30)

    try:
        # Create test ticket
        timestamp = datetime.utcnow().strftime("%H:%M:%S")
        new_ticket = await create_task(
            title=f"MCP Integration Test - {timestamp}",
            board_id=1,
            description="Testing MCP ticket creation functionality",
            priority="1.0",
            created_by="mcp_test_agent",
        )

        created_tickets.append(new_ticket["id"])
        print(f"✅ Created ticket ID {new_ticket['id']}")
        print(f"   - Title: {new_ticket['title']}")
        print(f"   - Board ID: {new_ticket['board_id']}")
        print(f"   - Column: {new_ticket['column']}")

        # Verify ticket exists
        retrieved = await get_task(ticket_id=new_ticket["id"])
        if retrieved["board_id"] == 1:
            results["passed"] += 1
            print("✅ PASS: MCP can create tickets")
        else:
            raise ValueError("Ticket not created in correct board")

    except Exception as e:
        print(f"❌ FAIL: Create ticket failed - {str(e)}")
        results["failed"] += 1

    # TEST 3: Update Ticket Status
    print("\n3. TESTING: Update Ticket Status")
    print("-" * 30)

    if created_tickets:
        try:
            ticket_id = created_tickets[0]

            # Get board 1 columns (should be standard kanban columns)
            board_state = await get_board_state(board_id=1)
            columns = board_state["columns"]

            print(f"Available columns for board 1: {columns}")

            # Move to In Progress (or second column)
            target_column = "In Progress" if "In Progress" in columns else columns[1]

            result = await update_task_status(
                ticket_id=ticket_id, column=target_column, updated_by="mcp_test_agent"
            )

            print(f"✅ Moved ticket from '{result['from_column']}' to '{result['to_column']}'")

            # Verify the move
            updated_ticket = await get_task(ticket_id=ticket_id)
            if updated_ticket["column"] == target_column:
                results["passed"] += 1
                print("✅ PASS: MCP can update ticket status")
            else:
                raise ValueError("Status not updated correctly")

        except Exception as e:
            print(f"❌ FAIL: Update ticket status failed - {str(e)}")
            results["failed"] += 1
    else:
        print("❌ FAIL: No tickets available to test status update")
        results["failed"] += 1

    # SUMMARY
    print("\n" + "=" * 60)
    print("MCP INTEGRATION TEST RESULTS")
    print("=" * 60)

    total = results["passed"] + results["failed"]
    success_rate = (results["passed"] / total * 100) if total > 0 else 0

    print(f"Total Tests: {total}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    print(f"Success Rate: {success_rate:.1f}%")

    # Test ticket cleanup note
    if created_tickets:
        print(f"\nCreated test tickets: {created_tickets}")
        print("Note: Test tickets left in system (MCP has no delete function)")

    # Overall result
    if results["failed"] == 0:
        print("\n🎉 ALL MCP INTEGRATION TESTS PASSED!")
        print("✅ MCP can list boards")
        print("✅ MCP can create tickets")
        print("✅ MCP can update ticket status")
        return True
    else:
        print(f"\n⚠️  {results['failed']} test(s) failed")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_mcp_core_functionality())
    sys.exit(0 if success else 1)
