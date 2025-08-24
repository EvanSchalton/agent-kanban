"""Main FastAPI application."""

import json
import os
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import boards, tickets, websocket
from .database import create_default_board, get_session, init_db

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    init_db()

    # Create default board if needed
    with next(get_session()) as session:
        create_default_board(session)

    print("Database initialized and default board created")

    yield

    # Shutdown
    print("Application shutting down")


# Create FastAPI app
app = FastAPI(
    title="Agent Kanban Board API",
    description="API for managing an agentic workforce through a kanban board",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
cors_origins = os.getenv("CORS_ORIGINS", '["http://localhost:3000", "http://localhost:5173"]')
cors_origins = json.loads(cors_origins) if isinstance(cors_origins, str) else cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(boards.router, prefix="/api/boards", tags=["boards"])
app.include_router(tickets.router, prefix="/api/tickets", tags=["tickets"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


@app.get("/")
async def root() -> dict[str, Any]:
    """Root endpoint."""
    return {
        "name": "Agent Kanban Board API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))

    uvicorn.run("src.backend.main:app", host=host, port=port, reload=True)
