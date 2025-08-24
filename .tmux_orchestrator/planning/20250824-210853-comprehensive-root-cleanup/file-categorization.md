# Root Directory File Categorization
## Total Files: 106

### ESSENTIAL CONFIG FILES TO KEEP (14 files)
- README.md
- CLAUDE.md
- .env.example
- .gitignore
- .mcp.json
- package.json
- package-lock.json
- pyproject.toml
- poetry.lock
- playwright.config.ts
- tsconfig.json (if exists)
- .env
- agent_kanban.db (main database)
- project-closeout.md

### TEST FILES TO MOVE TO tests/ (5 files)
- final_system_validation.py ✓ MOVED
- test-card-creation-curl.sh ✓ MOVED
- playwright-no-server.config.ts
- playwright-test-15175.config.ts
- emergency-validation.spec.ts (if in root)

### SHELL SCRIPTS TO MOVE TO scripts/ (8 files)
- launch-demo.sh
- start-backend.sh
- monitor_database.sh
- cleanup_test_databases.sh
- frontend-monitor-simple.sh
- performance-monitoring-schedule.sh

### MONITORING/JS FILES TO MOVE TO monitoring/ (4 files)
- frontend-monitor.js
- frontend-performance-monitor.js
- performance-monitoring.log
- monitor-debug.log
- frontend-performance-log.json

### HTML DEMO FILES TO MOVE TO demos/ (1 file)
- demo-multi-user-websocket.html

### DATABASE BACKUPS TO ARCHIVE (3+ files)
- agent_kanban.db.backup
- agent_kanban.backup.*.db
- All .db files except main

### JSON RESULTS TO ARCHIVE (6+ files)
- qa-*.json
- FINAL_VALIDATION_RESULTS.json

### LOGS TO DELETE OR ARCHIVE (3 files)
- backend_log.txt
- dragdrop_test_backend.log

### ALL REPORT MD FILES (60+ files) - MOVED TO docs/
- All *REPORT*.md files
- All PM_*.md files
- All QA_*.md files
- All UI_*.md files
- All *STATUS*.md files
- All *VALIDATION*.md files

## ACTION PLAN
1. ✓ Move test files to tests/
2. ✓ Move documentation to docs/
3. Move shell scripts to scripts/
4. Move monitoring files to monitoring/
5. Archive database backups
6. Archive JSON results
7. Delete or archive logs
8. Move HTML demos
9. Clean up remaining files
