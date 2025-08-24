import logging
import os
from pathlib import Path
from typing import Generator

from sqlalchemy import event
from sqlmodel import Session, create_engine

from app.core.config import settings

# Import database protection FIRST to ensure it's installed
from app.core.database_protection import install_database_protection

# Set up logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Install protection immediately
install_database_protection()


def get_db_url():
    """Get database URL with testing protection."""
    # Check if we're in test mode
    if os.getenv("TESTING") == "true":
        # Get URL from settings (which returns None in test mode)
        db_url = settings.database_url
        if db_url is None:
            raise RuntimeError(
                "CRITICAL: Tests must provide their own database! "
                "Set a test-specific DATABASE_URL or use test fixtures."
            )
        # Additional safety check - prevent production DB usage
        if "agent_kanban.db" in str(db_url):
            raise RuntimeError("CRITICAL: Tests attempting to use production database!")
        return db_url

    # Production/dev mode - use settings which handles env variables
    return settings.database_url


# CRITICAL FIX: Use absolute path for database to prevent multiple database files
# This ensures the database is always in the project root, not in the backend directory
PROJECT_ROOT = Path(
    __file__
).parent.parent.parent.parent  # Navigate from backend/app/core/database.py to project root
DATABASE_PATH = PROJECT_ROOT / "agent_kanban.db"

# Get DATABASE_URL with protection
DATABASE_URL = get_db_url() or f"sqlite:///{DATABASE_PATH.absolute()}"

# Create engine with proper SQLite configuration
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {
        "check_same_thread": False,
        "isolation_level": None,  # Use autocommit mode for SQLite
    }

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    pool_pre_ping=True,  # Enable connection health checks
    pool_recycle=3600,  # Recycle connections after 1 hour
)

# Enable foreign key constraints for SQLite
if "sqlite" in DATABASE_URL:

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging for better concurrency
        cursor.execute("PRAGMA synchronous=NORMAL")  # Balance between safety and speed
        cursor.close()


def create_db_and_tables():
    """Create database tables only if they don't exist.

    CRITICAL: This function should NEVER drop existing tables.
    It only creates tables that don't already exist.
    """
    from app.core.safe_database import safe_init_database, verify_database_integrity

    # Log critical information
    logger.warning("🔴 CRITICAL: Database initialization called")
    logger.warning(f"🔴 CRITICAL: Database URL: {DATABASE_URL}")
    logger.warning(f"🔴 CRITICAL: Absolute path: {DATABASE_PATH.absolute()}")

    # Use safe initialization
    logger.warning("🔴 CRITICAL: Starting safe database initialization")
    init_result = safe_init_database(engine)

    # Log the results
    if init_result["database_existed"]:
        logger.warning(
            f"✅ Using existing database with {len(init_result['tables_existed'])} tables"
        )
        if init_result["tables_created"]:
            logger.warning(
                f"✅ Created {len(init_result['tables_created'])} missing tables: "
                f"{init_result['tables_created']}"
            )
    else:
        logger.warning(f"✅ Created new database with {len(init_result['tables_created'])} tables")

    # Verify integrity
    if not verify_database_integrity(engine):
        logger.error("❌ Database integrity check failed! Data may be corrupted.")
        # Don't raise exception - let the app continue but log the issue

    logger.warning("🔴 CRITICAL: Database initialization completed safely")


def get_session() -> Generator[Session, None, None]:
    with Session(engine, autoflush=False, expire_on_commit=False) as session:
        try:
            yield session
            session.commit()  # Ensure commit happens if no exception
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
