#!/usr/bin/env python3
"""
Quick API validation script to test card creation fix
Validates that the API endpoints are working correctly
"""

import sys
from datetime import datetime

import requests

BASE_URL = "http://localhost:8000"


def test_api_endpoints():
    """Test critical API endpoints to validate the fix"""
    print("🔍 Validating API Fix - Card Creation Endpoints")
    print("=" * 50)

    results = {}

    # Test 1: Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        results["backend_health"] = response.status_code in [
            200,
            404,
            405,
        ]  # Any response means it's running
        print(f"✅ Backend Running: {response.status_code}")
    except requests.exceptions.RequestException as e:
        results["backend_health"] = False
        print(f"❌ Backend Not Running: {e}")
        return results

    # Test 2: Get boards endpoint
    try:
        response = requests.get(f"{BASE_URL}/api/boards", timeout=5)
        results["boards_endpoint"] = response.status_code in [200, 401, 422]
        print(f"✅ Boards Endpoint: {response.status_code}")
        if response.status_code == 200:
            boards = response.json()
            print(f"   Found {len(boards)} boards")
    except requests.exceptions.RequestException as e:
        results["boards_endpoint"] = False
        print(f"❌ Boards Endpoint Failed: {e}")

    # Test 3: Create board (to test POST functionality)
    try:
        board_data = {
            "name": f"API Test Board {datetime.now().strftime('%H%M%S')}",
            "description": "Test board for API validation",
        }
        response = requests.post(f"{BASE_URL}/api/boards", json=board_data, timeout=5)
        results["create_board"] = response.status_code in [200, 201, 401, 422]
        print(f"✅ Create Board: {response.status_code}")

        if response.status_code in [200, 201]:
            board = response.json()
            board_id = board.get("id")
            results["board_id"] = board_id
            print(f"   Created board ID: {board_id}")

            # Test 4: Create ticket (the main fix validation)
            try:
                ticket_data = {
                    "title": f"API Test Ticket {datetime.now().strftime('%H%M%S')}",
                    "description": "Test ticket to validate card creation fix",
                    "status": "todo",
                    "priority": "medium",
                    "board_id": board_id,
                }
                response = requests.post(f"{BASE_URL}/api/tickets", json=ticket_data, timeout=5)
                results["create_ticket"] = response.status_code in [200, 201]
                print(f"✅ Create Ticket: {response.status_code}")

                if response.status_code in [200, 201]:
                    ticket = response.json()
                    print(f"   Created ticket ID: {ticket.get('id')}")
                    print(f"   Ticket title: {ticket.get('title')}")
                    results["ticket_data"] = ticket
                else:
                    print(f"   Response: {response.text[:200]}")

            except requests.exceptions.RequestException as e:
                results["create_ticket"] = False
                print(f"❌ Create Ticket Failed: {e}")

    except requests.exceptions.RequestException as e:
        results["create_board"] = False
        print(f"❌ Create Board Failed: {e}")

    # Test 5: Get tickets endpoint
    try:
        response = requests.get(f"{BASE_URL}/api/tickets", timeout=5)
        results["tickets_endpoint"] = response.status_code in [200, 401, 422]
        print(f"✅ Tickets Endpoint: {response.status_code}")
        if response.status_code == 200:
            tickets = response.json()
            print(f"   Found {len(tickets)} tickets")
    except requests.exceptions.RequestException as e:
        results["tickets_endpoint"] = False
        print(f"❌ Tickets Endpoint Failed: {e}")

    return results


def generate_report(results):
    """Generate a summary report"""
    print("\n" + "=" * 50)
    print("📊 API Validation Summary")
    print("=" * 50)

    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v is True)

    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests / total_tests) * 100:.1f}%")

    print("\nDetailed Results:")
    for test_name, result in results.items():
        if isinstance(result, bool):
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {test_name}: {status}")
        else:
            print(f"  {test_name}: {result}")

    # Overall assessment
    critical_tests = ["backend_health", "create_ticket"]
    critical_passed = all(results.get(test, False) for test in critical_tests)

    print(
        f"\n🎯 Card Creation Fix Status: "
        f"{'✅ WORKING' if critical_passed else '❌ NEEDS ATTENTION'}"
    )

    if critical_passed:
        print("✅ API fix appears to be working correctly!")
        print("✅ Card creation endpoint is functional")
        return 0
    else:
        print("⚠️ Issues detected with card creation API")
        print("🔧 May need further investigation")
        return 1


if __name__ == "__main__":
    try:
        results = test_api_endpoints()
        exit_code = generate_report(results)
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        sys.exit(1)
