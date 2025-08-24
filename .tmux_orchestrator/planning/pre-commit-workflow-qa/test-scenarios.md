# Pre-Commit Workflow Test Scenarios

## Overview
Comprehensive test scenarios for validating all invoke commands and workflow phases.

## Test Environment Setup
```bash
# Prerequisites check
poetry --version  # Should be installed
invoke --version  # Should be available
pre-commit --version  # Should be installed
git status  # Should be in git repo
```

## Phase 1: Installation & Setup Tests

### Test 1.1: invoke install
**Objective**: Verify dependency installation
**Pre-conditions**: Clean virtual environment
**Test Steps**:
1. Run `invoke install`
2. Verify poetry dependencies installed
3. Check pre-commit hooks installed
4. Validate development tools available

**Expected Results**:
- All dependencies in pyproject.toml installed
- Pre-commit hooks configured in .git/hooks
- No installation errors

**Validation Commands**:
```bash
poetry show  # List installed packages
pre-commit --version
ls -la .git/hooks/pre-commit
```

## Phase 2: Individual Command Tests

### Test 2.1: invoke format
**Objective**: Verify code formatting works
**Pre-conditions**: Unformatted Python files exist
**Test Steps**:
1. Create test file with poor formatting:
```python
# test_format.py
def   poorly_formatted(  x,y,   z ):
    return    x+y   +z
```
2. Run `invoke format`
3. Check file is reformatted

**Expected Results**:
- File reformatted to PEP8 standards
- No syntax errors introduced
- Exit code 0

**Validation**:
```bash
diff test_format.py test_format_expected.py
ruff format --check test_format.py
```

### Test 2.2: invoke lint
**Objective**: Verify linting detects issues
**Pre-conditions**: Files with linting issues
**Test Steps**:
1. Create file with linting issues:
```python
# test_lint.py
import os
import sys  # unused import
def missing_docstring(x):
    unused_var = 10
    return x * 2
```
2. Run `invoke lint`
3. Verify issues detected
4. Run `invoke lint --fix`
5. Verify auto-fixable issues resolved

**Expected Results**:
- Linting issues reported
- --fix flag resolves auto-fixable issues
- Non-auto-fixable issues still reported

### Test 2.3: invoke type-check
**Objective**: Verify type checking works
**Pre-conditions**: Files with type hints
**Test Steps**:
1. Create file with type issues:
```python
# test_types.py
def add_numbers(a: int, b: int) -> int:
    return a + b

result: str = add_numbers(1, 2)  # Type error
```
2. Run `invoke type-check`
3. Verify type errors detected

**Expected Results**:
- Type errors reported with line numbers
- Clear error messages
- Exit code non-zero for errors

### Test 2.4: invoke security
**Objective**: Verify security scanning
**Pre-conditions**: Files with potential security issues
**Test Steps**:
1. Create file with security issues:
```python
# test_security.py
import os
import subprocess

password = "hardcoded_password"  # B105
subprocess.call(user_input)  # B602
eval(user_input)  # B307
```
2. Run `invoke security`
3. Verify security issues detected

**Expected Results**:
- Bandit reports security issues
- Issue severity levels shown
- Recommendations provided

### Test 2.5: invoke test
**Objective**: Verify test runner works
**Pre-conditions**: Test files exist
**Test Steps**:
1. Create simple test:
```python
# test_sample.py
def test_addition():
    assert 1 + 1 == 2

def test_failure():
    assert 1 + 1 == 3  # Will fail
```
2. Run `invoke test`
3. Verify test results

**Expected Results**:
- Tests discovered and run
- Pass/fail status shown
- Coverage report generated (if configured)

### Test 2.6: invoke check
**Objective**: Verify comprehensive checks
**Pre-conditions**: Mixed code quality issues
**Test Steps**:
1. Run `invoke check`
2. Verify all checks run in sequence:
   - Format check
   - Lint check
   - Type check (if enabled)
   - Security check
   - Tests

**Expected Results**:
- All checks run
- Clear status for each check
- Overall pass/fail status

### Test 2.7: invoke pre-commit
**Objective**: Verify pre-commit hook execution
**Pre-conditions**: Pre-commit configured
**Test Steps**:
1. Make changes to files
2. Stage changes: `git add .`
3. Run `invoke pre-commit`
4. Verify all hooks run

**Expected Results**:
- All configured hooks execute
- Issues reported per hook
- Exit code reflects overall status

## Phase 3: Workflow Integration Tests

### Test 3.1: Full Workflow Execution
**Objective**: Verify complete workflow from issues to clean
**Test Steps**:
1. Introduce various issues (format, lint, security)
2. Run workflow sequence:
   ```bash
   invoke check  # Identify issues
   invoke format  # Fix formatting
   invoke lint --fix  # Fix linting
   invoke check  # Verify fixes
   invoke pre-commit  # Final validation
   ```
3. Verify all issues resolved

