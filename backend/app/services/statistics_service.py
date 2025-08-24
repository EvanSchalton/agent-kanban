import logging
import statistics
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from sqlmodel import Session, and_, func, select

from app.models import Board, Ticket, TicketHistory

logger = logging.getLogger(__name__)


@dataclass
class ColumnStatistics:
    """Statistics for tickets in a specific column"""

    column_name: str
    ticket_count: int
    mean_time_seconds: float
    std_deviation_seconds: float
    median_time_seconds: float
    min_time_seconds: float
    max_time_seconds: float
    percentile_95_seconds: float


@dataclass
class TicketStatistics:
    """Statistics for a specific ticket"""

    ticket_id: int
    current_column: str
    time_in_current_column_seconds: float
    total_age_seconds: float
    column_transitions: int
    z_score: Optional[float]  # Standard deviations from mean
    percentile_rank: Optional[float]  # 0-100 percentile within column


class StatisticsService:
    def __init__(self):
        self.cache = {}
        self.cache_expiry = {}
        self.cache_duration = 300  # 5 minutes

    def calculate_board_statistics(
        self, session: Session, board_id: int
    ) -> Dict[str, ColumnStatistics]:
        """Calculate comprehensive statistics for all columns in a board"""

        cache_key = f"board_stats_{board_id}"
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]

        try:
            # Get all tickets in the board
            tickets_query = select(Ticket).where(Ticket.board_id == board_id)
            tickets = session.exec(tickets_query).all()

            # Get board columns
            board = session.get(Board, board_id)
            if not board:
                return {}

            columns = board.get_columns_list()
            column_stats = {}

            for column in columns:
                column_tickets = [t for t in tickets if t.current_column == column]

                if not column_tickets:
                    column_stats[column] = ColumnStatistics(
                        column_name=column,
                        ticket_count=0,
                        mean_time_seconds=0,
                        std_deviation_seconds=0,
                        median_time_seconds=0,
                        min_time_seconds=0,
                        max_time_seconds=0,
                        percentile_95_seconds=0,
                    )
                    continue

                # Calculate time in column for each ticket
                times = []
                now = datetime.utcnow()

                for ticket in column_tickets:
                    time_in_column = (now - ticket.column_entered_at).total_seconds()
                    times.append(time_in_column)

                # Calculate statistics
                mean_time = statistics.mean(times)
                std_dev = statistics.stdev(times) if len(times) > 1 else 0
                median_time = statistics.median(times)
                min_time = min(times)
                max_time = max(times)

                # Calculate 95th percentile
                sorted_times = sorted(times)
                p95_index = int(0.95 * len(sorted_times))
                p95_time = sorted_times[min(p95_index, len(sorted_times) - 1)]

                column_stats[column] = ColumnStatistics(
                    column_name=column,
                    ticket_count=len(column_tickets),
                    mean_time_seconds=mean_time,
                    std_deviation_seconds=std_dev,
                    median_time_seconds=median_time,
                    min_time_seconds=min_time,
                    max_time_seconds=max_time,
                    percentile_95_seconds=p95_time,
                )

            self._cache_result(cache_key, column_stats)
            return column_stats

        except Exception as e:
            logger.error(f"Error calculating board statistics for {board_id}: {e}")
            return {}

    def calculate_ticket_statistics(
        self,
        session: Session,
        ticket_id: int,
        board_statistics: Optional[Dict[str, ColumnStatistics]] = None,
    ) -> Optional[TicketStatistics]:
        """Calculate detailed statistics for a specific ticket"""

        try:
            ticket = session.get(Ticket, ticket_id)
            if not ticket:
                return None

            # Get board statistics if not provided
            if board_statistics is None:
                board_statistics = self.calculate_board_statistics(session, ticket.board_id)

            # Calculate basic metrics
            now = datetime.utcnow()
            time_in_current_column = (now - ticket.column_entered_at).total_seconds()
            total_age = (now - ticket.created_at).total_seconds()

            # Count transitions
            transitions_query = (
                select(func.count())
                .select_from(TicketHistory)
                .where(
                    and_(TicketHistory.ticket_id == ticket_id, TicketHistory.field_name == "column")
                )
            )
            transition_count = session.exec(transitions_query).one()

            # Calculate z-score and percentile if column stats available
            z_score = None
            percentile_rank = None

            column_stats = board_statistics.get(ticket.current_column)
            if column_stats and column_stats.std_deviation_seconds > 0:
                z_score = (
                    time_in_current_column - column_stats.mean_time_seconds
                ) / column_stats.std_deviation_seconds

                # Calculate percentile rank within column
                column_tickets_query = select(Ticket).where(
                    and_(
                        Ticket.board_id == ticket.board_id,
                        Ticket.current_column == ticket.current_column,
                    )
                )
                column_tickets = session.exec(column_tickets_query).all()

                if column_tickets:
                    times = [(now - t.column_entered_at).total_seconds() for t in column_tickets]
                    times.sort()

                    # Find percentile rank using binary search approach
                    # Count how many times are less than or equal to current time
                    rank = sum(1 for t in times if t <= time_in_current_column) - 1
                    percentile_rank = (rank / len(times)) * 100 if len(times) > 0 else 0

            return TicketStatistics(
                ticket_id=ticket_id,
                current_column=ticket.current_column,
                time_in_current_column_seconds=time_in_current_column,
                total_age_seconds=total_age,
                column_transitions=transition_count,
                z_score=z_score,
                percentile_rank=percentile_rank,
            )

        except Exception as e:
            logger.error(f"Error calculating ticket statistics for {ticket_id}: {e}")
            return None

    def get_performance_metrics(
        self, session: Session, board_id: int, days: int = 30
    ) -> Dict[str, Any]:
        """Calculate board performance metrics over a time period"""

        try:
            since_date = datetime.utcnow() - timedelta(days=days)

            # Tickets created in period
            created_query = (
                select(func.count())
                .select_from(Ticket)
                .where(and_(Ticket.board_id == board_id, Ticket.created_at >= since_date))
            )
            tickets_created = session.exec(created_query).one()

            # Tickets completed in period (moved to Done column)
            completed_query = (
                select(func.count())
                .select_from(TicketHistory)
                .join(Ticket, TicketHistory.ticket_id == Ticket.id)
                .where(
                    and_(
                        Ticket.board_id == board_id,
                        TicketHistory.field_name == "column",
                        TicketHistory.new_value.ilike(
                            "%done%"
                        ),  # Flexible matching for "Done" column
                        TicketHistory.changed_at >= since_date,
                    )
                )
            )
            tickets_completed = session.exec(completed_query).one()

            # Average completion time
            completion_time_query = (
                select(
                    func.avg(
                        func.julianday(TicketHistory.changed_at) - func.julianday(Ticket.created_at)
                    )
                    * 86400  # Convert days to seconds
                )
                .select_from(TicketHistory)
                .join(Ticket, TicketHistory.ticket_id == Ticket.id)
                .where(
                    and_(
                        Ticket.board_id == board_id,
                        TicketHistory.field_name == "column",
                        TicketHistory.new_value.ilike("%done%"),
                        TicketHistory.changed_at >= since_date,
                    )
                )
            )
            avg_completion_seconds = session.exec(completion_time_query).one() or 0

            # Current backlog size
            backlog_query = (
                select(func.count())
                .select_from(Ticket)
                .where(
                    and_(
                        Ticket.board_id == board_id,
                        ~Ticket.current_column.ilike("%done%"),  # Not in done column
                    )
                )
            )
            current_backlog = session.exec(backlog_query).one()

            # Blocked tickets
            blocked_query = (
                select(func.count())
                .select_from(Ticket)
                .where(and_(Ticket.board_id == board_id, Ticket.current_column.ilike("%blocked%")))
            )
            blocked_tickets = session.exec(blocked_query).one()

            # Calculate throughput (tickets per day)
            throughput = tickets_completed / days if days > 0 else 0

            # Calculate velocity trend (last 7 days vs previous 7 days)
            last_week = datetime.utcnow() - timedelta(days=7)
            prev_week = datetime.utcnow() - timedelta(days=14)

            last_week_completed = session.exec(
                select(func.count())
                .select_from(TicketHistory)
                .join(Ticket, TicketHistory.ticket_id == Ticket.id)
                .where(
                    and_(
                        Ticket.board_id == board_id,
                        TicketHistory.field_name == "column",
                        TicketHistory.new_value.ilike("%done%"),
                        TicketHistory.changed_at >= last_week,
                    )
                )
            ).one()

            prev_week_completed = session.exec(
                select(func.count())
                .select_from(TicketHistory)
                .join(Ticket, TicketHistory.ticket_id == Ticket.id)
                .where(
                    and_(
                        Ticket.board_id == board_id,
                        TicketHistory.field_name == "column",
                        TicketHistory.new_value.ilike("%done%"),
                        TicketHistory.changed_at >= prev_week,
                        TicketHistory.changed_at < last_week,
                    )
                )
            ).one()

            velocity_trend = "stable"
            if prev_week_completed > 0:
                change_percent = (
                    (last_week_completed - prev_week_completed) / prev_week_completed
                ) * 100
                if change_percent > 20:
                    velocity_trend = "improving"
                elif change_percent < -20:
                    velocity_trend = "declining"

            return {
                "analysis_period_days": days,
                "tickets_created": tickets_created,
                "tickets_completed": tickets_completed,
                "completion_rate": (
                    tickets_completed / tickets_created if tickets_created > 0 else 0
                ),
                "average_completion_time_seconds": avg_completion_seconds,
                "average_completion_time_days": avg_completion_seconds / 86400,
                "throughput_per_day": throughput,
                "current_backlog": current_backlog,
                "blocked_tickets": blocked_tickets,
                "velocity_trend": velocity_trend,
                "last_week_completed": last_week_completed,
                "previous_week_completed": prev_week_completed,
            }

        except Exception as e:
            logger.error(f"Error calculating performance metrics for board {board_id}: {e}")
            return {}

    def get_ticket_color_class(
        self, ticket_stats: TicketStatistics, column_stats: ColumnStatistics
    ) -> str:
        """Determine color class for ticket based on statistical analysis"""

        if not column_stats or column_stats.ticket_count == 0:
            return "ticket-normal"

        # Skip color coding for start and end columns
        excluded_columns = ["not started", "done", "completed"]
        if any(excluded in ticket_stats.current_column.lower() for excluded in excluded_columns):
            return "ticket-normal"

        # Use z-score for color determination
        if ticket_stats.z_score is None:
            return "ticket-normal"

        if ticket_stats.z_score > 2.0:  # More than 2 standard deviations
            return "ticket-critical"
        elif ticket_stats.z_score > 1.0:  # More than 1 standard deviation
            return "ticket-warning"
        else:
            return "ticket-good"

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached result is still valid"""
        if cache_key not in self.cache:
            return False

        expiry_time = self.cache_expiry.get(cache_key)
        if not expiry_time or datetime.utcnow() > expiry_time:
            # Clean up expired cache
            if cache_key in self.cache:
                del self.cache[cache_key]
            if cache_key in self.cache_expiry:
                del self.cache_expiry[cache_key]
            return False

        return True

    def _cache_result(self, cache_key: str, result: Any):
        """Cache a result with expiry time"""
        self.cache[cache_key] = result
        self.cache_expiry[cache_key] = datetime.utcnow() + timedelta(seconds=self.cache_duration)

    def clear_cache(self):
        """Clear all cached results"""
        self.cache.clear()
        self.cache_expiry.clear()


# Global service instance
statistics_service = StatisticsService()
