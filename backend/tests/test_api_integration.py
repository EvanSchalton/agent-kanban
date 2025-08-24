#!/usr/bin/env python3
"""
Comprehensive API Integration Tests for Agent Kanban Board
Tests all endpoints, WebSocket functionality, and prepares for load testing
"""

import asyncio
import json
from typing import Any, Dict, Optional

import httpx
import pytest
import websockets

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws/connect"


class APITestClient:
    """Test client for API endpoints with helper methods"""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.client = httpx.Client(base_url=base_url)

    def close(self):
        self.client.close()

    # Board endpoints
    def create_board(self, name: str, columns: Optional[list] = None) -> Dict[str, Any]:
        data = {"name": name}
        if columns:
            data["columns"] = columns
        response = self.client.post("/api/boards/", json=data)
        response.raise_for_status()
        return response.json()

    def get_boards(self) -> list:
        response = self.client.get("/api/boards/")
        response.raise_for_status()
        return response.json()

    def get_board(self, board_id: int) -> Dict[str, Any]:
        response = self.client.get(f"/api/boards/{board_id}")
        response.raise_for_status()
        return response.json()

    def update_board(self, board_id: int, name: str) -> Dict[str, Any]:
        response = self.client.put(f"/api/boards/{board_id}", json={"name": name})
        response.raise_for_status()
        return response.json()

    def get_board_columns(self, board_id: int) -> list:
        response = self.client.get(f"/api/boards/{board_id}/columns")
        response.raise_for_status()
        return response.json()

    def update_board_columns(self, board_id: int, columns: list) -> Dict[str, Any]:
        response = self.client.put(f"/api/boards/{board_id}/columns", json=columns)
        response.raise_for_status()
        return response.json()

    def delete_board(self, board_id: int) -> None:
        response = self.client.delete(f"/api/boards/{board_id}")
        response.raise_for_status()

    # Ticket endpoints
    def create_ticket(
        self,
        board_id: int,
        title: str,
        description: str = "",
        priority: str = "1.0",
        assignee: Optional[str] = None,
    ) -> Dict[str, Any]:
        data = {
            "board_id": board_id,
            "title": title,
            "description": description,
            "priority": priority,
        }
        if assignee:
            data["assignee"] = assignee
        response = self.client.post("/api/tickets/", json=data)
        response.raise_for_status()
        return response.json()

    def get_tickets(
        self,
        board_id: Optional[int] = None,
        column: Optional[str] = None,
        assignee: Optional[str] = None,
    ) -> list:
        params = {}
        if board_id:
            params["board_id"] = board_id
        if column:
            params["column"] = column
        if assignee:
            params["assignee"] = assignee
        response = self.client.get("/api/tickets/", params=params)
        response.raise_for_status()
        data = response.json()
        # Handle paginated response
        if isinstance(data, dict) and "items" in data:
            return data["items"]
        return data

    def get_ticket(self, ticket_id: int) -> Dict[str, Any]:
        response = self.client.get(f"/api/tickets/{ticket_id}")
        response.raise_for_status()
        return response.json()

    def update_ticket(self, ticket_id: int, **kwargs) -> Dict[str, Any]:
        response = self.client.put(f"/api/tickets/{ticket_id}", json=kwargs)
        response.raise_for_status()
        return response.json()

    def move_ticket(self, ticket_id: int, target_column: str) -> Dict[str, Any]:
        response = self.client.post(
            f"/api/tickets/{ticket_id}/move", json={"column": target_column}
        )
        response.raise_for_status()
        return response.json()

    def claim_ticket(self, ticket_id: int, assignee: str) -> Dict[str, Any]:
        response = self.client.post(f"/api/tickets/{ticket_id}/claim?agent_id={assignee}")
        response.raise_for_status()
        return response.json()

    def delete_ticket(self, ticket_id: int) -> None:
        response = self.client.delete(f"/api/tickets/{ticket_id}")
        response.raise_for_status()

    # Comment endpoints
    def create_comment(
        self, ticket_id: int, text: str, author: str = "test_user"
    ) -> Dict[str, Any]:
        response = self.client.post(
            "/api/comments/", json={"ticket_id": ticket_id, "text": text, "author": author}
        )
        response.raise_for_status()
        return response.json()

    def get_comments(self, ticket_id: int) -> list:
        response = self.client.get(f"/api/comments/ticket/{ticket_id}")
        response.raise_for_status()
        return response.json()

    def delete_comment(self, comment_id: int) -> None:
        response = self.client.delete(f"/api/comments/{comment_id}")
        response.raise_for_status()


