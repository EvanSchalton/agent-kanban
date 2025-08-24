#!/usr/bin/env python3
"""
Unit tests for drag-and-drop logging functionality
"""

import json
from unittest.mock import patch

import pytest

from app.core.logging import (
    DragDropLogger,
    DragDropMetricsCollector,
    log_drag_drop_operation,
)
from app.services.cache_service import cache_service


class TestDragDropLogger:
    """Test class for drag-and-drop logging functionality"""

    def setup_method(self):
        """Set up test environment"""
        self.logger = DragDropLogger()
        self.test_ticket_id = "test-ticket-123"
        self.test_board_id = 1
        self.test_source_column = "todo"
        self.test_target_column = "in_progress"

    def test_logger_initialization(self):
        """Test logger initializes correctly"""
        assert self.logger.logger is not None
        assert self.logger.logger.name == "drag_drop"

    def test_log_drag_start(self):
        """Test logging drag start event"""
        with patch.object(self.logger.logger, "info") as mock_info:
            self.logger.log_drag_start(
                ticket_id=self.test_ticket_id,
                board_id=self.test_board_id,
                source_column=self.test_source_column,
                user_agent="test-agent",
            )

            mock_info.assert_called_once()
            call_args = mock_info.call_args[0][0]

            assert "DRAG_DROP_EVENT" in call_args
            assert self.test_ticket_id in call_args
            assert str(self.test_board_id) in call_args
            assert self.test_source_column in call_args
            assert "drag_start" in call_args

    def test_log_drop_attempt(self):
        """Test logging drop attempt"""
        with patch.object(self.logger.logger, "info") as mock_info:
            self.logger.log_drop_attempt(
                ticket_id=self.test_ticket_id,
                board_id=self.test_board_id,
                source_column=self.test_source_column,
                target_column=self.test_target_column,
                client_timestamp="2023-01-01T12:00:00Z",
            )

            mock_info.assert_called_once()
            call_args = mock_info.call_args[0][0]

            assert "DRAG_DROP_EVENT" in call_args
            assert "drop_attempt" in call_args
            assert self.test_target_column in call_args

    def test_log_drop_success(self):
        """Test logging successful drop"""
        with patch.object(self.logger.logger, "info") as mock_info:
            self.logger.log_drop_success(
                ticket_id=self.test_ticket_id,
                board_id=self.test_board_id,
                source_column=self.test_source_column,
                target_column=self.test_target_column,
                execution_time_ms=150.5,
                websocket_broadcast_count=3,
            )

            mock_info.assert_called_once()
            call_args = mock_info.call_args[0][0]

            assert "DRAG_DROP_EVENT" in call_args
            assert "drop_success" in call_args
            assert "150.5" in call_args
            assert "status" in call_args and "success" in call_args

    def test_log_drop_failure(self):
        """Test logging failed drop"""
        with patch.object(self.logger.logger, "error") as mock_error:
            self.logger.log_drop_failure(
                ticket_id=self.test_ticket_id,
                board_id=self.test_board_id,
                source_column=self.test_source_column,
                target_column=self.test_target_column,
                error="Database connection failed",
                execution_time_ms=75.2,
            )

            mock_error.assert_called_once()
            call_args = mock_error.call_args[0][0]

            assert "DRAG_DROP_EVENT" in call_args
            assert "drop_failure" in call_args
            assert "Database connection failed" in call_args
            assert "status" in call_args and "error" in call_args

    def test_log_bulk_operation(self):
        """Test logging bulk operation"""
        with patch.object(self.logger.logger, "info") as mock_info:
            self.logger.log_bulk_operation(
                operation_type="bulk_move",
                ticket_count=5,
                board_id=self.test_board_id,
                execution_time_ms=250.0,
                success_count=4,
                failure_count=1,
            )

            mock_info.assert_called_once()
            call_args = mock_info.call_args[0][0]

            assert "DRAG_DROP_EVENT" in call_args
            assert "bulk_operation" in call_args
            assert "bulk_move" in call_args
            assert "success_rate" in call_args

            # Verify success rate calculation
            log_data = json.loads(call_args.split("DRAG_DROP_EVENT: ")[1])
            assert log_data["success_rate"] == 80.0  # 4/5 * 100

    def test_log_websocket_broadcast(self):
        """Test logging WebSocket broadcast performance"""
        with patch.object(self.logger.logger, "debug") as mock_debug:
            self.logger.log_websocket_broadcast(
                board_id=self.test_board_id,
                event_type="ticket_moved",
                client_count=5,
                broadcast_time_ms=25.5,
                failed_clients=1,
            )

            mock_debug.assert_called_once()
            call_args = mock_debug.call_args[0][0]

            assert "DRAG_DROP_EVENT" in call_args
            assert "websocket_broadcast" in call_args
            assert "ticket_moved" in call_args

            # Verify success rate calculation
            log_data = json.loads(call_args.split("DRAG_DROP_EVENT: ")[1])
            assert log_data["success_rate"] == 80.0  # (5-1)/5 * 100


