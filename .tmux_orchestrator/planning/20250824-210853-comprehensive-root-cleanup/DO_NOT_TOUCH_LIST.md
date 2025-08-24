# DO NOT TOUCH LIST - CRITICAL FILES

## ABSOLUTE DO NOT MODIFY/MOVE/DELETE
These files MUST remain in root directory:

### Core Configuration
- `README.md` - Repository documentation
- `CLAUDE.md` - Project AI instructions
- `.gitignore` - Git ignore rules
- `.mcp.json` - MCP tool configuration
- `.env.example` - Environment template

### Package Management
- `package.json` - Node.js dependencies
- `package-lock.json` - Node.js lock file
- `pyproject.toml` - Python project config
- `poetry.lock` - Poetry lock file

### Build Configuration
- `playwright.config.ts` - Main Playwright config

### Database
- `agent_kanban.db` - PRODUCTION DATABASE - NEVER TOUCH!

### Project Structure (directories)
- `frontend/` - Frontend application
- `backend/` - Backend application
- `src/` - Source code
- `tests/` - Test suites
- `.tmux_orchestrator/` - Orchestrator files
- `.devcontainer/` - Dev container config
- `.claude/` - Claude configuration
- `.github/` - GitHub workflows

## IMMEDIATE DELETION - JUNK FILES

### Log Files (DELETE NOW)
- `backend_log.txt`
- `dragdrop_test_backend.log`
- `monitor-debug.log`
- `performance-monitoring.log`
- `frontend-performance-log.json`

### Redundant Test Configs (DELETE)
- `playwright-no-server.config.ts`
- `playwright-test-15175.config.ts`

### Old Backups Already Saved (DELETE)
- `agent_kanban.backup.20250819_044314.db` (copy exists in database_backups/)
- `agent_kanban.db.backup` (copy exists in database_backups/)

## VALIDATION COMMAND
Run this after deletions:
```bash
/workspaces/agent-kanban/.tmux_orchestrator/planning/20250824-210853-comprehensive-root-cleanup/qa-quick-validation.sh
```
