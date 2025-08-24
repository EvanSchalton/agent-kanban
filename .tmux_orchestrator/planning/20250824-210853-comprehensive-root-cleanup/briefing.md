# Project Briefing: Comprehensive Root Directory Cleanup

## Critical Request
Complete comprehensive cleanup of root directory. Currently 89+ files are cluttering `/workspaces/agent-kanban/` that should be organized or removed.

## Current State
After Phase 1 (memorial text removal), the root still contains:
- 89+ miscellaneous files (.md, .js, .html, .py, .json, .sh)
- Test files that belong in tests/
- Debug/monitoring scripts scattered everywhere
- Old status reports and documentation
- Demo/validation HTML files
- Various Python scripts and JavaScript files

## Required End State
Root directory should ONLY contain:
- `README.md` - Main project documentation
- `CLAUDE.md` - Claude instructions
- `package.json`, `package-lock.json` - Node configuration
- `pyproject.toml` - Python project configuration
- `.gitignore`, `.env.example` - Essential configs
- `playwright.config.ts` and similar essential configs
- Main directories: `backend/`, `frontend/`, `src/`, `tests/`, `.tmux_orchestrator/`
- GitHub workflows: `.github/`

## Cleanup Actions Required

### 1. Move Test Files
- `test-*.js`, `test-*.html`, `test-*.py` → `tests/`
- `qa-*.js`, `qa-*.html`, `qa-*.py` → `tests/qa/`
- `*-test.js`, `*-test.html`, `*-test.py` → `tests/`
- `validate-*.py`, `validate-*.js` → `tests/validation/`

### 2. Move Debug/Monitoring Files
- `debug-*.js`, `debug-*.html` → `tests/debug/`
- `monitor-*.js`, `monitor-*.sh` → `tests/monitoring/`
- `*-monitor.js`, `*-monitor.html` → `tests/monitoring/`
- `performance-*.js` → `tests/performance/`

### 3. Archive or Remove Reports
- `PM_*.md` → Archive or remove (check for important info first)
- `QA_*.md` → Archive or remove
- `*_REPORT.md`, `*_STATUS.md` → Archive or remove
- Old project completion reports → Archive

### 4. Remove Demo/Example Files
- `demo-*.html` → Remove unless essential
- `*-demo.html` → Remove unless essential
- Example/sample files → Remove

### 5. Organize Scripts
- Utility scripts → `scripts/` directory if needed
- One-off test scripts → Remove or move to tests

## Priority
**CRITICAL** - Root directory is extremely cluttered and unprofessional

## Success Criteria
- Root directory contains < 20 files (only essentials)
- All tests properly organized in tests/
- No loose scripts or reports in root
- Clean, professional repository structure
- Git tracking all changes properly
