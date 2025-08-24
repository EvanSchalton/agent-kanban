#!/usr/bin/env python3
"""
E2E Test Server with Database Isolation
Runs the backend server with isolated test database for e2e tests.
"""

import logging
import os
import uuid
from pathlib import Path

import uvicorn

# Set test environment variables BEFORE importing app
os.environ["TESTING"] = "true"

# Generate unique test database for this test run
test_db_name = f"test_e2e_{uuid.uuid4().hex[:8]}.db"
test_db_path = Path(__file__).parent.parent / test_db_name
os.environ["DATABASE_URL"] = f"sqlite:///{test_db_path.absolute()}"

print("🧪 E2E Test Server Starting")
print(f"🗄️  Test Database: {test_db_path}")
print(f"🔒 TESTING Mode: {os.environ.get('TESTING')}")
print(f"🔗 Database URL: {os.environ.get('DATABASE_URL')}")

# Import app after environment setup
from app.main import app  # noqa: E402

if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(level=logging.INFO)

    print("🚀 Starting E2E test server on port 18000...")
    print("📊 Server will use isolated test database")
    print("⚠️  Database will be cleaned up after tests")

    try:
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=18000,
            log_level="info",
            reload=False,  # Disable reload for test stability
        )
    finally:
        # Cleanup test database after server stops
        try:
            if test_db_path.exists():
                test_db_path.unlink()
                print(f"🧹 Cleaned up test database: {test_db_path}")
        except Exception as e:
            print(f"⚠️  Could not cleanup test database: {e}")
