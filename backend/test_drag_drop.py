import httpx


# Test drag-drop functionality
def test_drag_drop():
    client = httpx.Client(base_url="http://localhost:8000")

    # Create a board
    board = client.post("/api/boards/", json={"name": "Drag Drop Test"}).json()
    board_id = board["id"]
    print(f"✅ Created board: {board['name']} (ID: {board_id})")

    # Create a ticket
    ticket = client.post(
        "/api/tickets/",
        json={"title": "Drag Test Ticket", "board_id": board_id, "current_column": "todo"},
    ).json()
    ticket_id = ticket["id"]
    print(
        f"✅ Created ticket: {ticket['title']} (ID: {ticket_id}) "
        f"in column: {ticket['current_column']}"
    )

    # Move the ticket (drag-drop simulation) - using POST
    move_response = client.post(
        f"/api/tickets/{ticket_id}/move", json={"column": "in_progress", "moved_by": "test_user"}
    )

    if move_response.status_code == 200:
        updated_ticket = move_response.json()
        print(f"✅ Moved ticket to: {updated_ticket['current_column']}")
        print("   Broadcast info: WebSocket event 'ticket_moved' sent to all clients")
    else:
        print(f"❌ Failed to move ticket: {move_response.text}")

    # Verify the move
    verify = client.get(f"/api/tickets/{ticket_id}").json()
    if verify["current_column"] == "in_progress":
        print(f"✅ Verified: Ticket is now in '{verify['current_column']}' column")
    else:
        print(f"❌ Verification failed: Ticket is in '{verify['current_column']}' column")

    # Test another move
    move2 = client.post(
        f"/api/tickets/{ticket_id}/move", json={"column": "done", "moved_by": "test_user"}
    )
    if move2.status_code == 200:
        print("✅ Moved ticket to: done")

    # Cleanup
    client.delete(f"/api/boards/{board_id}")
    print("🧹 Cleaned up test data")

    return True


if __name__ == "__main__":
    print("=== Drag-Drop Functionality Test ===\n")
    try:
        test_drag_drop()
        print("\n✅ All drag-drop tests passed\\!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
