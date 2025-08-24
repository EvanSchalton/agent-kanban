#!/usr/bin/env python3
"""
CRITICAL DATABASE MIGRATION SCRIPT
Merges data from backend/agent_kanban.db into the root agent_kanban.db
"""

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


def migrate_databases():
    """Migrate data from backend database to root database."""

    backend_db = Path("/workspaces/agent-kanban/backend/agent_kanban.db")
    root_db = Path("/workspaces/agent-kanban/agent_kanban.db")

    print("\n" + "=" * 60)
    print("CRITICAL DATABASE MIGRATION")
    print("=" * 60)

    # Check both databases exist
    if not backend_db.exists():
        print("❌ Backend database not found!")
        return False

    if not root_db.exists():
        print("❌ Root database not found!")
        return False

    # Get counts from both databases
    backend_conn = sqlite3.connect(backend_db)
    root_conn = sqlite3.connect(root_db)

    backend_cursor = backend_conn.cursor()
    root_cursor = root_conn.cursor()

    # Get ticket counts
    backend_cursor.execute("SELECT COUNT(*) FROM tickets")
    backend_tickets = backend_cursor.fetchone()[0]

    root_cursor.execute("SELECT COUNT(*) FROM tickets")
    root_tickets = root_cursor.fetchone()[0]

    print("\nCurrent state:")
    print(f"  Backend DB: {backend_tickets} tickets at {backend_db}")
    print(f"  Root DB: {root_tickets} tickets at {root_db}")

    if backend_tickets > root_tickets:
        print(f"\n⚠️  Backend database has MORE data ({backend_tickets} vs {root_tickets})")
        print("🔄 Migrating data from backend to root...")

        # Backup the root database first
        backup_path = root_db.with_suffix(f".backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}.db")
        shutil.copy(root_db, backup_path)
        print(f"✅ Created backup at: {backup_path}")

        # Close connections
        backend_conn.close()
        root_conn.close()

        # Replace root with backend database
        shutil.copy(backend_db, root_db)
        print("✅ Migrated backend database to root")

        # Verify
        new_conn = sqlite3.connect(root_db)
        cursor = new_conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM tickets")
        final_count = cursor.fetchone()[0]
        new_conn.close()

        print(f"✅ Migration complete! Root database now has {final_count} tickets")

        # Optional: Remove backend database to prevent confusion
        print(f"\n⚠️  Backend database still exists at: {backend_db}")
        print("   You may want to remove it to prevent confusion")

        return True
    else:
        print("\n✅ Root database already has equal or more data")
        print("   No migration needed")
        return False


if __name__ == "__main__":
    try:
        migrate_databases()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
