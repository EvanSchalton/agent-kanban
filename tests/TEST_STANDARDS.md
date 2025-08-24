# Test Standards and Guidelines

## ZERO TOLERANCE POLICY

**NO TEST SKIPPING IS ALLOWED. ANY ATTEMPT TO SKIP TESTS WILL BE ESCALATED IMMEDIATELY.**

## Test Coverage Requirements

- **Minimum Coverage**: 80% for all modules
- **Critical Paths**: 100% coverage required for:
  - Authentication and authorization
  - Data validation
  - WebSocket handlers
  - MCP tool implementations
  - Database operations

## Test Categories

### 1. Unit Tests

- Location: `tests/backend/test_*.py`, `tests/frontend/*.test.tsx`
- Must test individual functions/methods in isolation
- Use mocks for external dependencies
- Should run in < 100ms per test

### 2. Integration Tests

- Location: `tests/integration/test_*.py`
- Test interactions between components
- Use test database (in-memory SQLite)
- Should run in < 500ms per test

### 3. Performance Tests

- Location: `tests/performance/test_*.py`
- Requirements:
  - API response time: < 200ms
  - WebSocket latency: < 1 second
  - Support 20 concurrent agents
  - Handle 500 tasks minimum

### 4. End-to-End Tests

- Location: `tests/e2e/test_*.py`
- Test complete user workflows
- Include both frontend and backend

## Test Naming Conventions

### Python (Backend)

```python
def test_<function_name>_<scenario>_<expected_result>():
    """Clear description of what is being tested"""
    pass
```

Example:

```python
def test_create_ticket_valid_data_returns_201():
    """Test that creating a ticket with valid data returns HTTP 201"""
    pass
```

### TypeScript/React (Frontend)

```typescript
describe('ComponentName', () => {
  it('should <action> when <condition>', () => {
    // test implementation
  });
});
```

## Test Structure (AAA Pattern)

All tests must follow the Arrange-Act-Assert pattern:

```python
def test_example():
    # Arrange - Set up test data and conditions
    test_data = {"key": "value"}

    # Act - Execute the function/method being tested
    result = function_under_test(test_data)

    # Assert - Verify the results
    assert result == expected_value
```

## Required Test Documentation

Each test file must include:

1. Module docstring explaining what is being tested
2. Clear test function/method names
3. Docstrings for complex test cases
4. Comments for non-obvious assertions

## Test Data Management

1. Use fixtures for reusable test data
2. Never use production data in tests
3. Clean up test data after each test
4. Use factories or builders for complex objects

## Continuous Integration Requirements

Before ANY commit:

1. Run all unit tests: `pytest tests/backend -m unit`
2. Run integration tests: `pytest tests/integration`
3. Check coverage: `pytest --cov=backend --cov-report=term-missing`
4. Run linters: `black . && ruff check .`
5. Run type checking: `mypy backend`

## Performance Test Benchmarks

| Metric | Requirement | Critical |
|--------|------------|----------|
| API Response Time | < 200ms | Yes |
| WebSocket Latency | < 1s | Yes |
| Database Query | < 50ms | Yes |
| Frontend Render | < 100ms | Yes |
| Concurrent Users | 20+ | Yes |
| Total Tasks | 500+ | Yes |

## Security Testing Requirements

All tests involving authentication or authorization must:

1. Test both positive and negative cases
2. Verify token validation
3. Check permission boundaries
4. Test input sanitization
5. Verify SQL injection prevention

## Test Failure Protocol

When a test fails:

1. **DO NOT SKIP OR DISABLE THE TEST**
2. Fix the underlying issue immediately
3. If blocked, create a detailed bug report
4. Escalate to PM if critical path is affected
5. Document the fix in commit message

## TDD Workflow (MANDATORY)

1. **Write the test FIRST** (Red)
2. Write minimal code to pass (Green)
3. Refactor if needed (Refactor)
4. Commit with descriptive message
5. Never commit code without tests

## Code Review Checklist

Before approving any PR:

- [ ] All new code has tests
- [ ] Test coverage >= 80%
- [ ] All tests pass
- [ ] Performance tests meet benchmarks
- [ ] No skipped tests
- [ ] Documentation updated
- [ ] Linting passes
- [ ] Type checking passes

## Monitoring and Reporting

Weekly test metrics to track:

- Overall coverage percentage
- Number of tests by category
- Average test execution time
- Failed test count (should be 0)
- Performance benchmark trends

## Escalation Policy

Escalate IMMEDIATELY to PM if:

- Developer attempts to skip tests
- Coverage drops below 80%
- Performance benchmarks are not met
- Critical security tests fail
- Any test is disabled without approval

---

**Remember: Quality is not negotiable. Every line of code must be tested.**
