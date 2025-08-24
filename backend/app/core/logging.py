import asyncio
import json
import logging
import traceback
from datetime import datetime
from functools import wraps
from typing import Any, Dict, Optional

from app.services.cache_service import cache_service


# Configure structured logging for drag-and-drop operations
class DragDropLogger:
    """Specialized logger for drag-and-drop operations with structured logging"""

    def __init__(self):
        self.logger = logging.getLogger("drag_drop")
        self.logger.setLevel(logging.DEBUG)

        # Create console handler with structured formatting
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter("%(asctime)s - %(name)s - [%(levelname)s] - %(message)s")
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

    def _log_structured(self, level: str, event_type: str, data: Dict[str, Any]):
        """Log with structured format for better parsing"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "level": level,
            **data,
        }

        message = f"DRAG_DROP_EVENT: {json.dumps(log_entry, default=str)}"

        if level == "DEBUG":
            self.logger.debug(message)
        elif level == "INFO":
            self.logger.info(message)
        elif level == "WARNING":
            self.logger.warning(message)
        elif level == "ERROR":
            self.logger.error(message)

    def log_drag_start(
        self, ticket_id: str, board_id: int, source_column: str, user_agent: Optional[str] = None
    ):
        """Log drag start event"""
        self._log_structured(
            "INFO",
            "drag_start",
            {
                "ticket_id": ticket_id,
                "board_id": board_id,
                "source_column": source_column,
                "user_agent": user_agent,
                "action": "drag_initiated",
            },
        )

    def log_drag_over(self, ticket_id: str, target_column: str, board_id: int):
        """Log drag over column event"""
        self._log_structured(
            "DEBUG",
            "drag_over",
            {
                "ticket_id": ticket_id,
                "target_column": target_column,
                "board_id": board_id,
                "action": "drag_over_column",
            },
        )

    def log_drop_attempt(
        self,
        ticket_id: str,
        board_id: int,
        source_column: str,
        target_column: str,
        client_timestamp: Optional[str] = None,
    ):
        """Log drop attempt"""
        self._log_structured(
            "INFO",
            "drop_attempt",
            {
                "ticket_id": ticket_id,
                "board_id": board_id,
                "source_column": source_column,
                "target_column": target_column,
                "client_timestamp": client_timestamp,
                "server_timestamp": datetime.utcnow().isoformat(),
                "action": "drop_attempted",
            },
        )

    def log_drop_success(
        self,
        ticket_id: str,
        board_id: int,
        source_column: str,
        target_column: str,
        execution_time_ms: float,
        websocket_broadcast_count: int,
    ):
        """Log successful drop operation"""
        self._log_structured(
            "INFO",
            "drop_success",
            {
                "ticket_id": ticket_id,
                "board_id": board_id,
                "source_column": source_column,
                "target_column": target_column,
                "execution_time_ms": execution_time_ms,
                "websocket_broadcast_count": websocket_broadcast_count,
                "action": "drop_completed",
                "status": "success",
            },
        )

    def log_drop_failure(
        self,
        ticket_id: str,
        board_id: int,
        source_column: str,
        target_column: str,
        error: str,
        execution_time_ms: float,
    ):
        """Log failed drop operation"""
        self._log_structured(
            "ERROR",
            "drop_failure",
            {
                "ticket_id": ticket_id,
                "board_id": board_id,
                "source_column": source_column,
                "target_column": target_column,
                "error": error,
                "execution_time_ms": execution_time_ms,
                "action": "drop_failed",
                "status": "error",
            },
        )

    def log_optimistic_update(self, ticket_id: str, board_id: int, column_change: Dict[str, str]):
        """Log optimistic UI update"""
        self._log_structured(
            "DEBUG",
            "optimistic_update",
            {
                "ticket_id": ticket_id,
                "board_id": board_id,
                "column_change": column_change,
                "action": "optimistic_ui_update",
            },
        )

    def log_revert_update(self, ticket_id: str, board_id: int, original_column: str, reason: str):
        """Log optimistic update revert"""
        self._log_structured(
            "WARNING",
            "revert_update",
            {
                "ticket_id": ticket_id,
                "board_id": board_id,
                "reverted_to_column": original_column,
                "reason": reason,
                "action": "optimistic_update_reverted",
            },
        )

    def log_bulk_operation(
        self,
        operation_type: str,
        ticket_count: int,
        board_id: int,
        execution_time_ms: float,
        success_count: int,
        failure_count: int,
    ):
        """Log bulk drag-and-drop operations"""
        self._log_structured(
            "INFO",
            "bulk_operation",
            {
                "operation_type": operation_type,
                "ticket_count": ticket_count,
                "board_id": board_id,
                "execution_time_ms": execution_time_ms,
                "success_count": success_count,
                "failure_count": failure_count,
                "success_rate": (success_count / ticket_count) * 100 if ticket_count > 0 else 0,
                "action": "bulk_operation_completed",
            },
        )

    def log_websocket_broadcast(
        self,
        board_id: int,
        event_type: str,
        client_count: int,
        broadcast_time_ms: float,
        failed_clients: int = 0,
    ):
        """Log WebSocket broadcast performance"""
        self._log_structured(
            "DEBUG",
            "websocket_broadcast",
            {
                "board_id": board_id,
                "event_type": event_type,
                "client_count": client_count,
                "failed_clients": failed_clients,
                "broadcast_time_ms": broadcast_time_ms,
                "success_rate": (
                    ((client_count - failed_clients) / client_count) * 100
                    if client_count > 0
                    else 0
                ),
                "action": "websocket_broadcast",
            },
        )

    def log_performance_metrics(self, board_id: int, metrics: Dict[str, Any]):
        """Log performance metrics for analysis"""
        self._log_structured(
            "INFO",
            "performance_metrics",
            {"board_id": board_id, "metrics": metrics, "action": "performance_analysis"},
        )


# Global logger instance
drag_drop_logger = DragDropLogger()


def log_drag_drop_operation(operation_type: str):
    """Decorator to automatically log drag-and-drop operations"""

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = datetime.utcnow()
            ticket_id = kwargs.get("ticket_id") or (args[0] if args else "unknown")

            try:
                # Log operation start
                drag_drop_logger._log_structured(
                    "DEBUG",
                    f"{operation_type}_start",
                    {
                        "function": func.__name__,
                        "ticket_id": ticket_id,
                        "args_count": len(args),
                        "kwargs_keys": list(kwargs.keys()),
                        "action": f"{operation_type}_initiated",
                    },
                )

                # Execute function
                result = await func(*args, **kwargs)

                # Calculate execution time
                execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000

                # Log successful completion
                drag_drop_logger._log_structured(
                    "INFO",
                    f"{operation_type}_success",
                    {
                        "function": func.__name__,
                        "ticket_id": ticket_id,
                        "execution_time_ms": execution_time,
                        "action": f"{operation_type}_completed",
                        "status": "success",
                    },
                )

                return result

            except Exception as e:
                # Calculate execution time
                execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000

                # Log error
                drag_drop_logger._log_structured(
                    "ERROR",
                    f"{operation_type}_error",
                    {
                        "function": func.__name__,
                        "ticket_id": ticket_id,
                        "execution_time_ms": execution_time,
                        "error": str(e),
                        "error_type": type(e).__name__,
                        "traceback": traceback.format_exc(),
                        "action": f"{operation_type}_failed",
                        "status": "error",
                    },
                )

                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = datetime.utcnow()
            ticket_id = kwargs.get("ticket_id") or (args[0] if args else "unknown")

            try:
                # Log operation start
                drag_drop_logger._log_structured(
                    "DEBUG",
                    f"{operation_type}_start",
                    {
                        "function": func.__name__,
                        "ticket_id": ticket_id,
                        "args_count": len(args),
                        "kwargs_keys": list(kwargs.keys()),
                        "action": f"{operation_type}_initiated",
                    },
                )

                result = func(*args, **kwargs)
                execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000

                drag_drop_logger._log_structured(
                    "INFO",
                    f"{operation_type}_success",
                    {
                        "function": func.__name__,
                        "ticket_id": ticket_id,
                        "execution_time_ms": execution_time,
                        "action": f"{operation_type}_completed",
                        "status": "success",
                    },
                )

                return result

            except Exception as e:
                execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000

                drag_drop_logger._log_structured(
                    "ERROR",
                    f"{operation_type}_error",
                    {
                        "function": func.__name__,
                        "ticket_id": ticket_id,
                        "execution_time_ms": execution_time,
                        "error": str(e),
                        "error_type": type(e).__name__,
                        "traceback": traceback.format_exc(),
                        "action": f"{operation_type}_failed",
                        "status": "error",
                    },
                )

                raise

        # Return appropriate wrapper based on whether function is async
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


class DragDropMetricsCollector:
    """Collect and analyze drag-and-drop metrics"""

    def __init__(self):
        self.metrics = {}
        self.logger = logging.getLogger("drag_drop_metrics")

    def record_operation(self, board_id: int, operation: str, duration_ms: float, success: bool):
        """Record a drag-and-drop operation for metrics"""
        if board_id not in self.metrics:
            self.metrics[board_id] = {
                "total_operations": 0,
                "successful_operations": 0,
                "failed_operations": 0,
                "total_duration_ms": 0,
                "average_duration_ms": 0,
                "operations_by_type": {},
                "last_updated": datetime.utcnow(),
            }

        board_metrics = self.metrics[board_id]
        board_metrics["total_operations"] += 1
        board_metrics["total_duration_ms"] += duration_ms
        board_metrics["average_duration_ms"] = (
            board_metrics["total_duration_ms"] / board_metrics["total_operations"]
        )
        board_metrics["last_updated"] = datetime.utcnow()

        if success:
            board_metrics["successful_operations"] += 1
        else:
            board_metrics["failed_operations"] += 1

        # Track by operation type
        if operation not in board_metrics["operations_by_type"]:
            board_metrics["operations_by_type"][operation] = {"count": 0, "duration_ms": 0}

        board_metrics["operations_by_type"][operation]["count"] += 1
        board_metrics["operations_by_type"][operation]["duration_ms"] += duration_ms

        # Cache metrics for API access
        cache_service.set(f"drag_drop_metrics:{board_id}", board_metrics, 3600)  # 1 hour TTL

    def get_board_metrics(self, board_id: int) -> Optional[Dict[str, Any]]:
        """Get metrics for a specific board"""
        # Try cache first
        cached_metrics = cache_service.get(f"drag_drop_metrics:{board_id}")
        if cached_metrics:
            return cached_metrics

        return self.metrics.get(board_id)

    def get_all_metrics(self) -> Dict[int, Dict[str, Any]]:
        """Get metrics for all boards"""
        return self.metrics


# Global metrics collector
metrics_collector = DragDropMetricsCollector()
