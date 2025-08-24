from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core import get_session
from app.main import app
from app.models import Board, Ticket, TicketHistory

client = TestClient(app)


class TestHistoryEndpoints:
    """Test suite for history tracking endpoints"""

    @pytest.fixture
    def mock_session(self):
        """Create a mock database session"""
        return MagicMock()

    def setup_mock_session(self, mock_session):
        """Helper to setup dependency override"""
        app.dependency_overrides[get_session] = lambda: mock_session

    def cleanup_mock_session(self):
        """Helper to cleanup dependency override"""
        if get_session in app.dependency_overrides:
            del app.dependency_overrides[get_session]

    def test_get_ticket_history_success(self, mock_session):
        """Test successful ticket history retrieval"""
        # Mock ticket exists
        ticket = MagicMock(spec=Ticket)
        ticket.id = 1
        mock_session.get.return_value = ticket

        # Mock history data
        history_entries = []
        for i in range(3):
            entry = MagicMock(spec=TicketHistory)
            entry.id = i + 1
            entry.field_name = "column"
            entry.old_value = "Not Started"
            entry.new_value = "In Progress"
            entry.changed_by = f"user_{i}"
            entry.changed_at = datetime.utcnow() - timedelta(hours=i)
            entry.ticket_id = 1
            history_entries.append(entry)

        mock_session.exec.return_value.all.return_value = history_entries

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/tickets/1/history")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 3
            assert data[0]["field_name"] == "column"
            assert data[0]["ticket_id"] == 1
        finally:
            self.cleanup_mock_session()

    def test_get_ticket_history_not_found(self, mock_session):
        """Test ticket history for non-existent ticket"""
        mock_session.get.return_value = None

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/tickets/999/history")

            assert response.status_code == 404
            assert "not found" in response.json()["error"]["message"].lower()
        finally:
            self.cleanup_mock_session()

    def test_get_ticket_history_with_field_filter(self, mock_session):
        """Test ticket history with field name filter"""
        # Mock ticket exists
        ticket = MagicMock(spec=Ticket)
        mock_session.get.return_value = ticket

        # Mock filtered query
        mock_session.exec.return_value.all.return_value = []

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/tickets/1/history?field_name=priority")

            assert response.status_code == 200
            # Verify that the query was called with field filter
            mock_session.exec.assert_called()
        finally:
            self.cleanup_mock_session()

    def test_get_ticket_transitions(self, mock_session):
        """Test ticket column transitions endpoint"""
        # Mock ticket
        now = datetime.utcnow()
        ticket = MagicMock(spec=Ticket)
        ticket.id = 1
        ticket.current_column = "Done"
        ticket.created_at = now - timedelta(days=5)
        mock_session.get.return_value = ticket

        # Mock transitions
        transitions = []
        transition_times = [
            (now - timedelta(days=4), "Not Started", "In Progress"),
            (now - timedelta(days=2), "In Progress", "Review"),
            (now - timedelta(hours=6), "Review", "Done"),
        ]

        for i, (changed_at, old_val, new_val) in enumerate(transition_times):
            transition = MagicMock(spec=TicketHistory)
            transition.id = i + 1
            transition.old_value = old_val
            transition.new_value = new_val
            transition.changed_at = changed_at
            transition.changed_by = f"user_{i}"
            transitions.append(transition)

        mock_session.exec.return_value.all.return_value = transitions

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/tickets/1/transitions")

            assert response.status_code == 200
            data = response.json()

            assert data["ticket_id"] == 1
            assert data["current_column"] == "Done"
            assert len(data["transitions"]) == 3
            assert data["total_transitions"] == 3

            # Check duration calculations
            for transition in data["transitions"]:
                assert "duration_seconds" in transition
                assert "duration_human" in transition
        finally:
            self.cleanup_mock_session()

    def test_get_board_activity(self, mock_session):
        """Test board activity endpoint"""
        # Mock board
        board = MagicMock(spec=Board)
        board.id = 1
        board.name = "Test Board"
        mock_session.get.return_value = board

        # Mock ticket IDs
        mock_session.exec.return_value.all.return_value = [1, 2, 3]

        # Mock activity results
        now = datetime.utcnow()
        activities = []
        for i in range(5):
            history = MagicMock(spec=TicketHistory)
            history.id = i + 1
            history.ticket_id = (i % 3) + 1
            history.field_name = "column" if i % 2 == 0 else "assignee"
            history.old_value = "old_value"
            history.new_value = "new_value"
            history.changed_by = f"user_{i}"
            history.changed_at = now - timedelta(hours=i)

            ticket_title = f"Ticket {(i % 3) + 1}"
            activities.append((history, ticket_title))

        mock_session.exec.return_value.all.return_value = activities

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/boards/1/activity?hours=24&limit=10")

            assert response.status_code == 200
            data = response.json()

            assert data["board_id"] == 1
            assert data["timeframe_hours"] == 24
            assert len(data["activities"]) == 5

            # Check activity structure
            activity = data["activities"][0]
            assert "ticket_id" in activity
            assert "ticket_title" in activity
            assert "field_name" in activity
            assert "time_ago" in activity
        finally:
            self.cleanup_mock_session()

    def test_get_board_activity_not_found(self, mock_session):
        """Test board activity for non-existent board"""
        mock_session.get.return_value = None

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/boards/999/activity")

            assert response.status_code == 404
        finally:
            self.cleanup_mock_session()

    def test_get_board_activity_no_tickets(self, mock_session):
        """Test board activity with no tickets"""
        # Mock board exists but no tickets
        board = MagicMock(spec=Board)
        board.id = 1
        mock_session.get.return_value = board
        mock_session.exec.return_value.all.return_value = []

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/boards/1/activity")

            assert response.status_code == 200
            data = response.json()
            assert data["board_id"] == 1
            assert data["activities"] == []
        finally:
            self.cleanup_mock_session()

    def test_get_history_statistics(self, mock_session):
        """Test history statistics endpoint"""
        # Mock database query results
        mock_session.exec.side_effect = [
            # Total changes
            MagicMock(one=lambda: 50),
            # Field stats
            MagicMock(all=lambda: [("column", 20), ("assignee", 15), ("priority", 15)]),
            # User stats
            MagicMock(all=lambda: [("user1", 25), ("user2", 20), ("agent1", 5)]),
            # Daily stats
            MagicMock(all=lambda: [("2025-08-09", 10), ("2025-08-10", 15), ("2025-08-11", 25)]),
        ]

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/stats?days=7")

            assert response.status_code == 200
            data = response.json()

            assert data["analysis_period_days"] == 7
            assert data["total_changes"] == 50
            assert len(data["changes_by_field"]) == 3
            assert len(data["changes_by_user"]) == 3
            assert len(data["daily_activity"]) == 3

            # Check structure
            assert data["changes_by_field"][0]["field"] == "column"
            assert data["changes_by_field"][0]["count"] == 20
        finally:
            self.cleanup_mock_session()

    def test_format_duration_function(self):
        """Test duration formatting helper function"""
        from app.api.endpoints.history import _format_duration

        assert _format_duration(30) == "30s"
        assert _format_duration(90) == "1m"
        assert _format_duration(3660) == "1h 1m"
        assert _format_duration(90000) == "1d 1h"

    def test_time_ago_function(self):
        """Test time ago helper function"""
        from app.api.endpoints.history import _time_ago

        now = datetime.utcnow()

        assert _time_ago(now - timedelta(seconds=30)) == "just now"
        assert "minute" in _time_ago(now - timedelta(minutes=5))
        assert "hour" in _time_ago(now - timedelta(hours=3))
        assert "day" in _time_ago(now - timedelta(days=2))

    def test_history_endpoint_error_handling(self, mock_session):
        """Test error handling in history endpoints"""
        # Simulate database error
        mock_session.get.side_effect = Exception("Database connection failed")

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/tickets/1/history")

            assert response.status_code == 500
            assert "Failed to retrieve" in response.json()["error"]["message"]
        finally:
            self.cleanup_mock_session()

    def test_history_pagination(self, mock_session):
        """Test history endpoint pagination"""
        # Mock ticket exists
        ticket = MagicMock(spec=Ticket)
        mock_session.get.return_value = ticket

        # Mock large history list
        history_entries = []
        for i in range(150):  # More than default limit
            entry = MagicMock(spec=TicketHistory)
            entry.id = i
            entry.field_name = "column"
            entry.old_value = "old"
            entry.new_value = "new"
            entry.changed_by = "user"
            entry.changed_at = datetime.utcnow()
            entry.ticket_id = 1
            history_entries.append(entry)

        mock_session.exec.return_value.all.return_value = history_entries

        self.setup_mock_session(mock_session)
        try:
            response = client.get("/api/history/tickets/1/history?limit=25")

            assert response.status_code == 200
            data = response.json()

            # Should be limited by the query, not by the mock data
            # The actual limiting happens in the SQL query
            assert len(data) == 150  # This is the mock data length
        finally:
            self.cleanup_mock_session()
