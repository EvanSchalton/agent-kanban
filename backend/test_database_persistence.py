#!/usr/bin/env python3
"""
CRITICAL DATABASE PERSISTENCE TEST
This script tests if the database is being recreated on startup.
"""

import sqlite3
import time
from pathlib import Path


def check_database_state(db_path):
    """Check the current state of the database."""
    if not Path(db_path).exists():
        return {"exists": False, "tables": [], "ticket_count": 0}

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get list of tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]

    # Count tickets if table exists
    ticket_count = 0
    if "tickets" in tables:
        cursor.execute("SELECT COUNT(*) FROM tickets;")
        ticket_count = cursor.fetchone()[0]

    conn.close()

    return {"exists": True, "tables": tables, "ticket_count": ticket_count}


def main():
    print("\n" + "=" * 60)
    print("CRITICAL DATABASE PERSISTENCE TEST")
    print("=" * 60)

    db_path = "./agent_kanban.db"

    # Step 1: Check initial database state
    print("\n1. Initial database state:")
    initial_state = check_database_state(db_path)
    print(f"   Database exists: {initial_state['exists']}")
    print(f"   Tables: {initial_state['tables']}")
    print(f"   Ticket count: {initial_state['ticket_count']}")

    # Step 2: Create a test ticket via API
    print("\n2. Creating test ticket...")
    import requests

    # First create a board if needed
    try:
        boards_response = requests.get("http://localhost:18000/api/boards/")
        boards = boards_response.json()

        if not boards:
            print("   Creating test board...")
            board_response = requests.post(
                "http://localhost:18000/api/boards/",
                json={
                    "name": "Persistence Test Board",
                    "description": "Testing database persistence",
                },
            )
            board = board_response.json()
            board_id = board["id"]
        else:
            board_id = boards[0]["id"]

        # Create a test ticket
        ticket_response = requests.post(
            "http://localhost:18000/api/tickets/",
            json={
                "board_id": board_id,
                "title": f"CRITICAL TEST TICKET - {time.time()}",
                "description": "This ticket should persist after server restart",
                "column": "TODO",
                "priority": 1,
            },
        )

        if ticket_response.status_code == 200:
            ticket = ticket_response.json()
            print(f"   ✅ Created ticket #{ticket['id']}: {ticket['title']}")
            test_ticket_id = ticket["id"]
        else:
            print(f"   ❌ Failed to create ticket: {ticket_response.text}")
            return

    except Exception as e:
        print(f"   ❌ Error creating ticket: {e}")
        print("   Make sure the server is running on port 18000")
        return

    # Step 3: Check database state after creation
    print("\n3. Database state after creating ticket:")
    after_create = check_database_state(db_path)
    print(f"   Ticket count: {after_create['ticket_count']}")

    # Step 4: Restart the server
    print("\n4. Restarting server to test persistence...")
    print("   🔴 Stopping server (you may need to manually restart)...")
    print("   Please restart the server manually and press Enter to continue...")
    input()

    # Give server time to start
    print("   Waiting for server to initialize...")
    time.sleep(3)

    # Step 5: Check if ticket still exists
    print("\n5. Checking if ticket persists after restart...")
    try:
        ticket_check = requests.get(f"http://localhost:18000/api/tickets/{test_ticket_id}")

        if ticket_check.status_code == 200:
            persisted_ticket = ticket_check.json()
            print(f"   ✅ TICKET PERSISTED! Found ticket #{persisted_ticket['id']}")
            print(f"      Title: {persisted_ticket['title']}")
        else:
            print(f"   ❌ CRITICAL: Ticket #{test_ticket_id} NOT FOUND after restart!")
            print(f"      Response: {ticket_check.status_code} - {ticket_check.text}")

    except Exception as e:
        print(f"   ❌ Error checking ticket: {e}")

    # Step 6: Final database state
    print("\n6. Final database state:")
    final_state = check_database_state(db_path)
    print(f"   Database exists: {final_state['exists']}")
    print(f"   Tables: {final_state['tables']}")
    print(f"   Ticket count: {final_state['ticket_count']}")

    # Summary
    print("\n" + "=" * 60)
    if initial_state["ticket_count"] <= final_state["ticket_count"]:
        print("✅ DATABASE PERSISTENCE TEST PASSED")
        print("   Tickets are being preserved across restarts")
    else:
        print("❌ CRITICAL: DATABASE PERSISTENCE TEST FAILED!")
        print("   Tickets are being lost on restart!")
        print(f"   Initial tickets: {initial_state['ticket_count']}")
        print(f"   Final tickets: {final_state['ticket_count']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