class TestBoardEndpoints:
    """Test all board-related API endpoints"""

    def setup_method(self):
        self.client = APITestClient()
        self.test_board_id = None

    def teardown_method(self):
        if self.test_board_id:
            try:
                self.client.delete_board(self.test_board_id)
            except Exception:
                pass
        self.client.close()

    def test_create_board(self):
        board = self.client.create_board("Test Board")
        self.test_board_id = board["id"]
        assert board["name"] == "Test Board"
        assert "id" in board
        assert "columns" in board

    def test_create_board_with_custom_columns(self):
        columns = ["Todo", "In Progress", "Review", "Done"]
        board = self.client.create_board("Custom Board", columns)
        self.test_board_id = board["id"]
        assert board["name"] == "Custom Board"
        board_columns = self.client.get_board_columns(board["id"])
        assert board_columns == columns

    def test_get_boards(self):
        board1 = self.client.create_board("Board 1")
        board2 = self.client.create_board("Board 2")
        boards = self.client.get_boards()
        assert len(boards) >= 2
        board_ids = [b["id"] for b in boards]
        assert board1["id"] in board_ids
        assert board2["id"] in board_ids
        # Cleanup
        self.client.delete_board(board1["id"])
        self.client.delete_board(board2["id"])

    def test_get_board(self):
        board = self.client.create_board("Test Get Board")
        self.test_board_id = board["id"]
        fetched_board = self.client.get_board(board["id"])
        assert fetched_board["id"] == board["id"]
        assert fetched_board["name"] == "Test Get Board"

    def test_update_board(self):
        board = self.client.create_board("Original Name")
        self.test_board_id = board["id"]
        updated = self.client.update_board(board["id"], "Updated Name")
        assert updated["name"] == "Updated Name"
        assert updated["id"] == board["id"]

    def test_update_board_columns(self):
        board = self.client.create_board("Test Board")
        self.test_board_id = board["id"]
        new_columns = ["Backlog", "Sprint", "Testing", "Deployed"]
        updated = self.client.update_board_columns(board["id"], new_columns)
        assert updated["columns"] == new_columns
        fetched_columns = self.client.get_board_columns(board["id"])
        assert fetched_columns == new_columns

    def test_delete_board(self):
        board = self.client.create_board("To Delete")
        board_id = board["id"]
        self.client.delete_board(board_id)
        # Verify deletion
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            self.client.get_board(board_id)
        assert exc_info.value.response.status_code == 404


