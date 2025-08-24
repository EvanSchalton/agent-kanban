# Pre-Commit Workflow Validation Checklist

## Quick Validation Script
```bash
#!/bin/bash
# quick-validate-invoke.sh

echo "=== PRE-COMMIT WORKFLOW VALIDATION ==="
echo ""

# Check invoke availability
echo "[ ] Checking invoke installation..."
if command -v invoke &> /dev/null; then
    echo "    ✅ invoke found: $(invoke --version)"
else
    echo "    ❌ invoke NOT found - run: pip install invoke"
    exit 1
fi

# Check for tasks.py
echo "[ ] Checking for tasks.py..."
if [ -f "tasks.py" ]; then
    echo "    ✅ tasks.py exists"
else
    echo "    ❌ tasks.py NOT found in current directory"
    exit 1
fi

# List available commands
echo "[ ] Available invoke commands:"
invoke --list 2>/dev/null || echo "    ❌ Could not list commands"

echo ""
echo "=== INDIVIDUAL COMMAND TESTS ==="

# Test each command availability
for cmd in install format lint type-check security test check pre-commit; do
    echo -n "[ ] Testing 'invoke $cmd --help'... "
    if invoke $cmd --help &> /dev/null; then
        echo "✅"
    else
        echo "❌ (not available)"
    fi
done

echo ""
echo "=== VALIDATION COMPLETE ==="
```

## Phase-by-Phase Validation

### Phase 1: Assessment and Analysis ✓
- [ ] Git status check works
- [ ] Pre-commit installed (`pre-commit --version`)
- [ ] Can run `pre-commit run --all-files`
- [ ] Issue categorization documented
- [ ] Initial issue count captured

### Phase 2: Systematic Resolution ✓
- [ ] Parse errors identified (if any)
- [ ] `invoke lint --fix` executes
- [ ] `invoke format` executes
- [ ] Automated fixes applied correctly
- [ ] Manual fixes documented

### Phase 3: Test Organization ✓
- [ ] Test directory structure correct
- [ ] Test discovery works (`pytest --collect-only`)
- [ ] Deprecated methods updated
- [ ] Imports match new structure

### Phase 4: Validation and Commit ✓
- [ ] All pre-commit hooks pass
- [ ] Git diff shows expected changes
- [ ] Commit message follows format
- [ ] No uncommitted changes remain

### Phase 5: Push and Verify ✓
- [ ] Changes pushed to repository
- [ ] CI/CD pipeline triggered
- [ ] Version bump detected (if applicable)
- [ ] All checks green

## Command-Specific Test Cases

### invoke install
```bash
# Test Case 1: Fresh Install
rm -rf .venv/  # Remove virtual env
invoke install
# Verify: .venv created, dependencies installed

# Test Case 2: Update Dependencies
invoke install --update
# Verify: Dependencies updated to latest compatible versions

# Test Case 3: Pre-commit Hook Installation
invoke install
pre-commit install
# Verify: .git/hooks/pre-commit exists
```

### invoke format
```bash
# Test Case 1: Format Single File
echo "x=1+2" > test.py
invoke format
# Verify: File reformatted to "x = 1 + 2"

# Test Case 2: Format All Files
invoke format --all
# Verify: All .py files formatted

# Test Case 3: Check Only (No Changes)
invoke format --check
# Verify: Reports files that need formatting, no changes made
```

### invoke lint
```bash
# Test Case 1: Detect Issues
echo "import os, sys" > test.py  # Multiple imports on one line
invoke lint
# Verify: Linting issue reported

# Test Case 2: Auto-fix Issues
invoke lint --fix
# Verify: Auto-fixable issues resolved

# Test Case 3: Unsafe Fixes
invoke lint --fix --unsafe
# Verify: More aggressive fixes applied (with caution)
```

### invoke type-check
```bash
# Test Case 1: Type Errors
cat > test.py << 'EOF'
def add(a: int, b: int) -> int:
    return a + b
result: str = add(1, 2)  # Type mismatch
EOF
invoke type-check
# Verify: Type error reported

# Test Case 2: Missing Type Hints
invoke type-check --strict
# Verify: Reports missing type annotations
```

