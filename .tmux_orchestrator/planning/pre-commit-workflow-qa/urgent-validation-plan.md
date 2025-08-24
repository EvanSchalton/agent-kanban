# URGENT QA Validation Plan - 757 Files

## Critical Issues to Validate

### Line Length Violations (E501)
**Files to Check:**
```bash
# backend/app/api/endpoints/bulk.py - lines 260, 301
# backend/app/api/endpoints/statistics.py - line 498
# backend/app/api/endpoints/websocket.py - line 21

# Quick validation after fix:
ruff check backend/app/api/endpoints/bulk.py
ruff check backend/app/api/endpoints/statistics.py
ruff check backend/app/api/endpoints/websocket.py
```

### Unused Variables (F841)
**Files to Check:**
```bash
# backend/app/api/endpoints/health.py - line 107
ruff check backend/app/api/endpoints/health.py
```

### Markdown Linting
**Check all markdown files:**
```bash
# Check documentation formatting
markdownlint **/*.md || true
```

## Rapid Validation Script
```bash
#!/bin/bash
# urgent-validate.sh

echo "=== URGENT PRE-COMMIT VALIDATION ==="
echo "Checking 757 staged files..."

# Count current issues
echo -n "Current issues: "
pre-commit run --all-files 2>&1 | grep -E "Failed|failed" | wc -l

# Check specific critical files
echo ""
echo "=== Critical Files Status ==="
for file in backend/app/api/endpoints/bulk.py \
            backend/app/api/endpoints/health.py \
            backend/app/api/endpoints/statistics.py \
            backend/app/api/endpoints/websocket.py; do
    echo -n "$file: "
    if ruff check "$file" &>/dev/null; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
        ruff check "$file" 2>&1 | grep -E "E501|F841" | head -2
    fi
done

# Overall status
echo ""
echo "=== OVERALL STATUS ==="
if pre-commit run --all-files &>/dev/null; then
    echo "✅ ALL CHECKS PASSING!"
else
    echo "❌ Issues remaining"
    echo "Run: pre-commit run --all-files --verbose"
fi
```

## Performance Monitoring (757 Files)
```bash
# Monitor fix progress
time ruff check --fix backend/
time ruff format backend/

# Batch validation
find backend -name "*.py" | xargs -P 4 ruff check
```

## Post-Fix Validation Checklist
- [ ] Line length issues resolved (E501)
- [ ] Unused variables removed (F841)
- [ ] Markdown properly formatted
- [ ] All 757 files passing pre-commit
- [ ] No new issues introduced
- [ ] Tests still passing
- [ ] Application still runs
