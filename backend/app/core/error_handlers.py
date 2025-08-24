# from sqlmodel.exc import SQLModelError  # Not available in current sqlmodel version
import logging
import time
import traceback
from typing import Any, Dict

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

logger = logging.getLogger(__name__)


class APIException(HTTPException):
    """Custom API exception with enhanced logging"""

    def __init__(self, status_code: int, detail: str, error_code: str = None, **kwargs):
        super().__init__(status_code=status_code, detail=detail, **kwargs)
        self.error_code = error_code


async def api_exception_handler(request: Request, exc: APIException):
    """Handle custom API exceptions"""

    error_id = f"err_{int(time.time() * 1000)}"

    logger.error(
        f"API Error {error_id}: {exc.detail}",
        extra={
            "error_id": error_id,
            "status_code": exc.status_code,
            "error_code": exc.error_code,
            "path": request.url.path,
            "method": request.method,
            "client": request.client.host if request.client else "unknown",
        },
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.detail,
                "code": exc.error_code,
                "error_id": error_id,
                "timestamp": int(time.time()),
            }
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle standard HTTP exceptions with logging"""

    error_id = f"err_{int(time.time() * 1000)}"

    # Log different levels based on status code
    if exc.status_code >= 500:
        logger.error(
            f"Server Error {error_id}: {exc.detail}",
            extra={
                "error_id": error_id,
                "status_code": exc.status_code,
                "path": request.url.path,
                "method": request.method,
                "client": request.client.host if request.client else "unknown",
            },
        )
    elif exc.status_code >= 400:
        logger.warning(
            f"Client Error {error_id}: {exc.detail}",
            extra={
                "error_id": error_id,
                "status_code": exc.status_code,
                "path": request.url.path,
                "method": request.method,
                "client": request.client.host if request.client else "unknown",
            },
        )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {"message": exc.detail, "error_id": error_id, "timestamp": int(time.time())}
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""

    error_id = f"err_{int(time.time() * 1000)}"

    # Format validation errors
    formatted_errors = []
    for error in exc.errors():
        formatted_errors.append(
            {
                "field": ".".join(str(x) for x in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            }
        )

    logger.warning(
        f"Validation Error {error_id}: Invalid request data",
        extra={
            "error_id": error_id,
            "path": request.url.path,
            "method": request.method,
            "validation_errors": formatted_errors,
            "client": request.client.host if request.client else "unknown",
        },
    )

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "message": "Request validation failed",
                "code": "VALIDATION_ERROR",
                "error_id": error_id,
                "timestamp": int(time.time()),
                "validation_errors": formatted_errors,
            }
        },
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle database-related exceptions"""

    error_id = f"err_{int(time.time() * 1000)}"

    # Determine error type and appropriate response
    if isinstance(exc, IntegrityError):
        status_code = 400
        message = "Data integrity constraint violation"
        error_code = "INTEGRITY_ERROR"
        log_level = "warning"
    else:
        status_code = 500
        message = "Database operation failed"
        error_code = "DATABASE_ERROR"
        log_level = "error"

    # Log the error
    log_func = getattr(logger, log_level)
    log_func(
        f"Database Error {error_id}: {str(exc)}",
        extra={
            "error_id": error_id,
            "exception_type": type(exc).__name__,
            "path": request.url.path,
            "method": request.method,
            "client": request.client.host if request.client else "unknown",
        },
    )

    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "message": message,
                "code": error_code,
                "error_id": error_id,
                "timestamp": int(time.time()),
            }
        },
    )


async def general_exception_handler(request: Request, exc: Exception):
    """Handle any unhandled exceptions"""

    error_id = f"err_{int(time.time() * 1000)}"

    logger.error(
        f"Unhandled Exception {error_id}: {str(exc)}",
        extra={
            "error_id": error_id,
            "exception_type": type(exc).__name__,
            "path": request.url.path,
            "method": request.method,
            "client": request.client.host if request.client else "unknown",
            "traceback": traceback.format_exc(),
        },
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "message": "An unexpected error occurred",
                "code": "INTERNAL_ERROR",
                "error_id": error_id,
                "timestamp": int(time.time()),
            }
        },
    )


# Request/Response logging middleware
class RequestLoggingMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_start_time = time.time()
        request_id = f"req_{int(request_start_time * 1000)}"

        # Add request ID to scope for use in handlers
        scope["request_id"] = request_id

        # Log request start
        path = scope.get("path", "")
        method = scope.get("method", "")
        client_ip = "unknown"

        if scope.get("client"):
            client_ip = scope["client"][0]

        logger.info(
            f"Request {request_id} started: {method} {path}",
            extra={
                "request_id": request_id,
                "method": method,
                "path": path,
                "client_ip": client_ip,
            },
        )

        # Process request and capture response
        response_status = None

        async def send_wrapper(message):
            nonlocal response_status
            if message["type"] == "http.response.start":
                response_status = message.get("status", 0)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            response_status = 500
            logger.error(
                f"Request {request_id} failed with exception: {str(e)}",
                extra={"request_id": request_id, "exception_type": type(e).__name__},
            )
            raise
        finally:
            # Log request completion
            request_duration = time.time() - request_start_time

            log_level = "info"
            if response_status and response_status >= 500:
                log_level = "error"
            elif response_status and response_status >= 400:
                log_level = "warning"

            log_func = getattr(logger, log_level)
            log_func(
                f"Request {request_id} completed: {method} {path} - "
                f"{response_status} ({request_duration:.3f}s)",
                extra={
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "status_code": response_status,
                    "duration_seconds": request_duration,
                    "client_ip": client_ip,
                },
            )


def log_operation(operation_name: str, **kwargs) -> Dict[str, Any]:
    """Decorator/context manager for logging business operations"""
    start_time = time.time()
    operation_id = f"op_{int(start_time * 1000)}"

    logger.info(
        f"Operation {operation_id} started: {operation_name}",
        extra={"operation_id": operation_id, "operation_name": operation_name, **kwargs},
    )

    return {"operation_id": operation_id, "start_time": start_time}


def log_operation_complete(operation_info: Dict[str, Any], success: bool = True, **kwargs):
    """Log completion of a business operation"""
    duration = time.time() - operation_info["start_time"]
    operation_id = operation_info["operation_id"]

    if success:
        logger.info(
            f"Operation {operation_id} completed successfully ({duration:.3f}s)",
            extra={
                "operation_id": operation_id,
                "duration_seconds": duration,
                "success": True,
                **kwargs,
            },
        )
    else:
        logger.error(
            f"Operation {operation_id} failed ({duration:.3f}s)",
            extra={
                "operation_id": operation_id,
                "duration_seconds": duration,
                "success": False,
                **kwargs,
            },
        )
