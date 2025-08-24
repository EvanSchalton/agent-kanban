#!/usr/bin/env python3
"""
Data Persistence Validation Script
Tests that data persists across server restarts and identifies data loss issues.
"""

import os
import sqlite3
import subprocess
import sys
import time
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))


def check_database_contents(db_path):
    """Check and return database contents."""
    if not os.path.exists(db_path):
        return None, "Database file does not exist"

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Get counts
        cursor.execute("SELECT COUNT(*) FROM boards")
        boards = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM tickets")
        tickets = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM comments")
        comments = cursor.fetchone()[0]

        # Get a sample board if exists
        sample_board = None
        if boards > 0:
            cursor.execute("SELECT id, name FROM boards WHERE name NOT LIKE '%Test Board%' LIMIT 1")
            result = cursor.fetchone()
            if result:
                sample_board = {"id": result[0], "name": result[1]}

        conn.close()

        return {
            "boards": boards,
            "tickets": tickets,
            "comments": comments,
            "sample_board": sample_board,
        }, None

    except Exception as e:
        conn.close()
        return None, str(e)


def create_test_data(db_path):
    """Create test data directly in database."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Create a test board
        timestamp = datetime.utcnow().isoformat()
        test_id = int(time.time() * 1000) % 1000000

        cursor.execute(
            """
            INSERT INTO boards (name, description, columns, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """,
            (
                f"Persistence Test Board {test_id}",
                "Board created to test data persistence",
                '["To Do", "In Progress", "Done"]',
                timestamp,
                timestamp,
            ),
        )

        board_id = cursor.lastrowid

        # Create test tickets
        for i in range(3):
            cursor.execute(
                """
                INSERT INTO tickets (title, description, board_id, current_column, priority,
                                   created_at, updated_at, column_entered_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    f"Test Ticket {i + 1}",
                    f"This is test ticket {i + 1} for persistence validation",
                    board_id,
                    "To Do",
                    f"{i + 1}.0",
                    timestamp,
                    timestamp,
                    timestamp,
                ),
            )

        conn.commit()
        conn.close()

        return board_id, test_id

    except Exception as e:
        conn.close()
        raise e


def main():
    """Main validation process."""
    print("=" * 60)
    print("DATA PERSISTENCE VALIDATION")
    print("=" * 60)

    db_path = "agent_kanban.db"

    # Step 1: Check initial state
    print("\n1. Checking initial database state...")
    initial_data, error = check_database_contents(db_path)

    if error:
        print(f"   ❌ Error: {error}")
        return 1

    print("   📊 Current data:")
    print(f"      - Boards: {initial_data['boards']}")
    print(f"      - Tickets: {initial_data['tickets']}")
    print(f"      - Comments: {initial_data['comments']}")

    # Step 2: Create test data
    print("\n2. Creating test data...")
    try:
        board_id, test_id = create_test_data(db_path)
        print(f"   ✅ Created test board ID {board_id} with identifier {test_id}")
    except Exception as e:
        print(f"   ❌ Failed to create test data: {e}")
        return 1

    # Step 3: Verify data was created
    print("\n3. Verifying test data...")
    after_create, error = check_database_contents(db_path)

    if error:
        print(f"   ❌ Error: {error}")
        return 1

    if after_create["boards"] <= initial_data["boards"]:
        print("   ❌ Board count did not increase!")
        return 1

    print("   ✅ Data created successfully")
    print(f"      - Boards: {initial_data['boards']} -> {after_create['boards']}")
    print(f"      - Tickets: {initial_data['tickets']} -> {after_create['tickets']}")

    # Step 4: Start the server
    print("\n4. Starting backend server...")
    print("   ⏳ Starting server with uvicorn...")

    process = subprocess.Popen(
        ["python", "-m", "uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8001"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    # Wait for server to start
    time.sleep(5)

    # Step 5: Check if data still exists
    print("\n5. Checking data after server start...")
    after_start, error = check_database_contents(db_path)

    if error:
        print(f"   ❌ Error: {error}")
        process.terminate()
        return 1

    if after_start["boards"] < after_create["boards"]:
        print("   ❌ DATA LOSS DETECTED!")
        print(f"      Boards before: {after_create['boards']}")
        print(f"      Boards after: {after_start['boards']}")
        print(f"      Lost boards: {after_create['boards'] - after_start['boards']}")
        process.terminate()
        return 1

    print("   ✅ Data persisted successfully!")
    print(f"      - Boards: {after_start['boards']}")
    print(f"      - Tickets: {after_start['tickets']}")

    # Step 6: Stop and restart server
    print("\n6. Restarting server...")
    process.terminate()
    time.sleep(2)

    process = subprocess.Popen(
        ["python", "-m", "uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8001"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    time.sleep(5)

    # Step 7: Final check
    print("\n7. Final data check after restart...")
    final_data, error = check_database_contents(db_path)

    process.terminate()

    if error:
        print(f"   ❌ Error: {error}")
        return 1

    if final_data["boards"] < after_create["boards"]:
        print("   ❌ DATA LOSS AFTER RESTART!")
        print(f"      Expected boards: {after_create['boards']}")
        print(f"      Actual boards: {final_data['boards']}")
        return 1

    print("   ✅ All data persisted across restarts!")
    print(f"      - Boards: {final_data['boards']}")
    print(f"      - Tickets: {final_data['tickets']}")
    print(f"      - Comments: {final_data['comments']}")

    print("\n" + "=" * 60)
    print("✅ VALIDATION PASSED: Data persists correctly")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(main())
