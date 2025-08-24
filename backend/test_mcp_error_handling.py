#!/usr/bin/env python3
"""MCP Error Handling Test Suite"""

import asyncio
import os
import sys

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


async def test_error_handling():
    """Test error handling for all MCP tools"""
    print("=== MCP Error Handling Test Suite ===\n")

    errors_caught = 0
    total_tests = 0

    # Test 1: Invalid board ID
    print("1. Testing invalid board ID:")
    total_tests += 1
    try:
        await list_columns(board_id=99999)
        print("   ❌ Should have raised an error")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    # Test 2: Invalid task ID for get_task
    print("\n2. Testing invalid task ID for get_task:")
    total_tests += 1
    try:
        await get_task(task_id=99999)
        print("   ❌ Should have raised an error")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    # Test 3: Create task with missing required fields
    print("\n3. Testing create_task with missing title:")
    total_tests += 1
    try:
        await create_task(title="", board_id=3)
        print("   ❌ Should have raised an error for empty title")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    # Test 4: Edit non-existent task
    print("\n4. Testing edit_task with invalid ID:")
    total_tests += 1
    try:
        await edit_task(task_id=99999, title="New Title")
        print("   ❌ Should have raised an error")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    # Test 5: Claim already claimed task
    print("\n5. Testing claim on non-existent task:")
    total_tests += 1
    try:
        await claim_task(task_id=99999, assignee="test_user")
        print("   ❌ Should have raised an error")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    # Test 6: Invalid status transition
    print("\n6. Testing invalid status update:")
    total_tests += 1
    try:
        await update_task_status(task_id=99999, status="InvalidStatus")
        print("   ❌ Should have raised an error")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    # Test 7: Add comment to non-existent task
    print("\n7. Testing add_comment to invalid task:")
    total_tests += 1
    try:
        await add_comment(task_id=99999, content="Test comment", author="test_user")
        print("   ❌ Should have raised an error")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    # Test 8: Empty comment content
    print("\n8. Testing empty comment content:")
    total_tests += 1
    try:
        await add_comment(task_id=1, content="", author="test_user")
        print("   ❌ Should have raised an error for empty content")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    # Test 9: Invalid filter in list_tasks
    print("\n9. Testing list_tasks with invalid board:")
    total_tests += 1
    try:
        await list_tasks(board_id=99999)
        # This might return empty list instead of error
        tasks = await list_tasks(board_id=99999)
        if len(tasks) == 0:
            print("   ✅ Returned empty list for invalid board")
            errors_caught += 1
        else:
            print("   ❌ Should return empty list for invalid board")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    # Test 10: Board state for invalid board
    print("\n10. Testing get_board_state with invalid ID:")
    total_tests += 1
    try:
        await get_board_state(board_id=99999)
        print("   ❌ Should have raised an error")
    except Exception as e:
        print(f"   ✅ Properly caught error: {str(e)[:50]}...")
        errors_caught += 1

    print("\n" + "=" * 50)
    print("Error Handling Test Results:")
    print(f"Tests passed: {errors_caught}/{total_tests}")
    print(f"Success rate: {(errors_caught / total_tests) * 100:.1f}%")

    if errors_caught == total_tests:
        print("✅ All error handling tests PASSED!")
    else:
        print(f"⚠️  {total_tests - errors_caught} tests failed to handle errors properly")

    return errors_caught == total_tests


if __name__ == "__main__":
    success = asyncio.run(test_error_handling())
    sys.exit(0 if success else 1)
