# QA Validation Report - Root Directory Cleanup

## Initial Assessment
- **Total files in root**: 90+ files
- **Target**: < 20 files
- **Risk Level**: MEDIUM - Need careful validation to avoid breaking functionality

## File Categories for Safety Validation

### 1. CRITICAL - DO NOT MOVE/DELETE (Must stay in root)
- `README.md` - Standard repository file
- `CLAUDE.md` - Project instructions
- `package.json`, `package-lock.json` - Node dependencies
- `pyproject.toml`, `poetry.lock` - Python dependencies
- `playwright.config.ts` - Main Playwright config
- `.env.example` - Environment template
- `.gitignore` - Git configuration
- `.mcp.json` - MCP configuration
- `agent_kanban.db` - Production database

### 2. SAFE TO MOVE - Test Files
**Target: tests/**
- `final_system_validation.py` → tests/validation/
- `cleanup_test_databases.sh` → tests/scripts/
- `test-card-creation-curl.sh` → tests/scripts/
- `demo-multi-user-websocket.html` → tests/demo/
- All `qa-*.json` files → tests/results/

### 3. SAFE TO MOVE - Monitoring Scripts
**Target: scripts/monitoring/**
- `frontend-monitor.js`
- `frontend-monitor-simple.sh`
- `frontend-performance-monitor.js`
- `monitor_database.sh`
- `performance-monitoring-schedule.sh`

### 4. SAFE TO MOVE - Reports
**Target: archive/reports/**
- All `*_REPORT.md` files (40+ files)
- All `PM_*.md` files
- All `QA_*.md` files
- All `*_STATUS*.md` files

### 5. SAFE TO MOVE - Demo/Documentation
**Target: docs/**
- `DEMO_INSTRUCTIONS.md`
- `WEBSOCKET_DEMO_GUIDE.md`
- `URGENT_CONSOLE_TEST_INSTRUCTIONS.md`
- All other `*_GUIDE.md` files

### 6. SAFE TO MOVE - Backups
**Target: Already in backups/ or database_backups/**
- `agent_kanban.backup.20250819_044314.db` → database_backups/
- `agent_kanban.db.backup` → database_backups/

### 7. SAFE TO DELETE - Temporary/Log Files
- `backend_log.txt`
- `dragdrop_test_backend.log`
- `monitor-debug.log`
- `performance-monitoring.log`
- `frontend-performance-log.json`

### 8. SAFE TO DELETE - Redundant Configs
- `playwright-no-server.config.ts` (variant config)
- `playwright-test-15175.config.ts` (test config)

### 9. REQUIRES REVIEW - Utility Scripts
- `launch-demo.sh` → scripts/ or demos/
- `start-backend.sh` → scripts/

### 10. SAFE TO MOVE - Coverage Reports
**Target: tests/coverage/**
- `htmlcov/` directory and all contents

## Safety Validation Checklist

### Pre-Move Validation
- [x] No malicious files detected
- [x] Production database identified and protected
- [x] Critical config files identified
- [x] Test files categorized
- [x] Reports categorized

### Move Safety Rules
1. **NEVER** touch `agent_kanban.db` (production)
2. **PRESERVE** all package configs in root
3. **TEST** after each batch of moves
4. **GIT ADD** files before moving (to track)
5. **VERIFY** imports/paths after moving scripts

### Testing Requirements After Moves
1. Backend startup: `cd backend && python run.py`
2. Frontend startup: `cd frontend && npm run dev`
3. Test suite: `pytest backend/tests/`
4. Playwright tests: `npx playwright test`

## Risk Assessment
- **Database corruption**: LOW (protected)
- **Build failure**: LOW (configs preserved)
- **Test failure**: MEDIUM (paths may need updates)
- **Import errors**: MEDIUM (Python scripts may need path fixes)

## Recommended Move Order
1. Log files (delete first)
2. Test result JSONs
3. Report markdown files
4. Test scripts
5. Monitoring scripts
6. Demo files
7. Coverage reports

## Final Validation Required
- [ ] All critical files remain in root
- [ ] Tests still run
- [ ] Backend starts correctly
- [ ] Frontend builds correctly
- [ ] Git tracking maintained
