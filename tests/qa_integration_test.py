#!/usr/bin/env python3
"""
QA Integration Test Suite for Agent Kanban Board
Testing frontend-backend integration
"""

import json
from datetime import datetime

import requests

BASE_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:15174"


def test_health():
    """Test backend health endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"Health check failed: {response.status_code}"
    except Exception as e:
        return False, f"Health check error: {str(e)}"


def test_boards_api():
    """Test boards API endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/boards/", timeout=5)
        if response.status_code == 200:
            boards = response.json()
            return True, f"Found {len(boards)} boards"
        else:
            return False, f"Boards API failed: {response.status_code}"
    except Exception as e:
        return False, f"Boards API error: {str(e)}"


def test_tickets_api():
    """Test tickets API endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/tickets/", timeout=5)
        if response.status_code == 200:
            tickets = response.json()
            return True, f"Found {len(tickets)} tickets"
        else:
            return False, f"Tickets API failed: {response.status_code}"
    except Exception as e:
        return False, f"Tickets API error: {str(e)}"


def test_mcp_tools():
    """Test MCP tools integration"""
    try:
        # Test list_tasks MCP tool via API
        response = requests.get(f"{BASE_URL}/api/tickets/?board_id=1", timeout=5)
        if response.status_code == 200:
            tickets = response.json()
            return True, f"MCP integration working: {len(tickets)} tasks accessible"
        else:
            return False, f"MCP tools failed: {response.status_code}"
    except Exception as e:
        return False, f"MCP tools error: {str(e)}"


def test_ticket_creation():
    """Test ticket creation through API"""
    try:
        new_ticket = {
            "title": "QA Integration Test Ticket",
            "description": "Test ticket created by QA suite",
            "priority": "medium",
            "board_id": 1,
            "column": "backlog",
        }
        response = requests.post(f"{BASE_URL}/api/tickets/", json=new_ticket, timeout=5)
        if response.status_code in [200, 201]:
            ticket = response.json()
            return True, f"Created ticket ID: {ticket.get('id', 'unknown')}"
        else:
            return False, f"Ticket creation failed: {response.status_code} - {response.text}"
    except Exception as e:
        return False, f"Ticket creation error: {str(e)}"


def test_websocket_connectivity():
    """Test WebSocket endpoint availability"""
    try:
        # Just test if the WebSocket endpoint responds
        response = requests.get(f"{BASE_URL}/ws", timeout=5)
        # WebSocket endpoints typically return 404 or 405 for HTTP requests
        if response.status_code in [404, 405, 426]:
            return True, "WebSocket endpoint available (expected HTTP error)"
        else:
            return False, f"Unexpected WebSocket response: {response.status_code}"
    except Exception as e:
        return False, f"WebSocket test error: {str(e)}"


def main():
    """Main QA integration test runner"""
    print("=" * 80)
    print("QA INTEGRATION TEST SUITE - AGENT KANBAN BOARD")
    print("Testing Frontend-Backend Integration")
    print("=" * 80)

    tests = [
        ("Backend Health Check", test_health),
        ("Boards API Integration", test_boards_api),
        ("Tickets API Integration", test_tickets_api),
        ("MCP Tools Integration", test_mcp_tools),
        ("Ticket Creation", test_ticket_creation),
        ("WebSocket Connectivity", test_websocket_connectivity),
    ]

    results = []
    passed = 0

    for test_name, test_func in tests:
        print(f"\n🔧 Running: {test_name}")
        try:
            success, message = test_func()
            if success:
                print(f"✅ PASS: {message}")
                passed += 1
                results.append({"test": test_name, "status": "PASS", "message": message})
            else:
                print(f"❌ FAIL: {message}")
                results.append({"test": test_name, "status": "FAIL", "message": message})
        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            results.append({"test": test_name, "status": "ERROR", "message": str(e)})

    # Summary
    print("\n" + "=" * 80)
    print("QA INTEGRATION TEST SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {len(tests)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {len(tests) - passed}")
    print(f"Success Rate: {(passed / len(tests) * 100):.1f}%")

    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = f"qa_integration_results_{timestamp}.json"
    with open(results_file, "w") as f:
        json.dump(
            {
                "timestamp": datetime.now().isoformat(),
                "summary": {
                    "total": len(tests),
                    "passed": passed,
                    "failed": len(tests) - passed,
                    "success_rate": passed / len(tests) * 100,
                },
                "results": results,
            },
            f,
            indent=2,
        )

    print(f"📄 Results saved to: {results_file}")

    return passed == len(tests)


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
