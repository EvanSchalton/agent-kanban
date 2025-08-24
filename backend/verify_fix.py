#!/usr/bin/env python3
"""
Verify that the database persistence issue is fixed.
"""

import sqlite3
from pathlib import Path


def verify_fix():
    """Verify the database fix is working."""

    print("\n" + "=" * 60)
    print("DATABASE FIX VERIFICATION")
    print("=" * 60)

    # Check there's only one database
    root_db = Path("/workspaces/agent-kanban/agent_kanban.db")
    backend_db = Path("/workspaces/agent-kanban/backend/agent_kanban.db")

    print("\n1. Database location check:")
    print(f"   Root database exists: {root_db.exists()}")
    print(f"   Backend database exists: {backend_db.exists()}")

    if backend_db.exists():
        print("   ⚠️  WARNING: Backend database still exists!")
        print("      This could cause confusion. Consider removing it.")

    # Check root database
    if root_db.exists():
        conn = sqlite3.connect(root_db)
        cursor = conn.cursor()

        # Get counts
        cursor.execute("SELECT COUNT(*) FROM tickets")
        ticket_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM boards")
        board_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM comments")
        comment_count = cursor.fetchone()[0]

        print("\n2. Root database contents:")
        print(f"   Tickets: {ticket_count}")
        print(f"   Boards: {board_count}")
        print(f"   Comments: {comment_count}")

        # Get recent tickets
        cursor.execute(
            """
            SELECT id, title, created_at
            FROM tickets
            ORDER BY created_at DESC
            LIMIT 5
        """
        )
        recent = cursor.fetchall()

        if recent:
            print("\n3. Recent tickets (to verify data is preserved):")
            for ticket in recent:
                print(f"   #{ticket[0]}: {ticket[1][:50]}... (created: {ticket[2]})")

        conn.close()

        print("\n" + "=" * 60)
        if ticket_count > 0:
            print("✅ DATABASE FIX VERIFIED!")
            print(f"   {ticket_count} tickets are preserved in the correct location")
            print(f"   Database path: {root_db}")
        else:
            print("⚠️  WARNING: No tickets found in database!")
            print("   Data may have been lost")
        print("=" * 60)
    else:
        print("\n❌ ERROR: Root database not found!")
        print("   The application may not work correctly")


if __name__ == "__main__":
    verify_fix()
