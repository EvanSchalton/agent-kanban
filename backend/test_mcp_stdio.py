#!/usr/bin/env python3
"""Test MCP server stdio protocol"""

import json
import subprocess


def test_mcp_stdio():
    """Test the MCP server using stdio protocol"""
    print("Testing MCP Server stdio protocol...")

    # Start the MCP server as a subprocess
    proc = subprocess.Popen(
        ["python", "run_mcp.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=0,
    )

    try:
        # Test 1: Initialize
        print("\n1. Testing initialize...")
        init_request = {
            "jsonrpc": "2.0",
            "method": "initialize",
            "id": 1,
            "params": {
                "protocolVersion": "1.0.0",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "1.0.0"},
            },
        }

        proc.stdin.write(json.dumps(init_request) + "\n")
        proc.stdin.flush()

        # Read response
        response_line = proc.stdout.readline()
        if response_line:
            response = json.loads(response_line)
            if "result" in response:
                print(f"✅ Initialize successful: {response['result']['serverInfo']['name']}")
            else:
                print(f"❌ Initialize failed: {response}")

        # Test 2: List tools
        print("\n2. Testing tools/list...")
        list_request = {"jsonrpc": "2.0", "method": "tools/list", "id": 2, "params": {}}

        proc.stdin.write(json.dumps(list_request) + "\n")
        proc.stdin.flush()

        # Read response
        response_line = proc.stdout.readline()
        if response_line:
            response = json.loads(response_line)
            if "result" in response and "tools" in response["result"]:
                tools = response["result"]["tools"]
                print(f"✅ Found {len(tools)} tools:")
                for tool in tools:
                    print(f"   - {tool['name']}: {tool.get('description', '')[:50]}...")
            else:
                print(f"❌ List tools failed: {response}")

        # Test 3: Call a tool (list_columns)
        print("\n3. Testing tool call (list_columns)...")
        tool_request = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "id": 3,
            "params": {"name": "list_columns", "arguments": {"board_id": 1}},
        }

        proc.stdin.write(json.dumps(tool_request) + "\n")
        proc.stdin.flush()

        # Read response (might take longer due to HTTP call)
        response_line = proc.stdout.readline()
        if response_line:
            response = json.loads(response_line)
            if "result" in response:
                print("✅ Tool call successful")
                if "content" in response["result"]:
                    for content in response["result"]["content"]:
                        if content.get("type") == "text":
                            print(f"   Response: {content.get('text', '')}")
            elif "error" in response:
                print(
                    f"⚠️  Tool call returned error (expected if API not running): {response['error']['message']}"
                )
            else:
                print(f"❌ Tool call failed: {response}")

        print("\n✅ All MCP stdio protocol tests completed!")

    except Exception as e:
        print(f"❌ Test failed with error: {e}")

    finally:
        # Terminate the process
        proc.terminate()
        proc.wait(timeout=5)


if __name__ == "__main__":
    test_mcp_stdio()
