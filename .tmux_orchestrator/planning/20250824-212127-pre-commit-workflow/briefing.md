# Project Briefing: Implement Pre-Commit Workflow Infrastructure

## Request
Implement a comprehensive pre-commit workflow for the agent-kanban project, replicating the successful patterns from Tmux-Orchestrator's tasks.py and CI/CD pipeline.

## Background
The project has a pre-commit workflow command documented at `.claude/commands/pre-commit-workflow.md` but lacks the underlying infrastructure to execute it. We need to implement:
1. A tasks.py file with invoke tasks (similar to Tmux-Orchestrator)
2. Pre-commit configuration (.pre-commit-config.yaml)
3. CI/CD workflow for automatic version bumping
4. Integration with existing project structure

## Reference Implementation
Using `/workspaces/agent-kanban/references/Tmux-Orchestrator/` as our gold standard:
- `tasks.py` - Invoke tasks for development workflow
- `.pre-commit-config.yaml` - Pre-commit hooks configuration
- `.github/workflows/version-bump.yml` - Automatic version bumping

## Objectives

### Phase 1: Core Infrastructure
1. **Create tasks.py** with essential invoke tasks:
   - `install` - Setup dependencies and pre-commit hooks
   - `test` - Run test suite
   - `format` - Code formatting with ruff
   - `lint` - Linting with ruff
   - `type-check` - Type checking with mypy
   - `security` - Security scanning with bandit
   - `check` - Run all CI/CD checks
   - `pre-commit` - Run pre-commit on all files
   - `clean` - Clean generated files

### Phase 2: Pre-Commit Configuration
1. **Create .pre-commit-config.yaml** with:
   - Ruff formatter and linter
   - Bandit security scanner
   - Standard file quality checks
   - MyPy type checking (can be disabled initially)

### Phase 3: CI/CD Integration
1. **Create/Update GitHub Actions workflows**:
   - Test workflow that runs on push/PR
   - Version bump workflow for automatic versioning
   - Integration with existing workflows

### Phase 4: Project Integration
1. **Update pyproject.toml** with:
   - Invoke as a dependency
   - Pre-commit as a dev dependency
   - Proper tool configurations for ruff, mypy, bandit
   - Version management setup

## Success Criteria
- [ ] `invoke install` sets up the development environment
- [ ] `invoke check` runs all quality checks successfully
- [ ] `pre-commit run --all-files` passes without errors
- [ ] GitHub Actions workflows validate code on push
- [ ] Version bump happens automatically after merge to main
- [ ] All commands from pre-commit-workflow.md are executable

## Constraints
- Must be compatible with existing project structure
- Should follow patterns from Tmux-Orchestrator reference
- Must integrate with both Python backend and TypeScript frontend
- Should not break existing functionality

## Priority
**HIGH** - This infrastructure is essential for maintaining code quality and enabling the documented pre-commit workflow command.
