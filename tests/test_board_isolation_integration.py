"""
Integration tests for board isolation functionality.
Tests that board_id filtering works correctly and WebSocket broadcasts are board-specific.
"""

import asyncio
import json

import pytest
import websockets
from httpx import AsyncClient

BASE_URL = "http://localhost:18000"
WS_URL = "ws://localhost:18000/ws/connect"


class TestBoardIsolation:
    """Test suite for board isolation functionality."""

    @pytest.fixture
    async def setup_boards(self, async_client: AsyncClient):
        """Create test boards for isolation testing."""
        boards = []

        # Create 3 test boards
        for i in range(1, 4):
            response = await async_client.post(
                f"{BASE_URL}/api/boards/",
                json={
                    "name": f"Isolation Test Board {i}",
                    "description": f"Testing board isolation - Board {i}",
                    "columns": ["Not Started", "In Progress", "Done"],
                },
            )
            assert response.status_code == 201
            boards.append(response.json())

        yield boards

        # Cleanup
        for board in boards:
            try:
                await async_client.delete(f"{BASE_URL}/api/boards/{board['id']}")
            except:
                pass

    @pytest.mark.asyncio
    async def test_board_tickets_api_isolation(self, async_client: AsyncClient, setup_boards):
        """Test that /api/boards/{id}/tickets only returns tickets for that board."""
        boards = setup_boards

        # Create tickets for each board
        tickets_by_board = {}
        for board in boards:
            tickets = []
            for j in range(1, 4):
                response = await async_client.post(
                    f"{BASE_URL}/api/tickets/",
                    json={
                        "title": f"Board{board['id']}-Ticket{j}",
                        "description": f"Test ticket {j} for board {board['id']}",
                        "board_id": board["id"],
                        "current_column": "Not Started",
                    },
                )
                assert response.status_code == 201
                tickets.append(response.json())
            tickets_by_board[board["id"]] = tickets

        # Test that each board endpoint only returns its own tickets
        for board in boards:
            response = await async_client.get(f"{BASE_URL}/api/boards/{board['id']}/tickets")
            assert response.status_code == 200
            data = response.json()

            # Check board_id in response
            assert data["board_id"] == board["id"]

            # Check tickets belong to this board
            returned_tickets = data["tickets"]
            assert len(returned_tickets) == 3  # Should have exactly 3 tickets

            for ticket in returned_tickets:
                assert ticket["board_id"] == board["id"]
                assert f"Board{board['id']}" in ticket["title"]
                # Ensure tickets from other boards are NOT present
                for other_board in boards:
                    if other_board["id"] != board["id"]:
                        assert f"Board{other_board['id']}" not in ticket["title"]

    @pytest.mark.asyncio
    async def test_tickets_query_param_filtering(self, async_client: AsyncClient, setup_boards):
        """Test that /api/tickets/?board_id={id} filters correctly."""
        boards = setup_boards

        # Create tickets for each board
        all_tickets = []
        for board in boards:
            for j in range(1, 3):
                response = await async_client.post(
                    f"{BASE_URL}/api/tickets/",
                    json={
                        "title": f"FilterTest-Board{board['id']}-Ticket{j}",
                        "description": f"Testing filter for board {board['id']}",
                        "board_id": board["id"],
                        "current_column": "In Progress",
                    },
                )
                assert response.status_code == 201
                all_tickets.append(response.json())

        # Test filtering for each board
        for board in boards:
            response = await async_client.get(
                f"{BASE_URL}/api/tickets/", params={"board_id": board["id"]}
            )
            assert response.status_code == 200
            data = response.json()

            tickets = data.get("items", data)

            # Should only have tickets from this board
            for ticket in tickets:
                assert ticket["board_id"] == board["id"]
                assert f"Board{board['id']}" in ticket["title"]

            # Count should match tickets created for this board
            expected_count = len([t for t in all_tickets if t["board_id"] == board["id"]])
            assert len(tickets) >= expected_count  # >= because there might be existing tickets

    @pytest.mark.asyncio
    async def test_websocket_board_specific_broadcasts(
        self, async_client: AsyncClient, setup_boards
    ):
        """Test that WebSocket broadcasts are board-specific."""
        boards = setup_boards

        # Connect multiple WebSocket clients
        received_messages = {board["id"]: [] for board in boards}

        async def ws_listener(board_id: int, messages_list: list):
            """WebSocket listener for a specific board."""
            try:
                async with websockets.connect(WS_URL) as websocket:
                    # Send join message for specific board
                    await websocket.send(json.dumps({"type": "join_board", "board_id": board_id}))

                    # Listen for messages
                    while True:
                        try:
                            message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                            msg_data = json.loads(message)
                            messages_list.append(msg_data)
                        except TimeoutError:
                            break
                        except websockets.exceptions.ConnectionClosed:
                            break
            except Exception as e:
                print(f"WebSocket error for board {board_id}: {e}")

        # Start WebSocket listeners for each board
        tasks = []
        for board in boards:
            task = asyncio.create_task(ws_listener(board["id"], received_messages[board["id"]]))
            tasks.append(task)

        # Wait for connections to establish
        await asyncio.sleep(1)

        # Create a ticket in board 1
        board1_ticket = await async_client.post(
            f"{BASE_URL}/api/tickets/",
            json={
                "title": "WebSocket Test Ticket Board 1",
                "description": "Testing WebSocket isolation",
                "board_id": boards[0]["id"],
                "current_column": "Not Started",
            },
        )
        assert board1_ticket.status_code == 201

        # Wait for WebSocket messages
        await asyncio.sleep(2)

        # Create a ticket in board 2
        board2_ticket = await async_client.post(
            f"{BASE_URL}/api/tickets/",
            json={
                "title": "WebSocket Test Ticket Board 2",
                "description": "Testing WebSocket isolation",
                "board_id": boards[1]["id"],
                "current_column": "Done",
            },
        )
        assert board2_ticket.status_code == 201

        # Wait for messages to propagate
        await asyncio.sleep(2)

        # Cancel all tasks
        for task in tasks:
            task.cancel()

        # Verify board 1 only received messages about board 1 tickets
        board1_messages = received_messages[boards[0]["id"]]
        for msg in board1_messages:
            if msg.get("type") == "ticket_created":
                assert msg.get("data", {}).get("board_id") == boards[0]["id"]

        # Verify board 2 only received messages about board 2 tickets
        board2_messages = received_messages[boards[1]["id"]]
        for msg in board2_messages:
            if msg.get("type") == "ticket_created":
                assert msg.get("data", {}).get("board_id") == boards[1]["id"]

        # Verify board 3 didn't receive ticket messages (no tickets created)
        board3_messages = received_messages[boards[2]["id"]]
        ticket_messages = [m for m in board3_messages if m.get("type") == "ticket_created"]
        assert len(ticket_messages) == 0

    @pytest.mark.asyncio
    async def test_ticket_move_isolation(self, async_client: AsyncClient, setup_boards):
        """Test that moving tickets respects board boundaries."""
        boards = setup_boards

        # Create a ticket in board 1
        ticket_response = await async_client.post(
            f"{BASE_URL}/api/tickets/",
            json={
                "title": "Move Test Ticket",
                "description": "Testing move isolation",
                "board_id": boards[0]["id"],
                "current_column": "Not Started",
            },
        )
        assert ticket_response.status_code == 201
        ticket = ticket_response.json()

        # Move ticket within the same board (should succeed)
        move_response = await async_client.post(
            f"{BASE_URL}/api/tickets/{ticket['id']}/move", json={"column": "In Progress"}
        )
        assert move_response.status_code == 200
        moved_ticket = move_response.json()
        assert moved_ticket["board_id"] == boards[0]["id"]
        assert moved_ticket["current_column"] == "In Progress"

        # Try to move ticket to a different board (should fail or maintain board_id)
        # This tests that the API prevents cross-board moves
        await async_client.put(
            f"{BASE_URL}/api/tickets/{ticket['id']}",
            json={"board_id": boards[1]["id"], "current_column": "Done"},
        )

        # Fetch the ticket to verify it's still in board 1
        get_response = await async_client.get(f"{BASE_URL}/api/tickets/{ticket['id']}")
        assert get_response.status_code == 200
        current_ticket = get_response.json()
        assert current_ticket["board_id"] == boards[0]["id"]  # Should still be in board 1

    @pytest.mark.asyncio
    async def test_bulk_operations_board_isolation(self, async_client: AsyncClient, setup_boards):
        """Test that bulk operations respect board boundaries."""
        boards = setup_boards

        # Create tickets in different boards
        board1_tickets = []
        board2_tickets = []

        for i in range(2):
            # Board 1 tickets
            response = await async_client.post(
                f"{BASE_URL}/api/tickets/",
                json={
                    "title": f"Bulk Test Board1 Ticket{i}",
                    "board_id": boards[0]["id"],
                    "current_column": "Not Started",
                },
            )
            board1_tickets.append(response.json())

            # Board 2 tickets
            response = await async_client.post(
                f"{BASE_URL}/api/tickets/",
                json={
                    "title": f"Bulk Test Board2 Ticket{i}",
                    "board_id": boards[1]["id"],
                    "current_column": "Not Started",
                },
            )
            board2_tickets.append(response.json())

        # Try bulk update on board 1 tickets
        board1_ids = [t["id"] for t in board1_tickets]
        await async_client.post(
            f"{BASE_URL}/api/bulk/update",
            json={"ticket_ids": board1_ids, "updates": {"priority": "3.0"}},
        )

        # Verify only board 1 tickets were updated
        for ticket in board1_tickets:
            response = await async_client.get(f"{BASE_URL}/api/tickets/{ticket['id']}")
            updated = response.json()
            assert updated["priority"] == "3.0"

        # Verify board 2 tickets were NOT updated
        for ticket in board2_tickets:
            response = await async_client.get(f"{BASE_URL}/api/tickets/{ticket['id']}")
            unchanged = response.json()
            assert unchanged["priority"] != "3.0"

    @pytest.mark.asyncio
    async def test_deletion_isolation(self, async_client: AsyncClient, setup_boards):
        """Test that deleting tickets from one board doesn't affect others."""
        boards = setup_boards

        # Create tickets in each board
        tickets_to_create = {}
        for board in boards:
            tickets_to_create[board["id"]] = []
            for i in range(2):
                response = await async_client.post(
                    f"{BASE_URL}/api/tickets/",
                    json={
                        "title": f"Delete Test Board{board['id']} Ticket{i}",
                        "board_id": board["id"],
                        "current_column": "Not Started",
                    },
                )
                tickets_to_create[board["id"]].append(response.json())

        # Get initial counts
        initial_counts = {}
        for board in boards:
            response = await async_client.get(f"{BASE_URL}/api/boards/{board['id']}/tickets")
            initial_counts[board["id"]] = len(response.json()["tickets"])

        # Delete one ticket from board 1
        ticket_to_delete = tickets_to_create[boards[0]["id"]][0]
        delete_response = await async_client.delete(
            f"{BASE_URL}/api/tickets/{ticket_to_delete['id']}"
        )
        assert delete_response.status_code in [200, 204]

        # Verify counts
        for board in boards:
            response = await async_client.get(f"{BASE_URL}/api/boards/{board['id']}/tickets")
            current_count = len(response.json()["tickets"])

            if board["id"] == boards[0]["id"]:
                # Board 1 should have one less ticket
                assert current_count == initial_counts[board["id"]] - 1
            else:
                # Other boards should be unchanged
                assert current_count == initial_counts[board["id"]]


@pytest.fixture
async def async_client():
    """Create an async HTTP client for testing."""
    async with AsyncClient() as client:
        yield client


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])
