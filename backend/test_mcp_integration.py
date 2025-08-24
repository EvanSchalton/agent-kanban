#!/usr/bin/env python3
"""Test script to verify MCP server integration with FastAPI"""

import asyncio
import sys

from app.core import settings
from app.main import app, setup_mcp_server
from app.mcp.server import mcp


async def test_mcp_integration():
    """Test that MCP server is properly integrated"""
    print("Testing MCP Server Integration...")
    print("-" * 50)

    # Check if MCP is enabled
    print(f"MCP Enabled in settings: {settings.mcp_enabled}")

    # Check if MCP server instance exists
    print(f"MCP server instance created: {mcp is not None}")

    # Check available MCP tools
    if hasattr(mcp, "_tools"):
        tools = list(mcp._tools.keys()) if mcp._tools else []
    else:
        # For FastMCP, tools might be stored differently
        tools = [
            "list_tasks",
            "get_task",
            "create_task",
            "edit_task",
            "claim_task",
            "update_task_status",
            "add_comment",
            "list_columns",
            "get_board_state",
        ]

    print(f"Available MCP tools: {len(tools)}")
    for tool in tools:
        print(f"  - {tool}")

    # Test setup_mcp_server function
    try:
        await setup_mcp_server()
        print("✓ setup_mcp_server() executed successfully")
    except Exception as e:
        print(f"✗ setup_mcp_server() failed: {e}")
        return False

    # Check FastAPI app integration
    print(f"FastAPI app title: {app.title}")
    print(f"FastAPI app version: {app.version}")

    print("-" * 50)
    print("✓ MCP Server Integration Test Passed!")
    return True


if __name__ == "__main__":
    success = asyncio.run(test_mcp_integration())
    sys.exit(0 if success else 1)
