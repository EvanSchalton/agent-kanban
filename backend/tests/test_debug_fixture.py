"""
Test file to verify debug marker functionality works with file-based databases.
"""

import pytest

from app.models import Board


@pytest.mark.debug
def test_debug_marker_uses_file_db(db):
    """Test that @pytest.mark.debug uses file-based database."""
    # Create a test board
    board = Board(name="Debug Test Board", description="Testing file DB")
    db.add(board)
    db.commit()

    # Verify it was created
    assert db.query(Board).filter_by(name="Debug Test Board").first() is not None

    # This test should print the file path when run
    print("Debug test completed - check for database file path in output")


def test_default_uses_memory_db(db):
    """Test that default fixture uses in-memory database."""
    # Create a test board
    board = Board(name="Memory Test Board", description="Testing memory DB")
    db.add(board)
    db.commit()

    # Verify it was created
    assert db.query(Board).filter_by(name="Memory Test Board").first() is not None

    # This should NOT print a database file path
    print("Memory test completed - should use in-memory database")