### invoke security
```bash
# Test Case 1: Security Issues
cat > test.py << 'EOF'
import subprocess
cmd = input()
subprocess.call(cmd, shell=True)  # Security risk
EOF
invoke security
# Verify: Bandit reports security issue

# Test Case 2: Exclude Test Files
invoke security --skip-tests
# Verify: Test files not scanned
```

### invoke test
```bash
# Test Case 1: Run All Tests
invoke test
# Verify: All tests discovered and run

# Test Case 2: Run Specific Test
invoke test -k test_specific
# Verify: Only matching tests run

# Test Case 3: With Coverage
invoke test --coverage
# Verify: Coverage report generated
```

### invoke check
```bash
# Test Case 1: Full Check Suite
invoke check
# Verify: Runs format, lint, type-check, security, test in order

# Test Case 2: Fail Fast
invoke check --fail-fast
# Verify: Stops on first failure

# Test Case 3: Skip Tests
invoke check --skip-tests
# Verify: All checks except tests
```

### invoke pre-commit
```bash
# Test Case 1: All Files
invoke pre-commit
# Verify: Equivalent to 'pre-commit run --all-files'

# Test Case 2: Staged Files Only
git add test.py
invoke pre-commit --staged
# Verify: Only checks staged files

# Test Case 3: Specific Hook
invoke pre-commit --hook ruff
# Verify: Only runs specified hook
```

## Error Scenario Validation

### Scenario 1: Missing Dependencies
```bash
# Temporarily break dependency
pip uninstall ruff -y
invoke lint
# Expected: Clear error message about missing ruff
# Recovery: invoke install
```

### Scenario 2: Syntax Errors
```bash
# Create file with syntax error
echo "def broken(" > bad.py
invoke format
# Expected: Reports parse error, continues with other files
```

### Scenario 3: Configuration Issues
```bash
# Corrupt config file
echo "invalid: [yaml" > .pre-commit-config.yaml
invoke pre-commit
# Expected: Clear error about invalid configuration
```

## Integration Test Scenarios

### Scenario 1: New Developer Setup
```bash
# Clone fresh repo
git clone <repo>
cd <repo>
invoke install
invoke check
# Verify: Everything works out of the box
```

### Scenario 2: Pre-Commit Hook Flow
```bash
# Make changes with issues
echo "x=1+2" > test.py
git add test.py
git commit -m "test"
# Verify: Pre-commit blocks commit, shows issues
invoke format
git add test.py
git commit -m "test"
# Verify: Commit succeeds after fix
```

### Scenario 3: CI/CD Simulation
```bash
# Simulate CI locally
invoke ci
# Verify: All CI checks run locally
# Compare with actual CI results
```

## Performance Benchmarks

### Baseline Metrics
- invoke format: < 5 seconds for 100 files
- invoke lint: < 10 seconds for 100 files
- invoke test: < 30 seconds for standard test suite
- invoke check: < 1 minute for full check

### Large Codebase Test
```bash
# Time each command on full codebase
time invoke format --all
time invoke lint
time invoke test
time invoke check
```

## Final Sign-off Criteria

### Functionality ✓
- [ ] All 8 invoke commands work
- [ ] Help text accurate
- [ ] Error handling robust
- [ ] Exit codes correct

### Integration ✓
- [ ] Git hooks integrate properly
- [ ] CI/CD alignment verified
- [ ] Version bumping works
- [ ] Team workflow documented

### Documentation ✓
- [ ] README updated
- [ ] Command help strings clear
- [ ] Examples provided
- [ ] Troubleshooting guide available

### Performance ✓
- [ ] Acceptable execution times
- [ ] No memory leaks
- [ ] Handles large codebases
- [ ] Parallel execution works

## QA Sign-off
```
Date: ____________
Tested By: QA Engineer
Version: ____________

[ ] All test scenarios executed
[ ] All validation checklists complete
[ ] No blocking issues found
[ ] Documentation accurate
[ ] Ready for team use

Notes:
_________________________________
_________________________________
_________________________________

Signature: ______________________
```
