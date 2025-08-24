#!/bin/bash

# Test Database Cleanup Script
# This script removes all test databases and related artifacts
# to ensure a clean testing environment

echo "========================================="
echo "Starting Test Database Cleanup"
echo "========================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Change to backend directory
cd "$BACKEND_DIR" || exit 1

echo "Working directory: $(pwd)"

# Remove test database directory
if [ -d "test_databases" ]; then
    echo "Removing test_databases/ directory..."
    rm -rf test_databases/
    echo "✓ test_databases/ directory removed"
else
    echo "- test_databases/ directory not found (already clean)"
fi

# Remove any stray test databases with various patterns
echo "Cleaning up stray test database files..."
TEST_DB_COUNT=0

# Pattern: test_*.db
for file in test_*.db; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "  ✓ Removed: $file"
        ((TEST_DB_COUNT++))
    fi
done

# Pattern: *.test.db
for file in *.test.db; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "  ✓ Removed: $file"
        ((TEST_DB_COUNT++))
    fi
done

# Pattern: test_*.db-shm (SQLite shared memory files)
for file in test_*.db-shm; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "  ✓ Removed: $file"
        ((TEST_DB_COUNT++))
    fi
done

# Pattern: test_*.db-wal (SQLite write-ahead log files)
for file in test_*.db-wal; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "  ✓ Removed: $file"
        ((TEST_DB_COUNT++))
    fi
done

if [ $TEST_DB_COUNT -eq 0 ]; then
    echo "- No stray test database files found"
else
    echo "✓ Removed $TEST_DB_COUNT test database file(s)"
fi

# Remove pytest cache
if [ -d ".pytest_cache" ]; then
    echo "Removing .pytest_cache/ directory..."
    rm -rf .pytest_cache/
    echo "✓ .pytest_cache/ directory removed"
else
    echo "- .pytest_cache/ directory not found (already clean)"
fi

# Remove __pycache__ directories in tests folder
if [ -d "tests" ]; then
    echo "Cleaning __pycache__ in tests/ directory..."
    find tests -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
    echo "✓ __pycache__ directories cleaned"
fi

# Check if production database is protected
if [ -f "agent_kanban.db" ]; then
    echo ""
    echo "Production database status:"
    echo "  ✓ agent_kanban.db exists (NOT modified by this script)"
    ls -lh agent_kanban.db | awk '{print "  Size: " $5 ", Modified: " $6 " " $7 " " $8}'
fi

echo ""
echo "========================================="
echo "Test Database Cleanup Complete!"
echo "========================================="
echo ""
echo "Summary:"
echo "  - Test databases: Cleaned"
echo "  - Pytest cache: Cleaned"
echo "  - Production DB: Protected"
echo ""
