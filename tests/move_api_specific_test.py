#!/usr/bin/env python3
"""Specific Move API Testing - Frontend vs Backend Mismatch"""

import requests


def test_move_api_formats():
    """Test both frontend expected and backend actual move API formats"""

    base_url = "http://localhost:15173/api"

    print("🔧 MOVE API FORMAT TESTING")
    print("=" * 50)

    # First get a test ticket
    print("1. Getting test ticket...")
    try:
        response = requests.get(f"{base_url}/tickets/?board_id=1")
        data = response.json()
        tickets = data.get("items", data)

        if not tickets:
            print("❌ No tickets found")
            return

        test_ticket = tickets[0]
        ticket_id = test_ticket["id"]
        current_column = test_ticket.get("column_id", 1)
        target_column = 2 if current_column == 1 else 1

        print(f"   📝 Using ticket {ticket_id}: column {current_column} → {target_column}")

    except Exception as e:
        print(f"❌ Failed to get test ticket: {e}")
        return

    # Test Format 1: Frontend expected format
    print("\n2. Testing Frontend Expected Format...")
    print(f"   API: POST /api/tickets/{ticket_id}/move")
    print(f'   Body: {{"column_id": {target_column}}}')

    try:
        response = requests.post(
            f"{base_url}/tickets/{ticket_id}/move",
            json={"column_id": target_column},
            headers={"Content-Type": "application/json"},
        )
        print(f"   Result: {response.status_code}")
        if response.status_code != 200:
            print(f"   Error: {response.text[:200]}")
        else:
            print("   ✅ Frontend format works!")

    except Exception as e:
        print(f"   Exception: {e}")

    # Test Format 2: Backend bulk format
    print("\n3. Testing Backend Bulk Format...")
    print(f"   API: POST /api/tickets/move?column_id={target_column}")
    print(f"   Body: [{ticket_id}]")

    try:
        response = requests.post(
            f"{base_url}/tickets/move?column_id={target_column}",
            json=[ticket_id],
            headers={"Content-Type": "application/json"},
        )
        print(f"   Result: {response.status_code}")
        if response.status_code in [200, 201]:
            print("   ✅ Backend bulk format works!")
            moved_tickets = response.json()
            print(f"   📊 Moved {len(moved_tickets)} tickets")
        else:
            print(f"   Error: {response.text[:200]}")

    except Exception as e:
        print(f"   Exception: {e}")

    # Test Format 3: Try different variations
    print("\n4. Testing Alternative Formats...")

    # Try PUT method
    try:
        response = requests.put(
            f"{base_url}/tickets/{ticket_id}",
            json={"column_id": target_column},
            headers={"Content-Type": "application/json"},
        )
        print(f"   PUT /tickets/{ticket_id}: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ PUT method works for updates!")

    except Exception as e:
        print(f"   PUT Exception: {e}")

    # Summary
    print("\n📋 SUMMARY:")
    print("Frontend needs: POST /tickets/{id}/move with {column_id: X}")
    print("Backend has: POST /tickets/move?column_id=X with [ticket_ids]")
    print("Alternative: PUT /tickets/{id} with {column_id: X} (update)")


def test_ticket_creation_formats():
    """Test different ticket creation formats to find working approach"""

    base_url = "http://localhost:15173/api"

    print("\n🎫 TICKET CREATION FORMAT TESTING")
    print("=" * 50)

    # Test 1: board_id in body
    print("1. Testing board_id in request body...")
    try:
        response = requests.post(
            f"{base_url}/tickets/",
            json={
                "board_id": 1,
                "title": "Test Body Board ID",
                "description": "Testing board_id in body",
                "priority": "Medium",
            },
            headers={"Content-Type": "application/json"},
        )
        print(f"   Result: {response.status_code}")
        if response.status_code in [200, 201]:
            print("   ✅ Board ID in body works!")
        else:
            print(f"   Error: {response.text[:100]}")

    except Exception as e:
        print(f"   Exception: {e}")

    # Test 2: board_id as query parameter
    print("2. Testing board_id as query parameter...")
    try:
        response = requests.post(
            f"{base_url}/tickets/?board_id=1",
            json={
                "title": "Test Query Board ID",
                "description": "Testing board_id as query param",
                "priority": "Medium",
            },
            headers={"Content-Type": "application/json"},
        )
        print(f"   Result: {response.status_code}")
        if response.status_code in [200, 201]:
            print("   ✅ Board ID as query param works!")
        else:
            print(f"   Error: {response.text[:100]}")

    except Exception as e:
        print(f"   Exception: {e}")

    print("\n📋 CREATION SUMMARY:")
    print("Testing both body and query parameter approaches for board_id")


if __name__ == "__main__":
    test_move_api_formats()
    test_ticket_creation_formats()
