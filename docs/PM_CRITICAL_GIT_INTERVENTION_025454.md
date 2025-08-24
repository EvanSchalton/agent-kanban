# PM Critical Intervention - Git Staging Cleanup

**Time:** 02:54 UTC
**Action:** Direct PM intervention due to unresponsive agent

## Critical Issue

- 739 files staged including dangerous system files
- Frontend-recovery agent idle/unresponsive to urgent directive
- Risk of committing database files, backups, and PID files

## Immediate Actions Taken

✅ Removed from staging:

- agent_kanban.db.backup
- backend/agent_kanban.db-shm
- backend/agent_kanban.db-wal
- backend/agent_kanban.db.backup
- backend/agent_kanban.db.old
- .tmux_orchestrator/idle-monitor.pid
- backend/.tmux_orchestrator/idle-monitor.pid
- frontend/.tmux_orchestrator/idle-monitor.pid

## Files That Should NEVER Be Committed

- *.db (database files)
- *.db-shm,*.db-wal (database journal files)
- *.backup (backup files)
- *.pid (process ID files)
- *.log (log files unless specifically needed)
- node_modules/
- **pycache**/
- *.pyc

## Next Steps

1. Continue reviewing remaining 731 staged files
2. Create proper .gitignore entries
3. Separate changes into logical commits
4. Ensure only production code is committed

## Agent Status

- Frontend-recovery: Unresponsive to critical task
- QA-validator: Working on test suite fix
- PM taking direct action on git staging

**Priority:** Preventing accidental commit of sensitive/system files
