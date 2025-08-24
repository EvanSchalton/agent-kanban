#!/usr/bin/env python3
"""Test ticket creation to identify 422 validation errors"""

import json

from fastapi.testclient import TestClient

from app.main import app


def test_ticket_creation():
    """Test ticket creation with various payloads"""
    client = TestClient(app)

    print("🎫 Testing Ticket Creation")
    print("=" * 40)

    # First, let's get available boards
    print("\n1. Getting available boards")
    boards_response = client.get("/api/boards/")
    print(f"Boards status: {boards_response.status_code}")

    if boards_response.status_code == 200:
        boards = boards_response.json()
        print(f"Found {len(boards)} boards")
        if boards:
            board_id = boards[0]["id"]
            print(f"Using board ID: {board_id}")
        else:
            # Create a board first
            print("Creating a test board...")
            board_data = {
                "name": "Test Board",
                "description": "Test board for ticket creation",
                "columns": ["Not Started", "In Progress", "Done"],
            }
            create_board_response = client.post("/api/boards/", json=board_data)
            print(f"Create board status: {create_board_response.status_code}")
            if create_board_response.status_code == 201:
                board = create_board_response.json()
                board_id = board["id"]
                print(f"Created board with ID: {board_id}")
            else:
                print(f"Failed to create board: {create_board_response.text}")
                return
    else:
        print(f"Failed to get boards: {boards_response.text}")
        return

    # Test 2: Basic ticket creation
    print("\n2. Testing basic ticket creation")
    ticket_data = {
        "title": "Test Ticket",
        "description": "This is a test ticket",
        "board_id": board_id,
        "priority": "1.0.1.0.0.1",  # Testing decimal notation
    }

    response = client.post("/api/tickets/", json=ticket_data)
    print(f"Status: {response.status_code}")
    if response.status_code == 201:
        ticket = response.json()
        print(f"✅ Ticket created: {ticket['id']} - {ticket['title']}")
        print(f"Priority: {ticket['priority']}")
        ticket["id"]
    else:
        print(f"❌ Ticket creation failed: {response.text}")
        print(f"Request data: {json.dumps(ticket_data, indent=2)}")

        # Let's try with minimal data
        print("\n2b. Testing with minimal data")
        minimal_data = {"title": "Minimal Test Ticket", "board_id": board_id}
        response = client.post("/api/tickets/", json=minimal_data)
        print(f"Minimal status: {response.status_code}")
        if response.status_code == 201:
            print("✅ Minimal ticket created")
            ticket = response.json()
            ticket["id"]
        else:
            print(f"❌ Minimal ticket failed: {response.text}")
            return

    # Test 3: Test different priority formats
    print("\n3. Testing different priority formats")
    priority_tests = [
        "1.0",
        "1.5",
        "2.1.3",
        "1.0.1.0.0.1",
        "5.2.1.9.8.7.6",
    ]

    for priority in priority_tests:
        test_data = {
            "title": f"Priority Test {priority}",
            "board_id": board_id,
            "priority": priority,
        }
        response = client.post("/api/tickets/", json=test_data)
        if response.status_code == 201:
            print(f"✅ Priority {priority}: Success")
        else:
            print(f"❌ Priority {priority}: Failed - {response.status_code}")

    print("\n" + "=" * 40)
    print("🎉 Ticket creation tests completed!")


if __name__ == "__main__":
    test_ticket_creation()