class TestLogDragDropOperationDecorator:
    """Test class for drag-drop operation decorator"""

    def test_decorator_with_sync_function(self):
        """Test decorator works with synchronous functions"""

        @log_drag_drop_operation("test_operation")
        def test_sync_function(ticket_id):
            return f"processed {ticket_id}"

        with patch.object(DragDropLogger, "_log_structured") as mock_log:
            result = test_sync_function("test-ticket-123")

            assert result == "processed test-ticket-123"
            # Should have logged start and success
            assert mock_log.call_count >= 2

    def test_decorator_with_async_function(self):
        """Test decorator works with async functions"""
        import asyncio

        @log_drag_drop_operation("test_async_operation")
        async def test_async_function(ticket_id):
            await asyncio.sleep(0.01)  # Simulate some async work
            return f"async processed {ticket_id}"

        with patch.object(DragDropLogger, "_log_structured") as mock_log:
            result = asyncio.run(test_async_function("test-ticket-456"))

            assert result == "async processed test-ticket-456"
            # Should have logged start and success
            assert mock_log.call_count >= 2

    def test_decorator_handles_exceptions(self):
        """Test decorator properly handles and logs exceptions"""

        @log_drag_drop_operation("test_error_operation")
        def test_error_function(ticket_id):
            raise ValueError("Test error")

        with patch.object(DragDropLogger, "_log_structured") as mock_log:
            with pytest.raises(ValueError, match="Test error"):
                test_error_function("test-ticket-error")

            # Should have logged error
            error_calls = [call for call in mock_log.call_args_list if "error" in str(call)]
            assert len(error_calls) > 0


class TestDragDropMetricsCollector:
    """Test class for drag-drop metrics collection"""

    def setup_method(self):
        """Set up test environment"""
        self.collector = DragDropMetricsCollector()
        self.test_board_id = 1

    def test_record_operation_success(self):
        """Test recording successful operation"""
        self.collector.record_operation(
            board_id=self.test_board_id, operation="move_ticket", duration_ms=100.0, success=True
        )

        metrics = self.collector.get_board_metrics(self.test_board_id)

        assert metrics is not None
        assert metrics["total_operations"] == 1
        assert metrics["successful_operations"] == 1
        assert metrics["failed_operations"] == 0
        assert metrics["average_duration_ms"] == 100.0
        assert "move_ticket" in metrics["operations_by_type"]

    def test_record_operation_failure(self):
        """Test recording failed operation"""
        self.collector.record_operation(
            board_id=self.test_board_id, operation="move_ticket", duration_ms=50.0, success=False
        )

        metrics = self.collector.get_board_metrics(self.test_board_id)

        assert metrics is not None
        assert metrics["total_operations"] == 1
        assert metrics["successful_operations"] == 0
        assert metrics["failed_operations"] == 1

    def test_record_multiple_operations(self):
        """Test recording multiple operations and averaging"""
        # Record several operations
        durations = [100.0, 200.0, 150.0]

        for duration in durations:
            self.collector.record_operation(
                board_id=self.test_board_id,
                operation="move_ticket",
                duration_ms=duration,
                success=True,
            )

        metrics = self.collector.get_board_metrics(self.test_board_id)

        assert metrics["total_operations"] == 3
        assert metrics["successful_operations"] == 3
        assert metrics["average_duration_ms"] == 150.0  # (100+200+150)/3

        # Check operation type tracking
        move_ops = metrics["operations_by_type"]["move_ticket"]
        assert move_ops["count"] == 3
        assert move_ops["duration_ms"] == 450.0  # sum of all durations

    def test_get_board_metrics_nonexistent(self):
        """Test getting metrics for non-existent board"""
        metrics = self.collector.get_board_metrics(999)
        assert metrics is None

    @patch.object(cache_service, "set")
    def test_cache_integration(self, mock_cache_set):
        """Test that metrics are cached"""
        self.collector.record_operation(
            board_id=self.test_board_id, operation="test_op", duration_ms=100.0, success=True
        )

        # Should have called cache.set
        mock_cache_set.assert_called_once()
        call_args = mock_cache_set.call_args
        assert f"drag_drop_metrics:{self.test_board_id}" == call_args[0][0]
        assert call_args[0][2] == 3600  # TTL

    @patch.object(cache_service, "get")
    def test_cache_retrieval(self, mock_cache_get):
        """Test retrieving metrics from cache"""
        cached_data = {"total_operations": 5, "successful_operations": 4, "failed_operations": 1}
        mock_cache_get.return_value = cached_data

        metrics = self.collector.get_board_metrics(self.test_board_id)

        assert metrics == cached_data
        mock_cache_get.assert_called_once_with(f"drag_drop_metrics:{self.test_board_id}")


