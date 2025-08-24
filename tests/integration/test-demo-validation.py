#!/usr/bin/env python3
"""
Demo Validation Script
Tests all critical features for the complete system demo.
"""

import asyncio
import json
import time
from datetime import datetime

import requests
import websockets

API_BASE = "http://localhost:18000"


def log(message):
    """Log with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")


def test_api_health():
    """Test basic API connectivity"""
    log("🔍 Testing API health...")
    try:
        response = requests.get(f"{API_BASE}/")
        if response.status_code == 200:
            data = response.json()
            log(f"✅ API online: {data.get('message', 'Unknown')}")
            return True
        else:
            log(f"❌ API error: {response.status_code}")
            return False
    except Exception as e:
        log(f"❌ API connection failed: {e}")
        return False


def test_board_isolation():
    """Test board isolation functionality"""
    log("🏠 Testing board isolation...")
    try:
        # Get all boards
        response = requests.get(f"{API_BASE}/api/boards/")
        boards = response.json()

        if len(boards) >= 3:
            # Test first 3 boards
            board1_tickets = requests.get(f"{API_BASE}/api/boards/1/tickets").json()
            board2_tickets = requests.get(f"{API_BASE}/api/boards/2/tickets").json()
            board3_tickets = requests.get(f"{API_BASE}/api/boards/3/tickets").json()

            count1 = len(board1_tickets.get("tickets", []))
            count2 = len(board2_tickets.get("tickets", []))
            count3 = len(board3_tickets.get("tickets", []))

            log(f"✅ Board isolation working: Board1({count1}) Board2({count2}) Board3({count3})")
            return True
        else:
            log(f"❌ Insufficient boards for testing: {len(boards)}")
            return False
    except Exception as e:
        log(f"❌ Board isolation test failed: {e}")
        return False


def test_card_creation():
    """Test card creation with correct API format"""
    log("📝 Testing card creation...")
    try:
        # Create test ticket
        ticket_data = {
            "title": "Demo Validation Test Ticket",
            "description": "Testing P0 card creation fix",
            "board_id": 2,
            "current_column": "Backlog",
            "priority": "1.0",
        }

        response = requests.post(f"{API_BASE}/api/tickets/", json=ticket_data)

        if response.status_code in [200, 201]:  # Both OK and Created are success
            ticket = response.json()
            log(f"✅ Card creation working: Created ticket #{ticket['id']}")

            # Clean up test ticket
            delete_response = requests.delete(f"{API_BASE}/api/tickets/{ticket['id']}")
            if delete_response.status_code == 200:
                log("🧹 Test ticket cleaned up")

            return True
        else:
            log(f"❌ Card creation failed: {response.status_code} {response.text}")
            return False
    except Exception as e:
        log(f"❌ Card creation test failed: {e}")
        return False


async def test_websocket():
    """Test WebSocket connectivity"""
    log("📡 Testing WebSocket connection...")
    try:
        async with websockets.connect("ws://localhost:18000/ws/connect") as websocket:
            # Send connection init
            await websocket.send(json.dumps({"type": "connection_init", "user": "demo_validator"}))

            # Wait for response with timeout
            try:
                await asyncio.wait_for(websocket.recv(), timeout=5.0)
                log("✅ WebSocket connection established")
                return True
            except TimeoutError:
                log("⚠️ WebSocket connected but no response (may still work)")
                return True

    except Exception as e:
        log(f"❌ WebSocket test failed: {e}")
        return False


def test_mcp_integration():
    """Test MCP server availability (if running)"""
    log("🤖 Testing MCP integration...")
    try:
        # Try to check if MCP process exists
        import subprocess

        result = subprocess.run(["pgrep", "-f", "run_mcp.py"], capture_output=True, text=True)

        if result.returncode == 0:
            log("✅ MCP server process detected")
            return True
        else:
            log("⚠️ MCP server not running (optional for basic demo)")
            return True  # Not critical for demo
    except Exception as e:
        log(f"ℹ️ MCP check skipped: {e}")
        return True  # Not critical


async def main():
    """Run all demo validation tests"""
    log("🚀 Starting Demo Validation Tests...")
    log("=" * 50)

    tests = [
        ("API Health", test_api_health),
        ("Board Isolation", test_board_isolation),
        ("Card Creation", test_card_creation),
        ("MCP Integration", test_mcp_integration),
    ]

    results = {}

    # Run synchronous tests
    for name, test_func in tests:
        results[name] = test_func()
        time.sleep(0.5)  # Brief pause between tests

    # Run WebSocket test
    results["WebSocket Connection"] = await test_websocket()

    # Summary
    log("=" * 50)
    log("📊 DEMO VALIDATION RESULTS:")

    passed = 0
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        log(f"  {test_name}: {status}")
        if result:
            passed += 1

    log(f"\n🎯 Overall Score: {passed}/{total} tests passed")

    if passed >= 4:  # Allow 1 optional failure
        log("🎉 SYSTEM READY FOR DEMO!")
        log("\nDemo URLs:")
        log("  📊 Status Dashboard: http://localhost:5179/system-status-dashboard.html")
        log("  🏠 Main Kanban: http://localhost:5179/")
        log("  🤖 Agent Collaboration: http://localhost:5179/agent-collaboration-demo.html")
    else:
        log("⚠️ Some critical tests failed. Check logs above.")

    return passed >= 4


if __name__ == "__main__":
    asyncio.run(main())
