"""
Test database isolation fixtures to ensure production DB is protected.

This test suite verifies:
1. Production database is never accessed
2. Each test gets an isolated database
3. In-memory databases work for speed
4. File-based databases work for debugging
5. Cleanup happens automatically
"""

import os
from pathlib import Path

import pytest
from sqlmodel import select

# Import models to test with
from backend.app.models import Board, Ticket


class TestDatabaseIsolation:
    """Test suite for database isolation features."""

    def test_memory_db_fixture(self, memory_db):
        """Test that in-memory database fixture works."""
        # Create a test board
        board = Board(name="Test Board", description="In-memory test")
        memory_db.add(board)
        memory_db.commit()

        # Verify it was created
        result = memory_db.exec(select(Board)).first()
        assert result is not None
        assert result.name == "Test Board"

        # Verify this is in-memory (no file path)
        db_url = str(memory_db.bind.url)
        assert ":memory:" in db_url or "mode=memory" in db_url

    def test_file_db_fixture(self, file_db):
        """Test that file-based database fixture works."""
        # Create a test ticket
        ticket = Ticket(
            title="Test Ticket",
            description="File-based test",
            board_id=1,
            column="To Do",
            position=0,
        )
        file_db.add(ticket)
        file_db.commit()

        # Verify it was created
        result = file_db.exec(select(Ticket)).first()
        assert result is not None
        assert result.title == "Test Ticket"

        # Verify this is file-based
        db_url = str(file_db.bind.url)
        assert "test_" in db_url
        assert ".db" in db_url

    def test_smart_db_fixture_default(self, db):
        """Test that smart db fixture defaults to in-memory."""
        # Should use in-memory by default
        board = Board(name="Default Test", description="Should be in-memory")
        db.add(board)
        db.commit()

        # Check it's in-memory
        db_url = str(db.bind.url)
        assert ":memory:" in db_url or "mode=memory" in db_url

    @pytest.mark.debug
    def test_smart_db_fixture_debug(self, db):
        """Test that smart db fixture uses file when marked with debug."""
        # Should use file-based when marked with @pytest.mark.debug
        board = Board(name="Debug Test", description="Should be file-based")
        db.add(board)
        db.commit()

        # Check it's file-based
        db_url = str(db.bind.url)
        assert "test_" in db_url
        assert ".db" in db_url

    def test_isolation_between_tests_1(self, db):
        """First test to verify isolation - creates data."""
        # Create some data
        board = Board(name="Isolation Test 1", description="First test")
        db.add(board)
        db.commit()

        # Verify it exists
        count = db.exec(select(Board)).all()
        assert len(count) == 1

    def test_isolation_between_tests_2(self, db):
        """Second test to verify isolation - should not see first test's data."""
        # Should not see data from previous test
        count = db.exec(select(Board)).all()
        assert len(count) == 0

        # Create different data
        board = Board(name="Isolation Test 2", description="Second test")
        db.add(board)
        db.commit()

        # Verify only our data exists
        boards = db.exec(select(Board)).all()
        assert len(boards) == 1
        assert boards[0].name == "Isolation Test 2"

    def test_production_db_protected(self):
        """Test that production database is protected."""
        # Verify TESTING environment is set
        assert os.getenv("TESTING") == "true"

        # Verify DATABASE_URL doesn't point to production
        db_url = os.getenv("DATABASE_URL", "")
        if db_url:
            assert "agent_kanban.db" not in db_url or "test" in db_url

    def test_multiple_operations(self, db):
        """Test multiple database operations in one test."""
        # Create multiple items
        for i in range(5):
            board = Board(name=f"Board {i}", description=f"Test board {i}")
            db.add(board)
        db.commit()

        # Verify all were created
        boards = db.exec(select(Board)).all()
        assert len(boards) == 5

        # Update one
        board = boards[0]
        board.description = "Updated description"
        db.commit()

        # Delete one
        db.delete(boards[-1])
        db.commit()

        # Verify final state
        final_boards = db.exec(select(Board)).all()
        assert len(final_boards) == 4
        assert final_boards[0].description == "Updated description"

    @pytest.mark.file_db
    def test_explicit_file_db_marker(self, db):
        """Test explicit file_db marker forces file-based database."""
        # Should use file-based when marked with @pytest.mark.file_db
        ticket = Ticket(
            title="File DB Test",
            description="Explicit file database",
            board_id=1,
            column="Testing",
            position=0,
        )
        db.add(ticket)
        db.commit()

        # Check it's file-based
        db_url = str(db.bind.url)
        assert "test_" in db_url
        assert ".db" in db_url

        # Verify the file actually exists
        # Extract path from URL
        import re

        match = re.search(r"sqlite:///(.+)", db_url)
        if match:
            db_path = Path(match.group(1))
            assert db_path.exists()
            assert db_path.stat().st_size > 0  # File has content


class TestCleanup:
    """Test automatic cleanup functionality."""

    def test_test_db_directory_exists(self):
        """Test that test database directory is created."""
        test_db_dir = Path(__file__).parent.parent / "test_databases"
        assert test_db_dir.exists()
        assert test_db_dir.is_dir()

    @pytest.mark.debug
    def test_file_db_creates_file(self, db):
        """Test that file databases are actually created."""
        # Create some data to ensure file is written
        board = Board(name="File Test", description="Testing file creation")
        db.add(board)
        db.commit()

        # Get the database file path
        db_url = str(db.bind.url)
        import re

        match = re.search(r"sqlite:///(.+)", db_url)
        assert match is not None

        db_path = Path(match.group(1))
        assert db_path.exists()
        assert "test_" in db_path.name
        assert db_path.suffix == ".db"
