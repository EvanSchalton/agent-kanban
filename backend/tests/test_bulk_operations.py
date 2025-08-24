#!/usr/bin/env python3
"""
Unit tests for bulk operations endpoints using isolated test databases.
"""

import pytest

from app.models import Ticket


class TestBulkOperations:
    """Test class for bulk operations API endpoints"""

    def test_bulk_move_tickets(self, test_client, db, test_board):
        """Test bulk move tickets endpoint"""
        # Create test tickets
        tickets = []
        for i in range(3):
            ticket = Ticket(
                title=f"Test Ticket {i + 1}",
                description=f"Test ticket for bulk operations {i + 1}",
                board_id=test_board.id,
                status="todo",
                priority="medium",
                position=float(i + 1),
            )
            db.add(ticket)
            tickets.append(ticket)
        db.commit()

        # Get ticket IDs
        ticket_ids = [str(t.id) for t in tickets]

        # Test successful bulk move
        response = test_client.post(
            "/api/bulk/tickets/move",
            json={"ticket_ids": ticket_ids, "target_column": "in_progress"},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "total_requested" in data
        assert "successful_moves" in data
        assert "failed_moves" in data
        assert "results" in data
        assert "execution_time_ms" in data

        assert data["total_requested"] == 3
        assert data["successful_moves"] == 3
        assert data["failed_moves"] == 0
        assert len(data["results"]) == 3

        # Verify all moves were successful
        for result in data["results"]:
            assert result["success"]
            assert result["old_column"] == "todo"
            assert result["new_column"] == "in_progress"

    def test_bulk_move_partial_failure(self, test_client, db, test_board):
        """Test bulk move with some invalid ticket IDs"""
        # Create only 2 tickets
        tickets = []
        for i in range(2):
            ticket = Ticket(
                title=f"Test Ticket {i + 1}",
                description=f"Test description {i + 1}",
                board_id=test_board.id,
                status="todo",
                priority="medium",
                position=float(i + 1),
            )
            db.add(ticket)
            tickets.append(ticket)
        db.commit()

        # Include one invalid ID
        ticket_ids = [str(t.id) for t in tickets]
        ticket_ids.append("invalid-id-12345")

        response = test_client.post(
            "/api/bulk/tickets/move", json={"ticket_ids": ticket_ids, "target_column": "done"}
        )

        assert response.status_code == 200
        data = response.json()

        # Should have partial success
        assert data["total_requested"] == 3
        assert data["successful_moves"] == 2
        assert data["failed_moves"] == 1

    def test_bulk_move_empty_list(self, test_client):
        """Test bulk move with empty ticket list"""
        response = test_client.post(
            "/api/bulk/tickets/move", json={"ticket_ids": [], "target_column": "done"}
        )

        assert response.status_code == 400

    def test_bulk_move_invalid_column(self, test_client, db, test_board):
        """Test bulk move to invalid column"""
        ticket = Ticket(
            title="Test Ticket",
            description="Test description",
            board_id=test_board.id,
            status="todo",
            priority="medium",
            position=1.0,
        )
        db.add(ticket)
        db.commit()

        response = test_client.post(
            "/api/bulk/tickets/move",
            json={"ticket_ids": [str(ticket.id)], "target_column": "invalid_column"},
        )

        # Should fail validation or return error
        assert response.status_code in [400, 422]

    def test_bulk_delete_tickets(self, test_client, db, test_board):
        """Test bulk delete tickets endpoint"""
        # Create test tickets
        tickets = []
        for i in range(3):
            ticket = Ticket(
                title=f"Delete Ticket {i + 1}",
                description=f"Ticket to be deleted {i + 1}",
                board_id=test_board.id,
                status="todo",
                priority="low",
                position=float(i + 1),
            )
            db.add(ticket)
            tickets.append(ticket)
        db.commit()

        ticket_ids = [str(t.id) for t in tickets]

        # Test successful bulk delete
        response = test_client.delete("/api/bulk/tickets/delete", json={"ticket_ids": ticket_ids})

        assert response.status_code == 200
        data = response.json()

        assert data["total_requested"] == 3
        assert data["successful_deletes"] == 3
        assert data["failed_deletes"] == 0

        # Verify tickets are deleted
        for ticket in tickets:
            db.refresh(ticket)
            assert db.query(Ticket).filter_by(id=ticket.id).first() is None

    def test_bulk_update_priority(self, test_client, db, test_board):
        """Test bulk update ticket priority"""
        # Create test tickets
        tickets = []
        for i in range(3):
            ticket = Ticket(
                title=f"Priority Ticket {i + 1}",
                description=f"Test priority update {i + 1}",
                board_id=test_board.id,
                status="todo",
                priority="low",
                position=float(i + 1),
            )
            db.add(ticket)
            tickets.append(ticket)
        db.commit()

        ticket_ids = [str(t.id) for t in tickets]

        # Test bulk priority update
        response = test_client.patch(
            "/api/bulk/tickets/priority", json={"ticket_ids": ticket_ids, "priority": "high"}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_requested"] == 3
        assert data["successful_updates"] == 3

        # Verify priorities are updated
        for ticket in tickets:
            db.refresh(ticket)
            assert ticket.priority == "high"

    def test_bulk_assign_tickets(self, test_client, db, test_board, test_user):
        """Test bulk assign tickets to user"""
        # Create test tickets
        tickets = []
        for i in range(2):
            ticket = Ticket(
                title=f"Assign Ticket {i + 1}",
                description=f"Test assignment {i + 1}",
                board_id=test_board.id,
                status="todo",
                priority="medium",
                position=float(i + 1),
            )
            db.add(ticket)
            tickets.append(ticket)
        db.commit()

        ticket_ids = [str(t.id) for t in tickets]

        # Test bulk assignment
        response = test_client.patch(
            "/api/bulk/tickets/assign", json={"ticket_ids": ticket_ids, "assignee_id": test_user.id}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["total_requested"] == 2
        assert data["successful_assignments"] == 2

        # Verify assignments
        for ticket in tickets:
            db.refresh(ticket)
            assert ticket.assignee_id == test_user.id

    @pytest.mark.performance
    def test_bulk_operations_performance(self, test_client, db, test_board):
        """Test performance of bulk operations with many tickets"""
        # Create many tickets
        tickets = []
        for i in range(50):
            ticket = Ticket(
                title=f"Perf Ticket {i + 1}",
                description=f"Performance test {i + 1}",
                board_id=test_board.id,
                status="todo",
                priority="medium",
                position=float(i + 1),
            )
            db.add(ticket)
            tickets.append(ticket)
        db.commit()

        ticket_ids = [str(t.id) for t in tickets]

        # Test bulk move performance
        import time

        start_time = time.time()

        response = test_client.post(
            "/api/bulk/tickets/move",
            json={"ticket_ids": ticket_ids, "target_column": "in_progress"},
        )

        elapsed = time.time() - start_time

        assert response.status_code == 200
        data = response.json()

        # Should complete within reasonable time
        assert elapsed < 5.0  # 5 seconds for 50 tickets
        assert data["successful_moves"] == 50

        # Check reported execution time
        assert data["execution_time_ms"] < 5000
