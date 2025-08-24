#!/usr/bin/env python3
"""
Comprehensive MCP Integration Tests
Tests that MCP tools can:
1. List boards (via get_board_state)
2. Create tickets
3. Update ticket status
"""

import asyncio
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from app.mcp.server import (
    create_task,
    get_board_state,
    get_task,
    update_task_status,
)

# Test configuration
TEST_BOARD_ID = 1  # Using the main WebSocket Test Board
TEST_AGENT_ID = "mcp_test_agent_001"


async def test_mcp_integration():
    """Run comprehensive MCP integration tests"""
    print("\n" + "=" * 60)
    print("MCP INTEGRATION TEST SUITE")
    print("=" * 60)
    print(f"Test Board ID: {TEST_BOARD_ID}")
    print(f"Test Agent ID: {TEST_AGENT_ID}")

    results = {"passed": 0, "failed": 0}
    created_tickets = []

    # TEST 1: List Boards via get_board_state
    print("\n" + "=" * 60)
    print("TEST 1: List Boards (via get_board_state)")
    print("=" * 60)

    try:
        board_state = await get_board_state(board_id=TEST_BOARD_ID)
        print(f"  Board {TEST_BOARD_ID}: {board_state.get('board_name')}")
        print(f"    - Total tickets: {board_state.get('total_tickets')}")
        print(f"    - Columns: {', '.join(board_state.get('tickets_by_column', {}).keys())}")
        print("✅ PASS: List Boards via get_board_state")
        results["passed"] += 1
    except Exception as e:
        print(f"❌ FAIL: List Boards - {str(e)}")
        results["failed"] += 1

    # TEST 2: Create Tickets
    print("\n" + "=" * 60)
    print("TEST 2: Create Tickets")
    print("=" * 60)

    test_tickets = [
        {
            "title": f"MCP Test Ticket 1 - {datetime.utcnow().strftime('%H:%M:%S')}",
            "description": "Testing MCP ticket creation",
            "priority": "1.0",
        },
        {
            "title": f"MCP Test Ticket 2 - {datetime.utcnow().strftime('%H:%M:%S')}",
            "description": "Second test ticket for MCP",
            "priority": "2.0",
        },
    ]

    for ticket_data in test_tickets:
        try:
            new_ticket = await create_task(
                title=ticket_data["title"],
                board_id=TEST_BOARD_ID,
                description=ticket_data["description"],
                priority=ticket_data["priority"],
                created_by=TEST_AGENT_ID,
            )

            created_tickets.append(new_ticket["id"])
            print(f"  ✅ Created ticket ID {new_ticket['id']}: {ticket_data['title']}")

            # Verify the ticket was created
            retrieved_ticket = await get_task(ticket_id=new_ticket["id"])
            if retrieved_ticket["board_id"] != TEST_BOARD_ID:
                raise ValueError("Board ID mismatch")

            results["passed"] += 1

        except Exception as e:
            print(f"  ❌ Failed to create ticket: {str(e)}")
            results["failed"] += 1

    # TEST 3: Update Ticket Status
    print("\n" + "=" * 60)
    print("TEST 3: Update Ticket Status")
    print("=" * 60)

    if created_tickets:
        ticket_id = created_tickets[0]
        test_moves = [("Not Started", "In Progress"), ("In Progress", "Done")]

        for from_column, to_column in test_moves:
            try:
                result = await update_task_status(
                    ticket_id=ticket_id, column=to_column, updated_by=TEST_AGENT_ID
                )

                print(
                    f"  ✅ Moved ticket from '{result['from_column']}' to '{result['to_column']}'"
                )

                # Verify the move
                ticket_after = await get_task(ticket_id=ticket_id)
                if ticket_after["column"] != to_column:
                    raise ValueError("Column not updated")

                results["passed"] += 1

            except Exception as e:
                print(f"  ❌ Failed to move ticket: {str(e)}")
                results["failed"] += 1

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    total = results["passed"] + results["failed"]
    print(f"  Total Tests: {total}")
    print(f"  ✅ Passed: {results['passed']}")
    print(f"  ❌ Failed: {results['failed']}")
    print(f"  Success Rate: {(results['passed'] / total * 100) if total > 0 else 0:.1f}%")

    if created_tickets:
        print(f"\n  Created {len(created_tickets)} test tickets: {created_tickets}")

    return results["failed"] == 0


if __name__ == "__main__":
    success = asyncio.run(test_mcp_integration())
    sys.exit(0 if success else 1)
