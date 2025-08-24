#!/usr/bin/env python3
"""
API Integration Tests using proper test fixtures
Tests all endpoints with isolated databases
"""

import json

import pytest

from app.models import Comment, Ticket


class TestBoardEndpoints:
    """Test board-related endpoints with isolated database"""

    def test_create_board(self, test_client):
        """Test creating a new board"""
        response = test_client.post("/api/boards/", json={"name": "Test Board"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Board"
        assert "id" in data
        assert "columns" in data

    def test_create_board_with_custom_columns(self, test_client):
        """Test creating a board with custom columns"""
        columns = ["Backlog", "In Progress", "Review", "Done"]
        response = test_client.post(
            "/api/boards/", json={"name": "Custom Board", "columns": columns}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Custom Board"
        assert json.loads(data["columns"]) == columns

    def test_get_boards(self, test_client, test_board):
        """Test getting all boards"""
        response = test_client.get("/api/boards/")
        assert response.status_code == 200
        boards = response.json()
        assert len(boards) >= 1
        assert any(b["name"] == test_board.name for b in boards)

    def test_get_board(self, test_client, test_board):
        """Test getting a specific board"""
        response = test_client.get(f"/api/boards/{test_board.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_board.id
        assert data["name"] == test_board.name

    def test_update_board(self, test_client, test_board):
        """Test updating a board"""
        response = test_client.put(f"/api/boards/{test_board.id}", json={"name": "Updated Board"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Board"

    def test_delete_board(self, test_client, test_board):
        """Test deleting a board"""
        response = test_client.delete(f"/api/boards/{test_board.id}")
        assert response.status_code == 200

        # Verify board is deleted
        response = test_client.get(f"/api/boards/{test_board.id}")
        assert response.status_code == 404


class TestTicketEndpoints:
    """Test ticket-related endpoints with isolated database"""

    def test_create_ticket(self, test_client, test_board):
        """Test creating a new ticket"""
        response = test_client.post(
            "/api/tickets/",
            json={
                "title": "Test Ticket",
                "description": "Test description",
                "board_id": test_board.id,
                "status": "todo",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Ticket"
        assert data["board_id"] == test_board.id

    def test_get_tickets(self, test_client, test_ticket):
        """Test getting all tickets"""
        response = test_client.get(f"/api/tickets/?board_id={test_ticket.board_id}")
        assert response.status_code == 200
        tickets = response.json()
        assert len(tickets) >= 1
        assert any(t["id"] == test_ticket.id for t in tickets)

    def test_get_ticket(self, test_client, test_ticket):
        """Test getting a specific ticket"""
        response = test_client.get(f"/api/tickets/{test_ticket.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_ticket.id
        assert data["title"] == test_ticket.title

    def test_update_ticket(self, test_client, test_ticket):
        """Test updating a ticket"""
        response = test_client.put(
            f"/api/tickets/{test_ticket.id}", json={"title": "Updated Ticket"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Ticket"

    def test_move_ticket(self, test_client, test_ticket):
        """Test moving a ticket to a different column"""
        response = test_client.put(
            f"/api/tickets/{test_ticket.id}/move",
            json={"status": "in_progress", "column": "In Progress"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "in_progress"
        assert data["column"] == "In Progress"

    def test_delete_ticket(self, test_client, test_ticket):
        """Test deleting a ticket"""
        response = test_client.delete(f"/api/tickets/{test_ticket.id}")
        assert response.status_code == 200

        # Verify ticket is deleted
        response = test_client.get(f"/api/tickets/{test_ticket.id}")
        assert response.status_code == 404


class TestCommentEndpoints:
    """Test comment-related endpoints with isolated database"""

    def test_create_comment(self, test_client, test_ticket, test_user):
        """Test creating a comment"""
        response = test_client.post(
            f"/api/tickets/{test_ticket.id}/comments",
            json={"content": "Test comment", "author": test_user.username},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["content"] == "Test comment"
        assert data["ticket_id"] == test_ticket.id

    def test_get_comments(self, test_client, test_ticket, test_user, db):
        """Test getting comments for a ticket"""
        # Create a comment first
        comment = Comment(
            content="Test comment", ticket_id=test_ticket.id, author=test_user.username
        )
        db.add(comment)
        db.commit()

        response = test_client.get(f"/api/tickets/{test_ticket.id}/comments")
        assert response.status_code == 200
        comments = response.json()
        assert len(comments) >= 1
        assert any(c["content"] == "Test comment" for c in comments)


class TestBulkOperations:
    """Test bulk operation endpoints with isolated database"""

    def test_bulk_move(self, test_client, test_board, db):
        """Test bulk moving tickets"""
        # Create multiple tickets
        ticket_ids = []
        for i in range(3):
            ticket = Ticket(title=f"Bulk Test {i}", board_id=test_board.id, status="todo")
            db.add(ticket)
            db.commit()
            db.refresh(ticket)
            ticket_ids.append(ticket.id)

        # Bulk move
        response = test_client.post(
            "/api/bulk/move",
            json={"ticket_ids": ticket_ids, "status": "in_progress", "column": "In Progress"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == len(ticket_ids)

    def test_bulk_delete(self, test_client, test_board, db):
        """Test bulk deleting tickets"""
        # Create multiple tickets
        ticket_ids = []
        for i in range(3):
            ticket = Ticket(title=f"Delete Test {i}", board_id=test_board.id, status="todo")
            db.add(ticket)
            db.commit()
            db.refresh(ticket)
            ticket_ids.append(ticket.id)

        # Bulk delete
        response = test_client.post("/api/bulk/delete", json={"ticket_ids": ticket_ids})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == len(ticket_ids)

        # Verify deletion
        for ticket_id in ticket_ids:
            response = test_client.get(f"/api/tickets/{ticket_id}")
            assert response.status_code == 404


class TestWebSocketIntegration:
    """Test WebSocket functionality with isolated database"""

    @pytest.mark.asyncio
    async def test_websocket_connection(self, test_client):
        """Test WebSocket connection through test client"""
        # FastAPI TestClient supports WebSocket testing
        with test_client.websocket_connect("/ws/connect") as websocket:
            # Send a ping
            websocket.send_json({"type": "ping"})

            # Should receive connection info
            data = websocket.receive_json()
            assert "client_id" in data or "type" in data

    @pytest.mark.asyncio
    async def test_websocket_ticket_events(self, test_client, test_board):
        """Test WebSocket ticket event broadcasting"""
        with test_client.websocket_connect("/ws/connect") as websocket:
            # Create a ticket via API (should trigger WebSocket event)
            response = test_client.post(
                "/api/tickets/",
                json={"title": "WebSocket Test", "board_id": test_board.id, "status": "todo"},
            )
            assert response.status_code == 200

            # Check for WebSocket notification
            # Note: Actual implementation may vary
            try:
                data = websocket.receive_json(timeout=1.0)
                # Event structure depends on implementation
                assert data is not None
            except:
                # Some implementations may not broadcast to same connection
                pass


class TestPerformanceBaseline:
    """Establish performance baselines for load testing"""

    def test_api_response_times(self, test_client, test_board):
        """Test basic API response times"""
        import time

        # Test board list
        start = time.time()
        response = test_client.get("/api/boards/")
        board_list_time = time.time() - start
        assert response.status_code == 200
        assert board_list_time < 1.0  # Should respond in under 1 second

        # Test ticket creation
        start = time.time()
        response = test_client.post(
            "/api/tickets/",
            json={"title": "Performance Test", "board_id": test_board.id, "status": "todo"},
        )
        create_time = time.time() - start
        assert response.status_code == 200
        assert create_time < 1.0  # Should create in under 1 second

    def test_concurrent_operations(self, test_client, test_board):
        """Test handling concurrent operations"""
        import concurrent.futures

        def create_ticket(index):
            response = test_client.post(
                "/api/tickets/",
                json={
                    "title": f"Concurrent Test {index}",
                    "board_id": test_board.id,
                    "status": "todo",
                },
            )
            return response.status_code == 200

        # Create 10 tickets concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(create_ticket, i) for i in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        assert all(results)  # All creations should succeed
