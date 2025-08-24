import logging
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.exc import SQLAlchemyError

from app.api.endpoints import (
    auth,
    boards,
    bulk,
    comments,
    health,
    history,
    statistics,
    tickets,
    users,
    websocket,
)
from app.core import create_db_and_tables, settings
from app.core.error_handlers import (
    APIException,
    RequestLoggingMiddleware,
    api_exception_handler,
    database_exception_handler,
    general_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.core.monitoring import get_system_health, memory_monitor
from app.mcp.server import setup_mcp_server
from app.services.socketio_service import sio

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)


# Create rate limiter (disabled during testing)
def get_rate_limit():
    # Disable rate limiting during tests
    if settings.testing:
        return "10000/minute"
    return "60/minute"


limiter = Limiter(key_func=get_remote_address, default_limits=[get_rate_limit()])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Log startup
    logging.warning("🔴 CRITICAL: Application startup initiated")
    logging.warning(f"🔴 CRITICAL: Testing mode = {settings.testing}")

    # Initialize database
    logging.warning("🔴 CRITICAL: About to initialize database")
    create_db_and_tables()
    logging.warning("🔴 CRITICAL: Database initialization completed")

    # Create default board if none exist
    from sqlmodel import select

    from app.core import get_session
    from app.models import Board

    with next(get_session()) as session:
        boards = session.exec(select(Board)).all()
        if not boards:
            default_board = Board(
                name="My First Board", description="Welcome to your kanban board!"
            )
            session.add(default_board)
            session.commit()
            logging.info("✅ Created default board: My First Board")
        else:
            logging.info(f"✅ Found {len(boards)} existing board(s)")

    # Start memory monitoring
    memory_monitor.start_monitoring()

    # Setup MCP server if enabled
    if settings.mcp_enabled:
        await setup_mcp_server()

    yield

    # Cleanup on shutdown
    memory_monitor.stop_monitoring()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

# Create Socket.IO ASGI app - this will be the main app exported
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

# Add rate limiter to app state
app.state.limiter = limiter

# Add error handlers (order matters!)
app.add_exception_handler(APIException, api_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Add middleware (order matters - added in reverse order of execution)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers with new endpoints
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(boards.router, prefix="/api/boards", tags=["boards"])
app.include_router(tickets.router, prefix="/api/tickets", tags=["tickets"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(history.router, prefix="/api/history", tags=["history"])
app.include_router(statistics.router, prefix="/api/statistics", tags=["statistics"])
app.include_router(bulk.router, prefix="/api/bulk", tags=["bulk"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


@app.get("/")
async def root():
    return {"message": "Agent Kanban Board API", "version": settings.app_version}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "socketio": "available", "cors": "enabled"}


@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with memory and system info"""
    return get_system_health()


@app.get("/health/memory")
async def memory_health_check():
    """Memory-specific health check"""
    return memory_monitor.get_memory_report()


@app.options("/api/{rest_of_path:path}")
async def preflight_handler():
    """Handle CORS preflight requests"""
    return {"message": "OK"}


@app.get("/api/status")
async def api_status():
    """Detailed API status for frontend integration debugging"""
    return {
        "status": "operational",
        "version": settings.app_version,
        "cors_origins": settings.cors_origins,
        "websocket_available": True,
        "socketio_available": True,
        "endpoints": {
            "boards": "/api/boards/",
            "tickets": "/api/tickets/",
            "websocket": "/ws/connect",
            "socketio": "/socket.io/",
        },
    }