class TestLoggingIntegration:
    """Test logging integration with actual log output"""

    def test_structured_logging_format(self):
        """Test that structured logging produces parseable JSON"""
        logger = DragDropLogger()

        # Capture log output
        with patch.object(logger.logger, "info") as mock_info:
            logger.log_drop_success(
                ticket_id="test-123",
                board_id=1,
                source_column="todo",
                target_column="done",
                execution_time_ms=123.45,
                websocket_broadcast_count=2,
            )

            # Get the logged message
            logged_message = mock_info.call_args[0][0]

            # Extract JSON part
            json_part = logged_message.split("DRAG_DROP_EVENT: ")[1]

            # Should be valid JSON
            log_data = json.loads(json_part)

            # Verify structure
            assert log_data["event_type"] == "drop_success"
            assert log_data["level"] == "INFO"
            assert log_data["ticket_id"] == "test-123"
            assert log_data["board_id"] == 1
            assert log_data["execution_time_ms"] == 123.45
            assert "timestamp" in log_data

    def test_log_performance_metrics(self):
        """Test logging performance metrics"""
        logger = DragDropLogger()

        test_metrics = {
            "average_response_time": 150.5,
            "cache_hit_rate": 85.2,
            "websocket_clients": 10,
        }

        with patch.object(logger.logger, "info") as mock_info:
            logger.log_performance_metrics(board_id=1, metrics=test_metrics)

            logged_message = mock_info.call_args[0][0]
            json_part = logged_message.split("DRAG_DROP_EVENT: ")[1]
            log_data = json.loads(json_part)

            assert log_data["event_type"] == "performance_metrics"
            assert log_data["board_id"] == 1
            assert log_data["metrics"] == test_metrics


if __name__ == "__main__":
    # Run tests for debugging
    import sys

    print("Testing DragDropLogger...")
    logger_test = TestDragDropLogger()
    logger_test.setup_method()

    try:
        logger_test.test_logger_initialization()
        print("✓ Logger initialization test passed")

        logger_test.test_log_drag_start()
        print("✓ Log drag start test passed")

        logger_test.test_log_drop_success()
        print("✓ Log drop success test passed")

        logger_test.test_log_bulk_operation()
        print("✓ Log bulk operation test passed")

        print("\nTesting MetricsCollector...")
        metrics_test = TestDragDropMetricsCollector()
        metrics_test.setup_method()

        metrics_test.test_record_operation_success()
        print("✓ Record operation success test passed")

        metrics_test.test_record_multiple_operations()
        print("✓ Multiple operations test passed")

        print("\nTesting Decorator...")
        decorator_test = TestLogDragDropOperationDecorator()

        decorator_test.test_decorator_with_sync_function()
        print("✓ Sync decorator test passed")

        print("\nAll drag-drop logging tests passed! ✓")

    except Exception as e:
        print(f"Test failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