class TestTicketEndpoints:
    """Test all ticket-related API endpoints"""

    def setup_method(self):
        self.client = APITestClient()
        # Create a test board for tickets
        self.board = self.client.create_board("Test Ticket Board")
        self.test_ticket_ids = []

    def teardown_method(self):
        # Clean up tickets
        for ticket_id in self.test_ticket_ids:
            try:
                self.client.delete_ticket(ticket_id)
            except Exception:
                pass
        # Clean up board
        try:
            self.client.delete_board(self.board["id"])
        except Exception:
            pass
        self.client.close()

    def test_create_ticket(self):
        ticket = self.client.create_ticket(
            board_id=self.board["id"],
            title="Test Task",
            description="Test description",
            priority="2.0",
            assignee="test_agent",
        )
        self.test_ticket_ids.append(ticket["id"])
        assert ticket["title"] == "Test Task"
        assert ticket["description"] == "Test description"
        assert ticket["priority"] == "2.0"
        assert ticket["assignee"] == "test_agent"
        assert ticket["current_column"] == "Not Started"

    def test_get_tickets(self):
        # Create multiple tickets
        ticket1 = self.client.create_ticket(self.board["id"], "Task 1")
        ticket2 = self.client.create_ticket(self.board["id"], "Task 2", assignee="agent1")
        ticket3 = self.client.create_ticket(self.board["id"], "Task 3", assignee="agent2")
        self.test_ticket_ids.extend([ticket1["id"], ticket2["id"], ticket3["id"]])

        # Test filtering by board
        tickets = self.client.get_tickets(board_id=self.board["id"])
        assert len(tickets) >= 3

        # Test filtering by assignee
        agent1_tickets = self.client.get_tickets(assignee="agent1")
        assert any(t["id"] == ticket2["id"] for t in agent1_tickets)

    def test_get_ticket(self):
        ticket = self.client.create_ticket(self.board["id"], "Get Test Task")
        self.test_ticket_ids.append(ticket["id"])
        fetched = self.client.get_ticket(ticket["id"])
        assert fetched["id"] == ticket["id"]
        assert fetched["title"] == "Get Test Task"

    def test_update_ticket(self):
        ticket = self.client.create_ticket(self.board["id"], "Original Title")
        self.test_ticket_ids.append(ticket["id"])
        updated = self.client.update_ticket(
            ticket["id"], title="Updated Title", description="Updated description", priority="3.0"
        )
        assert updated["title"] == "Updated Title"
        assert updated["description"] == "Updated description"
        assert updated["priority"] == "3.0"

    def test_move_ticket(self):
        ticket = self.client.create_ticket(self.board["id"], "Move Test")
        self.test_ticket_ids.append(ticket["id"])
        assert ticket["current_column"] == "Not Started"

        moved = self.client.move_ticket(ticket["id"], "In Progress")
        assert moved["current_column"] == "In Progress"

        # Verify the move persisted
        fetched = self.client.get_ticket(ticket["id"])
        assert fetched["current_column"] == "In Progress"

    def test_claim_ticket(self):
        ticket = self.client.create_ticket(self.board["id"], "Claim Test")
        self.test_ticket_ids.append(ticket["id"])
        assert ticket["assignee"] is None

        claimed = self.client.claim_ticket(ticket["id"], "claiming_agent")
        assert claimed["assignee"] == "claiming_agent"

        # Verify claim persisted
        fetched = self.client.get_ticket(ticket["id"])
        assert fetched["assignee"] == "claiming_agent"

    def test_delete_ticket(self):
        ticket = self.client.create_ticket(self.board["id"], "To Delete")
        ticket_id = ticket["id"]
        self.client.delete_ticket(ticket_id)

        # Verify deletion
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            self.client.get_ticket(ticket_id)
        assert exc_info.value.response.status_code == 404


class TestCommentEndpoints:
    """Test all comment-related API endpoints"""

    def setup_method(self):
        self.client = APITestClient()
        self.board = self.client.create_board("Test Comment Board")
        self.ticket = self.client.create_ticket(self.board["id"], "Test Task for Comments")
        self.test_comment_ids = []

    def teardown_method(self):
        # Clean up comments
        for comment_id in self.test_comment_ids:
            try:
                self.client.delete_comment(comment_id)
            except Exception:
                pass
        # Clean up ticket and board
        try:
            self.client.delete_ticket(self.ticket["id"])
            self.client.delete_board(self.board["id"])
        except Exception:
            pass
        self.client.close()

    def test_create_comment(self):
        comment = self.client.create_comment(
            self.ticket["id"], "This is a test comment", "test_author"
        )
        self.test_comment_ids.append(comment["id"])
        assert comment["text"] == "This is a test comment"
        assert comment["author"] == "test_author"
        assert comment["ticket_id"] == self.ticket["id"]

    def test_get_comments(self):
        # Create multiple comments
        comment1 = self.client.create_comment(self.ticket["id"], "First comment", "author1")
        comment2 = self.client.create_comment(self.ticket["id"], "Second comment", "author2")
        self.test_comment_ids.extend([comment1["id"], comment2["id"]])

        comments = self.client.get_comments(self.ticket["id"])
        assert len(comments) >= 2
        comment_texts = [c["text"] for c in comments]
        assert "First comment" in comment_texts
        assert "Second comment" in comment_texts

    def test_delete_comment(self):
        comment = self.client.create_comment(self.ticket["id"], "To delete", "author")
        comment_id = comment["id"]

        self.client.delete_comment(comment_id)

        # Verify deletion
        comments = self.client.get_comments(self.ticket["id"])
        assert not any(c["id"] == comment_id for c in comments)


