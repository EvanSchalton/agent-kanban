#!/bin/bash
# QA Quick Validation Script - Run after each batch of moves

echo "=== QA QUICK VALIDATION ==="
echo "Checking critical files..."

# Check critical files exist
CRITICAL_FILES=(
    "README.md"
    "CLAUDE.md"
    "package.json"
    "pyproject.toml"
    "agent_kanban.db"
    ".gitignore"
    ".mcp.json"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✗ CRITICAL: $file missing!"
        exit 1
    fi
done

echo ""
echo "Testing backend startup..."
cd backend
timeout 5 python -c "from app.main import app; print('✓ Backend imports OK')" 2>/dev/null || echo "✗ Backend import failed"
cd ..

echo ""
echo "Testing frontend build..."
cd frontend
npm run build --dry-run 2>/dev/null && echo "✓ Frontend config OK" || echo "✗ Frontend config failed"
cd ..

echo ""
echo "=== VALIDATION COMPLETE ==="
