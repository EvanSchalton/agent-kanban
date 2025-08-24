#!/bin/bash

# Database Monitoring Script
# This script monitors the database to prevent data loss

DB_PATH="/workspaces/agent-kanban/agent_kanban.db"
BACKUP_DIR="/workspaces/agent-kanban/database_backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to check database integrity
check_database() {
    echo "=== Database Integrity Check ==="
    echo "Database path: $DB_PATH"

    if [ ! -f "$DB_PATH" ]; then
        echo "❌ CRITICAL: Database file does not exist!"
        return 1
    fi

    # Check file size
    SIZE=$(stat -c%s "$DB_PATH")
    echo "Database size: $SIZE bytes"

    if [ "$SIZE" -lt 1000 ]; then
        echo "⚠️ WARNING: Database file seems too small!"
    fi

    # Check tables
    echo "Tables in database:"
    sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table';"

    # Check ticket count
    TICKET_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tickets;" 2>/dev/null || echo "0")
    echo "Number of tickets: $TICKET_COUNT"

    # Check last modification time
    echo "Last modified: $(stat -c %y "$DB_PATH")"

    return 0
}

# Function to create backup
create_backup() {
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/agent_kanban_${TIMESTAMP}.db"

    cp "$DB_PATH" "$BACKUP_FILE"
    echo "✅ Backup created: $BACKUP_FILE"

    # Keep only last 10 backups
    ls -t "$BACKUP_DIR"/*.db 2>/dev/null | tail -n +11 | xargs -r rm
}

# Function to monitor for duplicates
check_for_duplicates() {
    echo "=== Checking for duplicate database files ==="

    find /workspaces/agent-kanban -name "agent_kanban.db" -type f 2>/dev/null | while read -r file; do
        if [ "$file" != "$DB_PATH" ]; then
            echo "⚠️ WARNING: Found duplicate database at: $file"
            echo "  Size: $(stat -c%s "$file") bytes"
            echo "  Modified: $(stat -c %y "$file")"
        fi
    done
}

# Main monitoring
echo "========================================="
echo "Database Monitoring Report"
echo "Time: $(date)"
echo "========================================="

check_database
if [ $? -eq 0 ]; then
    create_backup
fi

check_for_duplicates

echo "========================================="
echo "Monitoring complete"
echo "========================================="
