from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
from sqlmodel import Session

from app.models import Board, Ticket
from app.services.statistics_service import ColumnStatistics, StatisticsService, TicketStatistics


class TestStatisticsService:
    """Test suite for StatisticsService"""

    @pytest.fixture
    def service(self):
        """Create a fresh StatisticsService for each test"""
        return StatisticsService()

    @pytest.fixture
    def mock_session(self):
        """Create a mock database session"""
        return MagicMock(spec=Session)

    @pytest.fixture
    def sample_board(self):
        """Create a sample board"""
        board = MagicMock(spec=Board)
        board.id = 1
        board.name = "Test Board"
        board.get_columns_list.return_value = ["Not Started", "In Progress", "Done"]
        return board

    @pytest.fixture
    def sample_tickets(self):
        """Create sample tickets with different time distributions"""
        now = datetime.utcnow()
        tickets = []

        # Not Started tickets (should be excluded from color calculations)
        for i in range(3):
            ticket = MagicMock(spec=Ticket)
            ticket.id = i + 1
            ticket.current_column = "Not Started"
            ticket.column_entered_at = now - timedelta(hours=i + 1)
            ticket.created_at = now - timedelta(days=1)
            tickets.append(ticket)

        # In Progress tickets with varying durations
        durations = [1, 2, 4, 8, 16]  # Hours - creates good distribution
        for i, duration in enumerate(durations):
            ticket = MagicMock(spec=Ticket)
            ticket.id = i + 10
            ticket.current_column = "In Progress"
            ticket.column_entered_at = now - timedelta(hours=duration)
            ticket.created_at = now - timedelta(days=2)
            tickets.append(ticket)

        # Done tickets (should be excluded)
        for i in range(2):
            ticket = MagicMock(spec=Ticket)
            ticket.id = i + 20
            ticket.current_column = "Done"
            ticket.column_entered_at = now - timedelta(hours=i + 1)
            ticket.created_at = now - timedelta(days=3)
            tickets.append(ticket)

        return tickets

    def test_calculate_board_statistics(self, service, mock_session, sample_board, sample_tickets):
        """Test board statistics calculation"""
        # Setup mocks
        mock_session.exec.return_value.all.return_value = sample_tickets
        mock_session.get.return_value = sample_board

        # Calculate statistics
        stats = service.calculate_board_statistics(mock_session, 1)

        # Verify structure
        assert isinstance(stats, dict)
        assert "Not Started" in stats
        assert "In Progress" in stats
        assert "Done" in stats

        # Check In Progress statistics (5 tickets)
        in_progress_stats = stats["In Progress"]
        assert isinstance(in_progress_stats, ColumnStatistics)
        assert in_progress_stats.ticket_count == 5
        assert in_progress_stats.mean_time_seconds > 0
        assert in_progress_stats.std_deviation_seconds > 0

        # Check excluded columns (should have tickets but different handling)
        not_started_stats = stats["Not Started"]
        assert not_started_stats.ticket_count == 3

    def test_calculate_ticket_statistics(self, service, mock_session, sample_board):
        """Test individual ticket statistics calculation"""
        # Create a specific ticket
        now = datetime.utcnow()
        ticket = MagicMock(spec=Ticket)
        ticket.id = 1
        ticket.board_id = 1
        ticket.current_column = "In Progress"
        ticket.column_entered_at = now - timedelta(hours=5)
        ticket.created_at = now - timedelta(days=2)

        # Mock database responses
        mock_session.get.return_value = ticket
        mock_session.exec.return_value.one.return_value = 3  # transition count

        # Mock board statistics
        board_stats = {
            "In Progress": ColumnStatistics(
                column_name="In Progress",
                ticket_count=5,
                mean_time_seconds=14400,  # 4 hours
                std_deviation_seconds=7200,  # 2 hours
                median_time_seconds=14400,
                min_time_seconds=3600,
                max_time_seconds=28800,
                percentile_95_seconds=25200,
            )
        }

        # Calculate ticket statistics
        ticket_stats = service.calculate_ticket_statistics(mock_session, 1, board_stats)

        # Verify results
        assert isinstance(ticket_stats, TicketStatistics)
        assert ticket_stats.ticket_id == 1
        assert ticket_stats.current_column == "In Progress"
        assert ticket_stats.time_in_current_column_seconds == pytest.approx(
            18000, rel=1e-2
        )  # 5 hours
        assert ticket_stats.column_transitions == 3
        assert ticket_stats.z_score is not None

    def test_get_performance_metrics(self, service, mock_session, sample_board):
        """Test performance metrics calculation"""
        # Mock database responses for various queries
        mock_session.exec.return_value.one.side_effect = [
            10,  # tickets_created
            8,  # tickets_completed
            172800,  # avg_completion_seconds (2 days)
            15,  # current_backlog
            2,  # blocked_tickets
            5,  # last_week_completed
            3,  # prev_week_completed
        ]
        mock_session.get.return_value = sample_board

        # Calculate metrics
        metrics = service.get_performance_metrics(mock_session, 1, 30)

        # Verify results
        assert metrics["analysis_period_days"] == 30
        assert metrics["tickets_created"] == 10
        assert metrics["tickets_completed"] == 8
        assert metrics["completion_rate"] == 0.8
        assert metrics["average_completion_time_days"] == 2.0
        assert metrics["throughput_per_day"] == pytest.approx(8 / 30, rel=1e-2)
        assert metrics["current_backlog"] == 15
        assert metrics["blocked_tickets"] == 2
        assert metrics["velocity_trend"] == "improving"  # 5 vs 3

    def test_get_ticket_color_class(self, service):
        """Test ticket color classification"""
        # Create test data
        ticket_stats = TicketStatistics(
            ticket_id=1,
            current_column="In Progress",
            time_in_current_column_seconds=18000,  # 5 hours
            total_age_seconds=172800,  # 2 days
            column_transitions=3,
            z_score=2.5,  # More than 2 std devs
            percentile_rank=95.0,
        )

        column_stats = ColumnStatistics(
            column_name="In Progress",
            ticket_count=10,
            mean_time_seconds=14400,  # 4 hours
            std_deviation_seconds=3600,  # 1 hour
            median_time_seconds=14400,
            min_time_seconds=3600,
            max_time_seconds=28800,
            percentile_95_seconds=25200,
        )

        # Test critical classification
        color_class = service.get_ticket_color_class(ticket_stats, column_stats)
        assert color_class == "ticket-critical"

        # Test normal classification
        ticket_stats.z_score = 0.5
        color_class = service.get_ticket_color_class(ticket_stats, column_stats)
        assert color_class == "ticket-good"

        # Test excluded column
        ticket_stats.current_column = "Done"
        color_class = service.get_ticket_color_class(ticket_stats, column_stats)
        assert color_class == "ticket-normal"

    def test_cache_functionality(self, service, mock_session, sample_board, sample_tickets):
        """Test caching behavior"""
        # Setup mocks
        mock_session.exec.return_value.all.return_value = sample_tickets
        mock_session.get.return_value = sample_board

        # First call should hit database
        stats1 = service.calculate_board_statistics(mock_session, 1)
        call_count_1 = mock_session.exec.call_count

        # Second call should use cache
        stats2 = service.calculate_board_statistics(mock_session, 1)
        call_count_2 = mock_session.exec.call_count

        # Verify cache was used (no additional database calls)
        assert call_count_2 == call_count_1
        assert stats1 == stats2

    def test_cache_expiry(self, service, mock_session, sample_board, sample_tickets):
        """Test cache expiry functionality"""
        # Reduce cache duration for testing
        original_duration = service.cache_duration
        service.cache_duration = 0.1  # 100ms

        try:
            # Setup mocks
            mock_session.exec.return_value.all.return_value = sample_tickets
            mock_session.get.return_value = sample_board

            # First call
            service.calculate_board_statistics(mock_session, 1)

            # Wait for cache to expire
            import time

            time.sleep(0.2)

            # Second call should hit database again
            call_count_before = mock_session.exec.call_count
            service.calculate_board_statistics(mock_session, 1)
            call_count_after = mock_session.exec.call_count

            # Verify cache expired and database was called again
            assert call_count_after > call_count_before

        finally:
            service.cache_duration = original_duration

    def test_clear_cache(self, service):
        """Test cache clearing"""
        # Add something to cache
        service.cache["test_key"] = "test_value"
        service.cache_expiry["test_key"] = datetime.utcnow() + timedelta(hours=1)

        assert len(service.cache) == 1

        # Clear cache
        service.clear_cache()

        assert len(service.cache) == 0
        assert len(service.cache_expiry) == 0

    def test_empty_board_statistics(self, service, mock_session, sample_board):
        """Test statistics calculation for empty board"""
        # Mock empty ticket list
        mock_session.exec.return_value.all.return_value = []
        mock_session.get.return_value = sample_board

        stats = service.calculate_board_statistics(mock_session, 1)

        # All columns should have zero statistics
        for column_name, column_stats in stats.items():
            assert column_stats.ticket_count == 0
            assert column_stats.mean_time_seconds == 0
            assert column_stats.std_deviation_seconds == 0

    def test_single_ticket_column_statistics(self, service, mock_session, sample_board):
        """Test statistics for column with single ticket"""
        now = datetime.utcnow()
        single_ticket = MagicMock(spec=Ticket)
        single_ticket.current_column = "In Progress"
        single_ticket.column_entered_at = now - timedelta(hours=3)

        mock_session.exec.return_value.all.return_value = [single_ticket]
        mock_session.get.return_value = sample_board

        stats = service.calculate_board_statistics(mock_session, 1)

        in_progress_stats = stats["In Progress"]
        assert in_progress_stats.ticket_count == 1
        assert in_progress_stats.mean_time_seconds == pytest.approx(10800, rel=1e-2)  # 3 hours
        assert in_progress_stats.std_deviation_seconds == 0  # Single value has no deviation
