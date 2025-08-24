#!/usr/bin/env python3
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.mcp.server import (
    add_comment,
    claim_task,
    create_task,
    get_board_state,
    get_task,
    list_tasks,
    update_task_status,
)


async def test_mcp_tools():
    print("Testing MCP Tools...")

    # Test list_tasks
    print("\n1. Testing list_tasks:")
    tasks = await list_tasks(board_id=3)
    print(f"   Found {len(tasks)} tasks")
    for task in tasks:
        print(f"   - {task['title']} (Column: {task['column']})")

    # Test get_task
    if tasks:
        print(f"\n2. Testing get_task for ID {tasks[0]['id']}:")
        task_detail = await get_task(ticket_id=tasks[0]["id"])
        print(f"   Title: {task_detail['title']}")
        print(f"   Priority: {task_detail['priority']}")
        print(f"   Comments: {len(task_detail['comments'])}")

    # Test create_task
    print("\n3. Testing create_task:")
    new_task = await create_task(
        title="Test MCP Task", board_id=3, description="Created via MCP", priority="2.0"
    )
    print(f"   Created task ID: {new_task['id']}")

    # Test claim_task
    print(f"\n4. Testing claim_task for ID {new_task['id']}:")
    claimed = await claim_task(ticket_id=new_task["id"], agent_id="test_agent_01")
    print(f"   {claimed['message']}")

    # Test update_task_status - Board 3 has columns: New, Review, Approved, Deployed
    print(f"\n5. Testing update_task_status for ID {new_task['id']}:")
    moved = await update_task_status(
        ticket_id=new_task["id"],
        column="Review",  # Using Board 3's actual columns
    )
    print(f"   {moved['message']}")

    # Test add_comment
    print(f"\n6. Testing add_comment for ID {new_task['id']}:")
    comment = await add_comment(
        ticket_id=new_task["id"], text="Working on this task now", author="test_agent_01"
    )
    print(f"   Comment added (ID: {comment['id']})")

    # Test get_board_state
    print("\n7. Testing get_board_state:")
    board_state = await get_board_state(board_id=3)
    print(f"   Board: {board_state['board_name']}")
    print(f"   Total tickets: {board_state['total_tickets']}")
    for column, tickets in board_state["tickets_by_column"].items():
        print(f"   {column}: {len(tickets)} tickets")

    print("\n✅ All MCP tools tested successfully!")


if __name__ == "__main__":
    asyncio.run(test_mcp_tools())
