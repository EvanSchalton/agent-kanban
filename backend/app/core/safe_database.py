"""
Safe database initialization module.
Ensures database is only created if it doesn't exist, preventing data loss.
CRITICAL: This module includes protection against accidental data deletion.
"""

import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel

logger = logging.getLogger(__name__)


class DatabaseProtectionError(Exception):
    """Raised when attempting dangerous database operations in production."""

    pass


def is_production_database(db_url: str) -> bool:
    """Check if this is a production database."""
    # Production indicators
    production_indicators = [
        "agent_kanban.db",  # Main production database
        "production",
        "prod.db",
    ]

    # Test/dev indicators (these are safe to modify)
    test_indicators = [
        ":memory:",
        "test",
        "tmp",
        "temp",
        ".test.",
        "_test.",
    ]

    # Check if it's clearly a test database
    for indicator in test_indicators:
        if indicator in db_url.lower():
            return False

    # Check if it's a production database
    for indicator in production_indicators:
        if indicator in db_url.lower():
            return True

    # Default to treating unknown databases as production (safer)
    return True


def backup_database(db_path: Path) -> Optional[str]:
    """Create a backup of the SQLite database."""
    if not db_path.exists():
        return None

    # Create backup directory
    backup_dir = db_path.parent / "backups"
    backup_dir.mkdir(exist_ok=True)

    # Generate backup filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"{db_path.stem}_backup_{timestamp}.db"

    try:
        shutil.copy2(db_path, backup_path)
        logger.warning(f"✅ Database backed up to: {backup_path}")

        # Keep only last 5 backups
        backup_files = sorted(backup_dir.glob("*_backup_*.db"), key=lambda x: x.stat().st_mtime)
        if len(backup_files) > 5:
            for old_backup in backup_files[:-5]:
                old_backup.unlink()
                logger.info(f"Removed old backup: {old_backup}")

        return str(backup_path)
    except Exception as e:
        logger.error(f"Failed to backup database: {e}")
        return None


def safe_init_database(engine, force_create: bool = False):
    """
    Safely initialize database, ensuring existing data is preserved.

    Args:
        engine: SQLAlchemy engine instance
        force_create: If True, forces table creation (dangerous in production!)

    Returns:
        dict: Information about the initialization process
    """
    result = {
        "database_existed": False,
        "tables_created": [],
        "tables_existed": [],
        "backup_path": None,
        "error": None,
    }

    try:
        # Get database URL from engine
        db_url = str(engine.url)
        logger.warning(f"🔴 SAFE DATABASE INIT: Checking database at {db_url}")

        # CRITICAL SAFETY CHECK: Prevent drop_all in production
        if force_create and is_production_database(db_url):
            raise DatabaseProtectionError(
                "CRITICAL: Attempted to force create tables in production database! "
                "This operation has been blocked to prevent data loss."
            )

        # Check if database exists (for SQLite)
        if "sqlite" in db_url:
            db_path = db_url.replace("sqlite:///", "")
            if db_path.startswith("./"):
                db_path = db_path[2:]

            db_path_obj = Path(db_path)
            db_exists = db_path_obj.exists()
            result["database_existed"] = db_exists

            if db_exists:
                logger.warning(f"✅ Database already exists at: {db_path}")

                # Create backup for production databases
                if is_production_database(db_url):
                    result["backup_path"] = backup_database(db_path_obj)

                # Check existing tables
                inspector = inspect(engine)
                existing_tables = set(inspector.get_table_names())
                result["tables_existed"] = list(existing_tables)

                # Get required tables from SQLModel metadata
                required_tables = set(SQLModel.metadata.tables.keys())

                # Find missing tables
                missing_tables = required_tables - existing_tables

                if missing_tables:
                    logger.warning(f"⚠️ Missing tables detected: {missing_tables}")
                    logger.warning("Creating only missing tables...")

                    # Create only missing tables
                    for table_name in missing_tables:
                        table = SQLModel.metadata.tables[table_name]
                        table.create(engine, checkfirst=True)
                        result["tables_created"].append(table_name)
                        logger.warning(f"✅ Created missing table: {table_name}")
                else:
                    logger.warning("✅ All required tables already exist. No changes made.")

                # Log row counts for critical tables
                with Session(engine) as session:
                    for table in ["boards", "tickets", "comments"]:
                        if table in existing_tables:
                            count_result = session.exec(
                                text(f"SELECT COUNT(*) FROM {table}")
                            ).first()
                            count = count_result[0] if count_result else 0
                            logger.warning(f"📊 Table '{table}' has {count} rows")

            else:
                logger.warning(f"📦 Database does not exist. Creating new database at: {db_path}")

                # Create all tables for new database
                SQLModel.metadata.create_all(engine)
                result["tables_created"] = list(SQLModel.metadata.tables.keys())
                logger.warning(f"✅ Created new database with tables: {result['tables_created']}")

        else:
            # For non-SQLite databases
            logger.warning("🔄 Non-SQLite database detected. Checking tables...")

            inspector = inspect(engine)
            existing_tables = set(inspector.get_table_names())
            result["tables_existed"] = list(existing_tables)
            result["database_existed"] = len(existing_tables) > 0

            # Create tables with checkfirst=True (only creates if doesn't exist)
            SQLModel.metadata.create_all(engine, checkfirst=True)

            # Check what was created
            new_tables = set(inspector.get_table_names())
            created = new_tables - existing_tables
            result["tables_created"] = list(created)

            if created:
                logger.warning(f"✅ Created new tables: {created}")
            else:
                logger.warning("✅ All tables already exist. No changes made.")

    except Exception as e:
        logger.error(f"❌ Database initialization error: {e}")
        result["error"] = str(e)
        raise

    return result


def verify_database_integrity(engine) -> bool:
    """
    Verify that the database has all required tables and basic integrity.

    Returns:
        bool: True if database is healthy, False otherwise
    """
    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

        # Check for critical tables
        required_tables = {"boards", "tickets", "comments", "history"}
        missing = required_tables - existing_tables

        if missing:
            logger.error(f"❌ Missing critical tables: {missing}")
            return False

        # Check if tables have data (basic check)
        with Session(engine) as session:
            for table in required_tables:
                try:
                    result = session.exec(text(f"SELECT COUNT(*) FROM {table}")).first()
                    count = result[0] if result else 0
                    logger.info(f"Table '{table}': {count} rows")
                except Exception as e:
                    logger.error(f"Error checking table '{table}': {e}")
                    return False

        logger.info("✅ Database integrity check passed")
        return True

    except Exception as e:
        logger.error(f"❌ Database integrity check failed: {e}")
        return False
