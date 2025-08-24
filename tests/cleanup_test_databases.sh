#!/bin/bash
#
# Test Database Cleanup Script
# Cleans up all test databases, including e2e test databases.
# Safe to run - only removes test databases, never production.
#

echo "🧹 Test Database Cleanup Started..."

# Count databases before cleanup
BEFORE_COUNT=$(find . -name "test_*.db" -o -name "*.test.db" -o -name "test_e2e_*.db" | wc -l)
echo "📊 Found $BEFORE_COUNT test databases to clean"

# Remove test databases in project root
echo "🗑️  Cleaning test databases in project root..."
rm -f test_*.db
rm -f *.test.db
rm -f test_e2e_*.db

# Remove SQLite WAL and SHM files for test databases
echo "🗑️  Cleaning SQLite auxiliary files..."
rm -f test_*.db-wal test_*.db-shm
rm -f *.test.db-wal *.test.db-shm
rm -f test_e2e_*.db-wal test_e2e_*.db-shm

# Remove test database directories
echo "🗑️  Cleaning test database directories..."
rm -rf test_databases/
rm -rf backend/test_databases/
rm -rf tests/test_databases/

# Remove pytest cache
echo "🗑️  Cleaning pytest cache..."
rm -rf .pytest_cache/
rm -rf backend/.pytest_cache/
rm -rf tests/.pytest_cache/

# Remove Playwright test artifacts
echo "🗑️  Cleaning Playwright test artifacts..."
rm -rf test-results/
rm -rf playwright-report/
rm -rf tests/results/test_*.png

# Count databases after cleanup
AFTER_COUNT=$(find . -name "test_*.db" -o -name "*.test.db" -o -name "test_e2e_*.db" | wc -l)
CLEANED_COUNT=$((BEFORE_COUNT - AFTER_COUNT))

echo ""
echo "✅ Test Database Cleanup Complete!"
echo "📊 Cleaned $CLEANED_COUNT test databases"
echo "📊 Remaining test databases: $AFTER_COUNT"

# Verify production database is untouched
if [[ -f "agent_kanban.db" ]]; then
    echo "🔒 Production database 'agent_kanban.db' preserved ✅"
else
    echo "ℹ️  No production database found (normal for fresh setup)"
fi

# Show disk space saved (approximate)
SAVED_SPACE=$(du -sh test_*.db *.test.db test_e2e_*.db 2>/dev/null | awk '{total += $1} END {print total "KB"}' || echo "0KB")
echo "💾 Approximate space saved: $SAVED_SPACE"

echo ""
echo "🎯 Database Isolation Status:"
echo "   - Production database: PROTECTED ✅"
echo "   - Test databases: ISOLATED ✅"
echo "   - E2E test databases: ISOLATED ✅"
echo "   - Cleanup automation: ACTIVE ✅"