**Expected Results**:
- Progressive issue resolution
- No regressions between steps
- Final state passes all checks

### Test 3.2: Git Integration
**Objective**: Verify git hooks work correctly
**Test Steps**:
1. Install pre-commit hooks: `pre-commit install`
2. Make changes with issues
3. Attempt commit: `git commit -m "test"`
4. Verify pre-commit blocks bad commits
5. Fix issues and retry commit

**Expected Results**:
- Bad commits blocked
- Clear error messages
- Fixed code commits successfully

### Test 3.3: CI/CD Simulation
**Objective**: Verify CI simulation locally
**Test Steps**:
1. Run `invoke ci` (if available)
2. Verify simulates full CI pipeline
3. Check all quality gates

**Expected Results**:
- Local CI matches remote CI
- All checks run
- Clear pass/fail status

## Phase 4: Error Handling Tests

### Test 4.1: Missing Dependencies
**Objective**: Verify graceful handling of missing tools
**Test Steps**:
1. Temporarily rename tool (e.g., ruff)
2. Run invoke commands
3. Verify error messages

**Expected Results**:
- Clear error about missing tool
- Suggestion to run `invoke install`
- Non-zero exit code

### Test 4.2: Syntax Errors
**Objective**: Verify handling of parse errors
**Test Steps**:
1. Create file with syntax error:
```python
def broken_function(
    # Missing closing parenthesis
```
2. Run invoke commands
3. Verify appropriate errors

**Expected Results**:
- Parse error detected early
- Clear error location
- Other files still processed

## Phase 5: Performance Tests

### Test 5.1: Large Codebase
**Objective**: Verify performance on many files
**Test Steps**:
1. Run on full project
2. Measure execution time
3. Check for timeouts

**Expected Results**:
- Completes within reasonable time
- No memory issues
- Progress indicators work

### Test 5.2: Parallel Execution
**Objective**: Verify parallel processing works
**Test Steps**:
1. Run tools that support parallel execution
2. Monitor CPU usage
3. Compare with sequential execution

**Expected Results**:
- Faster than sequential
- No race conditions
- Results consistent

## Validation Checklist

### Pre-Deployment Checklist
- [ ] All invoke commands executable
- [ ] Help text available (`invoke --help`)
- [ ] Error messages clear and actionable
- [ ] Exit codes appropriate (0 for success, non-zero for failure)
- [ ] Documentation matches actual behavior

### Command-Specific Validation

#### invoke install
- [ ] Installs all dependencies
- [ ] Sets up pre-commit hooks
- [ ] Creates virtual environment if needed
- [ ] Updates are idempotent

#### invoke format
- [ ] Formats all Python files
- [ ] Preserves functionality
- [ ] Respects .gitignore
- [ ] Handles syntax errors gracefully

#### invoke lint
- [ ] Detects code quality issues
- [ ] --fix flag works correctly
- [ ] Respects configuration
- [ ] Clear issue reporting

#### invoke type-check
- [ ] Detects type mismatches
- [ ] Handles missing type hints
- [ ] Clear error messages
- [ ] Respects mypy config

#### invoke security
- [ ] Detects security issues
- [ ] Appropriate severity levels
- [ ] No false positives for project
- [ ] Actionable recommendations

#### invoke test
- [ ] Discovers all tests
- [ ] Runs tests correctly
- [ ] Reports results clearly
- [ ] Handles test failures gracefully

#### invoke check
- [ ] Runs all checks in order
- [ ] Stops on critical failures
- [ ] Clear overall status
- [ ] Appropriate exit code

#### invoke pre-commit
- [ ] Runs all configured hooks
- [ ] Matches git pre-commit behavior
- [ ] Clear status per hook
- [ ] Overall pass/fail status

## Test Execution Report Template

```markdown
# Pre-Commit Workflow Test Report

Date: [DATE]
Tester: QA Engineer
Version: [VERSION]

## Summary
- Total Tests: X
- Passed: X
- Failed: X
- Skipped: X

## Command Test Results

| Command | Status | Issues Found | Notes |
|---------|--------|--------------|-------|
| invoke install | ✅/❌ | | |
| invoke format | ✅/❌ | | |
| invoke lint | ✅/❌ | | |
| invoke type-check | ✅/❌ | | |
| invoke security | ✅/❌ | | |
| invoke test | ✅/❌ | | |
| invoke check | ✅/❌ | | |
| invoke pre-commit | ✅/❌ | | |

## Issues Found
1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce
   - Expected vs Actual

## Recommendations
- [Recommendations for fixes]

## Sign-off
- [ ] All critical tests pass
- [ ] Documentation accurate
- [ ] Ready for deployment
```

## Regression Test Suite

### After Each Change
1. Run `invoke check`
2. Verify no new issues introduced
3. Run specific command tests for changed functionality
4. Update test documentation

### Before Release
1. Full test suite execution
2. Performance benchmarks
3. Integration testing
4. User acceptance testing