class TestWebSocketFunctionality:
    """Test WebSocket real-time updates"""

    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test basic WebSocket connection"""
        async with websockets.connect(WS_URL) as websocket:
            # Connection should be established
            assert websocket.state.name == "OPEN"

    @pytest.mark.asyncio
    async def test_websocket_ticket_events(self):
        """Test WebSocket broadcasts for ticket events"""
        client = APITestClient()
        board = client.create_board("WebSocket Test Board")

        try:
            messages_received = []

            async def receive_messages(websocket):
                try:
                    while True:
                        message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                        messages_received.append(json.loads(message))
                except asyncio.TimeoutError:
                    pass

            async with websockets.connect(WS_URL) as websocket:
                # Start receiving messages
                receive_task = asyncio.create_task(receive_messages(websocket))

                # Create a ticket (should trigger broadcast)
                ticket = client.create_ticket(board["id"], "WebSocket Test Task")

                # Wait a bit for the message
                await asyncio.sleep(0.5)

                # Update the ticket (should trigger broadcast)
                client.update_ticket(ticket["id"], title="Updated via WebSocket")

                # Wait for messages
                await asyncio.sleep(0.5)

                # Move the ticket (should trigger broadcast)
                client.move_ticket(ticket["id"], "In Progress")

                # Wait and then cancel receive task
                await asyncio.sleep(0.5)
                receive_task.cancel()

                # Verify we received events
                assert len(messages_received) >= 3
                event_types = [msg.get("event") for msg in messages_received]
                assert "ticket_created" in event_types
                assert "ticket_updated" in event_types
                assert "ticket_moved" in event_types

                # Cleanup
                client.delete_ticket(ticket["id"])

        finally:
            client.delete_board(board["id"])
            client.close()


class TestLoadPreparation:
    """Tests to prepare for load testing"""

    def test_concurrent_ticket_creation(self):
        """Test creating multiple tickets concurrently"""
        client = APITestClient()
        board = client.create_board("Load Test Board")

        try:
            import concurrent.futures

            def create_ticket_task(i):
                return client.create_ticket(
                    board["id"],
                    f"Load Test Task {i}",
                    f"Description for task {i}",
                    priority=str(float(i % 5)),
                )

            # Create 20 tickets concurrently
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(create_ticket_task, i) for i in range(20)]
                tickets = [f.result() for f in concurrent.futures.as_completed(futures)]

            assert len(tickets) == 20

            # Verify all tickets were created
            all_tickets = client.get_tickets(board_id=board["id"])
            assert len(all_tickets) >= 20

            # Cleanup
            for ticket in tickets:
                client.delete_ticket(ticket["id"])

        finally:
            client.delete_board(board["id"])
            client.close()

    def test_api_performance_baseline(self):
        """Establish baseline performance metrics"""
        import time

        client = APITestClient()
        board = client.create_board("Performance Test Board")

        try:
            metrics = {
                "create_ticket": [],
                "get_ticket": [],
                "update_ticket": [],
                "list_tickets": [],
            }

            # Create tickets and measure time
            ticket_ids = []
            for i in range(10):
                start = time.time()
                ticket = client.create_ticket(board["id"], f"Perf Test {i}")
                metrics["create_ticket"].append(time.time() - start)
                ticket_ids.append(ticket["id"])

            # Get tickets individually
            for ticket_id in ticket_ids:
                start = time.time()
                client.get_ticket(ticket_id)
                metrics["get_ticket"].append(time.time() - start)

            # Update tickets
            for ticket_id in ticket_ids:
                start = time.time()
                client.update_ticket(ticket_id, description="Updated")
                metrics["update_ticket"].append(time.time() - start)

            # List tickets
            for _ in range(5):
                start = time.time()
                client.get_tickets(board_id=board["id"])
                metrics["list_tickets"].append(time.time() - start)

            # Calculate averages
            print("\n=== API Performance Baseline ===")
            for operation, times in metrics.items():
                avg_time = sum(times) / len(times) * 1000  # Convert to ms
                max_time = max(times) * 1000
                print(f"{operation}: avg={avg_time:.2f}ms, max={max_time:.2f}ms")

            # Assert performance targets
            assert (
                sum(metrics["create_ticket"]) / len(metrics["create_ticket"]) < 0.2
            )  # < 200ms avg
            assert sum(metrics["get_ticket"]) / len(metrics["get_ticket"]) < 0.2  # < 200ms avg

            # Cleanup
            for ticket_id in ticket_ids:
                client.delete_ticket(ticket_id)

        finally:
            client.delete_board(board["id"])
            client.close()


if __name__ == "__main__":
    # Run tests with pytest
    import subprocess
    import sys

    result = subprocess.run([sys.executable, "-m", "pytest", __file__, "-v", "--tb=short"])
    sys.exit(result.returncode)
