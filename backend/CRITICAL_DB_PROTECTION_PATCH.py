#!/usr/bin/env python3
"""
CRITICAL DATABASE PROTECTION PATCH v2.1.28
Immediately prevents any further production DB pollution from tests.
"""

import logging
import os
import sys

# Set up logging
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


def apply_critical_protection():
    """Apply immediate database protection to prevent test contamination."""

    print("🚨 APPLYING CRITICAL DATABASE PROTECTION PATCH v2.1.28")

    # 1. Force TESTING environment for ALL test scripts
    test_indicators = ["test_", "tests/", "pytest", "conftest.py"]

    current_script = sys.argv[0] if sys.argv else ""
    is_test_context = any(indicator in current_script.lower() for indicator in test_indicators)

    if is_test_context:
        os.environ["TESTING"] = "true"
        print(f"✅ TESTING environment forced for: {current_script}")

    # 2. Override database path for test contexts
    if os.getenv("TESTING") == "true":
        # Force test database URL
        test_db_path = f"sqlite:///test_isolated_{os.getpid()}.db"
        os.environ["DATABASE_URL"] = test_db_path
        print(f"✅ Test database isolated: {test_db_path}")

    # 3. Install runtime protection
    protect_production_database()

    print("🛡️ CRITICAL DATABASE PROTECTION ACTIVE")


def protect_production_database():
    """Install runtime protection against production DB access during tests."""

    # Monitor for direct sqlite3 connections to production DB
    import sqlite3

    original_connect = sqlite3.connect

    def protected_connect(database, *args, **kwargs):
        # Check if trying to connect to production DB during tests
        if os.getenv("TESTING") == "true":
            db_path = str(database)
            if "agent_kanban.db" in db_path and ":memory:" not in db_path:
                error_msg = (
                    f"🚨 BLOCKED: Test attempted to connect to production database!\n"
                    f"Database: {db_path}\n"
                    f"Script: {sys.argv[0] if sys.argv else 'unknown'}\n"
                    f"This connection has been BLOCKED to prevent data contamination."
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)

        return original_connect(database, *args, **kwargs)

    # Install the protection
    sqlite3.connect = protected_connect
    print("✅ Runtime production DB protection installed")


def force_test_isolation_for_mcp():
    """Force test isolation for MCP scripts that bypass pytest."""

    # Check if this is an MCP-related script
    if any(indicator in " ".join(sys.argv) for indicator in ["mcp", "MCP", "test_mcp"]):
        print("🔧 MCP test context detected - forcing isolation")

        # Force test environment
        os.environ["TESTING"] = "true"
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"

        # Override MCP database access
        try:
            from app.core import database

            if hasattr(database, "get_session"):
                print("✅ MCP database access will be isolated")
        except ImportError:
            pass


# Auto-apply protection when imported
if __name__ == "__main__":
    apply_critical_protection()
else:
    # Apply protection when imported
    force_test_isolation_for_mcp()
    apply_critical_protection()

print("🛡️ CRITICAL DATABASE PROTECTION PATCH LOADED - Production DB is now protected")
