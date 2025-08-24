import os
import secrets
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Agent Kanban Board"
    app_version: str = "0.1.0"
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:15175",
    ]
    websocket_port: int = 8000
    mcp_enabled: bool = True
    secret_key: str = secrets.token_urlsafe(32)
    access_token_expire_minutes: int = 30
    testing: bool = False  # Set to True during tests to disable rate limiting
    vite_api_url: str = "/api"  # Add the missing field

    @property
    def database_url(self) -> Optional[str]:
        """CRITICAL: Prevent tests from using production DB."""
        # Check if we're in test mode
        if os.getenv("TESTING") == "true":
            # In test mode, check if a test-specific DATABASE_URL is provided
            test_db_url = os.getenv("DATABASE_URL")
            if test_db_url:
                # Ensure it's not the production database
                if "agent_kanban.db" in test_db_url:
                    # Still return None to trigger the error in database.py
                    return None
                # Allow test database URLs
                return test_db_url
            # No DATABASE_URL provided in test mode
            return None

        # Production/dev database - use environment variable or default
        return os.getenv("DATABASE_URL", "sqlite:///./agent_kanban.db")

    class Config:
        env_file = ".env"
        extra = "allow"  # Allow extra fields from env


settings = Settings()
