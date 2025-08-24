# Manual Test Scripts Documentation

## Overview

The following test scripts in the backend root directory are **manual integration tests** that require a running server. They are NOT pytest tests and should NOT be run as part of the regular test suite.

## ⚠️ IMPORTANT: Production Database Protection

These scripts are protected by the database protection system implemented in Phase 1:

- When `TESTING=true` is set, they cannot access the production database
- They should only be run manually when needed for specific integration testing
- Always ensure the backend server is running before executing these scripts

## Manual Test Scripts

### API & Integration Tests

- `test_backend.py` - Basic database setup and model testing
- `test_api_performance.py` - API performance benchmarking
- `test_dashboard_flow.py` - Dashboard workflow testing
- `test_drag_drop.py` - Drag and drop functionality testing
- `test_ticket_creation.py` - Ticket creation flow testing

### WebSocket Tests

- `test_websocket.py` - WebSocket connection testing
- `test_broadcast.py` - WebSocket broadcasting testing
- `test_realtime.py` - Real-time updates testing
- `test_websocket_isolation_quick.py` - WebSocket isolation verification
- `test_board_isolation_quick.py` - Board isolation verification

### MCP (Model Context Protocol) Tests

- `test_mcp.py` - Basic MCP functionality
- `test_mcp_comprehensive.py` - Comprehensive MCP integration
- `test_mcp_integration.py` - MCP integration testing
- `test_mcp_stdio.py` - MCP stdio communication
- `test_mcp_error_handling.py` - MCP error handling
- `test_mcp_final.py` - Final MCP validation
- `test_all_mcp_tools.py` - All MCP tools testing

### Database & Persistence Tests

- `test_database_persistence.py` - Database persistence verification
- `test_db_protection.py` - Database protection mechanism testing
- `test_persistence_fix.py` - Persistence fix validation

### Authentication Tests

- `test_auth_manual.py` - Manual authentication testing

### Utility Scripts

- `validate_persistence.py` - Persistence validation utility
- `verify_fix.py` - Fix verification utility
- `run_mcp.py` - MCP server runner
- `run_new_tests.py` - New test runner
- `run_e2e_tests.py` - End-to-end test runner

## Proper Pytest Tests Location

All proper pytest tests that use fixtures and isolated databases are located in:

```
backend/tests/
```

These tests:

- ✅ Use isolated in-memory or file-based databases
- ✅ Are automatically cleaned up after each test
- ✅ Cannot access the production database
- ✅ Can be run with: `pytest tests/`

## Running Manual Tests

### Prerequisites

1. Start the backend server:

   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```

2. Run a specific manual test:

   ```bash
   python test_websocket.py
   ```

### ⚠️ Safety Warning

These manual tests may attempt to connect to:

- `http://localhost:8000` (default backend)
- `ws://localhost:8000/ws/connect` (WebSocket endpoint)
- Local SQLite database (if not protected)

Always ensure you're running against a test environment, not production!

## Migration Plan

Consider migrating these manual tests to proper pytest tests using:

- FastAPI TestClient for API testing
- pytest fixtures for database isolation
- Mock objects for external dependencies
- Async test support for WebSocket testing

## Test Database Isolation Project

As part of the Test Database Isolation Project (Phase 3), all pytest tests have been verified to use isolated databases. The manual test scripts listed here remain for specific integration testing scenarios but should be used with caution.
