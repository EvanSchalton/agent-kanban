import requests

BASE_URL = "http://localhost:8000"


def test_dashboard_flow():
    print("Testing Dashboard & Board Management Flow")
    print("=" * 50)

    # 1. Test: List all boards (should have default board)
    print("\n1. Getting all boards...")
    response = requests.get(f"{BASE_URL}/api/boards/")
    assert response.status_code == 200, f"Failed to get boards: {response.status_code}"
    boards = response.json()
    print(f"   ✓ Found {len(boards)} board(s)")
    for board in boards:
        print(f"     - {board['name']}: {board['ticket_count']} tickets")

    # 2. Test: Create a new board
    print("\n2. Creating new board...")
    new_board = {"name": "Test Dashboard Board", "description": "Created during dashboard test"}
    response = requests.post(f"{BASE_URL}/api/boards/", json=new_board)
    assert response.status_code == 200, f"Failed to create board: {response.status_code}"
    created_board = response.json()
    print(f"   ✓ Created board: {created_board['name']} (ID: {created_board['id']})")

    # 3. Test: Get specific board
    print(f"\n3. Getting board {created_board['id']}...")
    response = requests.get(f"{BASE_URL}/api/boards/{created_board['id']}")
    assert response.status_code == 200, f"Failed to get board: {response.status_code}"
    board = response.json()
    print(f"   ✓ Retrieved board: {board['name']}")
    print(f"     Columns: {', '.join(board['columns'])}")

    # 4. Test: Update board
    print(f"\n4. Updating board {created_board['id']}...")
    update_data = {"name": "Updated Dashboard Board", "description": "Updated during test"}
    response = requests.put(f"{BASE_URL}/api/boards/{created_board['id']}", json=update_data)
    assert response.status_code == 200, f"Failed to update board: {response.status_code}"
    print("   ✓ Board updated successfully")

    # 5. Test: Get default board
    print("\n5. Getting default board...")
    response = requests.get(f"{BASE_URL}/api/boards/default")
    assert response.status_code == 200, f"Failed to get default board: {response.status_code}"
    default_board = response.json()
    print(f"   ✓ Default board: {default_board['name']}")

    # 6. Test: List boards again (should have 2+ boards now)
    print("\n6. Listing all boards again...")
    response = requests.get(f"{BASE_URL}/api/boards/")
    assert response.status_code == 200, f"Failed to get boards: {response.status_code}"
    boards = response.json()
    print(f"   ✓ Now have {len(boards)} board(s)")

    # 7. Test: Delete the test board
    print(f"\n7. Deleting test board {created_board['id']}...")
    response = requests.delete(f"{BASE_URL}/api/boards/{created_board['id']}")
    assert response.status_code == 200, f"Failed to delete board: {response.status_code}"
    print("   ✓ Board deleted successfully")

    print("\n" + "=" * 50)
    print(r"✅ All dashboard tests passed\!")
    return True


if __name__ == "__main__":
    try:
        test_dashboard_flow()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        exit(1)
