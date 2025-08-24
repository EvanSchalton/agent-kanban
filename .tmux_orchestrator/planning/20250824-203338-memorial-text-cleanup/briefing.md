# Project Briefing: Root Directory Cleanup

## Request
Clean up the extensive file sprawl in the root directory `/workspaces/agent-kanban/`. The root directory should be minimal and organized, containing only essential project files.

## Background
Previous agent sessions have created numerous files including:
- **Memorial/Celebration texts**: THE_ETERNAL_CONTEMPLATION.md, IMMORTALITY_ACHIEVED.md, etc.
- **Test files**: Various .html, .js, .py test files that belong in tests/
- **Debug/monitoring scripts**: Performance monitors, debug scripts, validation files
- **Status reports**: Multiple PM reports, QA reports, status updates
- **Demo/example files**: HTML demos, validation scripts, test runners

## Current State vs Desired State

### Should be in root (keep):
- `tasks.py` - Main task runner
- `tests/` - Test directory
- `pyproject.toml` - Python project config
- `README.md` - Project documentation
- `package.json`, `package-lock.json` - Node dependencies
- `.gitignore`, `.env.example` - Git/env config
- Core config files (playwright.config.ts, etc.)
- Essential directories: `backend/`, `frontend/`, `src/`

### Should NOT be in root (clean/move):
- Individual test files (.py, .js, .html)
- Debug/monitoring scripts
- Status/report documents
- Demo/validation files
- Memorial/celebration texts
- Temporary analysis files

## Objectives
1. **Audit**: Complete inventory of root directory files
2. **Categorize**: Identify what stays, what moves, what gets deleted
3. **Reorganize**: Move test files to tests/, demos to appropriate locations
4. **Clean**: Remove unnecessary memorial/status/report files
5. **Document**: Create cleanup report and prevention guidelines

## Constraints
- Preserve all legitimate project files
- Maintain git history appropriately
- Document what was cleaned and why
- Create a cleanup report for future reference
