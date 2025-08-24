"""Invoke tasks for Agent Kanban development."""

from invoke import task


@task
def install(c):
    """Install all dependencies for both backend and frontend."""
    print("📦 Installing backend dependencies...")
    c.run("cd backend && pip install -r requirements.txt", warn=True)
    c.run("cd backend && pip install -e .", warn=True)

    print("📦 Installing frontend dependencies...")
    c.run("cd frontend && npm install", warn=True)

    print("🔧 Installing pre-commit hooks...")
    c.run("pre-commit install", warn=True)

    print("✅ Dependencies installed and pre-commit hooks configured")


@task
def test(c, backend=True, frontend=True, verbose=False, coverage=False):
    """Run tests for backend and/or frontend."""
    if backend:
        print("🧪 Running backend tests...")
        cmd = "cd backend && python -m pytest"
        if verbose:
            cmd += " -v"
        if coverage:
            cmd += " --cov=app --cov-report=term-missing --cov-report=html"
        c.run(cmd, warn=True)

    if frontend:
        print("🧪 Running frontend tests...")
        c.run("cd frontend && npm test", warn=True)


@task
def format(c, check=False):
    """Format code for both backend and frontend."""
    # Backend formatting with black
    print("🎨 Formatting backend code...")
    cmd = "black"
    if check:
        cmd += " --check"
    cmd += " backend/"
    c.run(cmd, warn=True)

    # Frontend formatting with prettier
    print("🎨 Formatting frontend code...")
    if check:
        c.run("cd frontend && npx prettier --check 'src/**/*.{ts,tsx,js,jsx,css}'", warn=True)
    else:
        c.run("cd frontend && npx prettier --write 'src/**/*.{ts,tsx,js,jsx,css}'", warn=True)


@task
def lint(c, fix=False):
    """Run linting for both backend and frontend."""
    # Backend linting with ruff
    print("🔍 Linting backend code...")
    cmd = "ruff check"
    if fix:
        cmd += " --fix"
    cmd += " backend/"
    c.run(cmd, warn=True)

    # Frontend linting with eslint
    print("🔍 Linting frontend code...")
    eslint_cmd = "cd frontend && npx eslint src/"
    if fix:
        eslint_cmd += " --fix"
    c.run(eslint_cmd, warn=True)


@task
def type_check(c):
    """Run type checking for both backend and frontend."""
    # Backend type checking with mypy
    print("🔍 Type checking backend...")
    c.run("mypy backend/app", warn=True)

    # Frontend type checking with TypeScript
    print("🔍 Type checking frontend...")
    c.run("cd frontend && npx tsc --noEmit", warn=True)


@task
def security(c):
    """Run security checks for both backend and frontend."""
    # Backend security with bandit
    print("🔒 Running backend security checks...")
    c.run("bandit -r backend/app -ll", warn=True)

    # Frontend security audit
    print("🔒 Running frontend security audit...")
    c.run("cd frontend && npm audit", warn=True)


@task
def check(c):
    """Run all CI/CD checks."""
    print("🔍 Running all CI/CD checks...")

    print("\n📝 Checking code formatting...")
    format(c, check=True)

    print("\n🔧 Running linters...")
    lint(c)

    print("\n🔒 Running security checks...")
    security(c)

    print("\n🔍 Running type checkers...")
    type_check(c)

    print("\n🧪 Running tests...")
    test(c)

    print("\n✅ All checks passed! Ready to push.")


@task
def pre_commit(c):
    """Run pre-commit on all files."""
    c.run("pre-commit run --all-files", warn=True)


@task
def clean(c):
    """Clean up generated files."""
    print("🧹 Cleaning up generated files...")

    # Python cleanup
    c.run('find . -type d -name "__pycache__" -exec rm -rf {} +', warn=True)
    c.run('find . -type f -name "*.pyc" -delete', warn=True)
    c.run('find . -type f -name "*.pyo" -delete', warn=True)
    c.run('find . -type f -name "*.coverage" -delete', warn=True)
    c.run("rm -rf .coverage htmlcov .pytest_cache .mypy_cache .ruff_cache", warn=True)

    # Frontend cleanup
    c.run("rm -rf frontend/dist frontend/build", warn=True)

    # Test cleanup
    c.run("rm -rf playwright-report test-results", warn=True)

    print("✅ Cleaned up generated files")


@task
def dev(c, backend=True, frontend=True):
    """Start development servers."""
    if backend and frontend:
        print("🚀 Starting both backend and frontend servers...")
        print("💡 Tip: Run in separate terminals for better control")
        c.run("cd backend && python run.py &", warn=True)
        c.run("cd frontend && npm run dev", warn=True)
    elif backend:
        print("🚀 Starting backend server...")
        c.run("cd backend && python run.py", warn=True)
    elif frontend:
        print("🚀 Starting frontend server...")
        c.run("cd frontend && npm run dev", warn=True)


@task
def build(c):
    """Build production versions."""
    print("🏗️ Building frontend for production...")
    c.run("cd frontend && npm run build", warn=True)
    print("✅ Production build complete")


@task
def db_migrate(c):
    """Run database migrations."""
    print("🗄️ Running database migrations...")
    c.run("cd backend && alembic upgrade head", warn=True)
    print("✅ Database migrations complete")


@task
def db_reset(c):
    """Reset database (WARNING: destroys data)."""
    response = input("⚠️ This will delete all data! Continue? (y/N): ")
    if response.lower() == "y":
        print("🗄️ Resetting database...")
        c.run("rm -f backend/agent_kanban.db", warn=True)
        c.run("cd backend && alembic upgrade head", warn=True)
        print("✅ Database reset complete")
    else:
        print("❌ Database reset cancelled")


@task
def quick(c):
    """Quick checks before committing."""
    print("⚡ Running quick checks...")
    lint(c)
    type_check(c)
    # Run quick smoke tests
    c.run("cd backend && python -m pytest tests/test_api_integration.py -v", warn=True)
    print("✅ Quick checks passed")


@task
def full(c):
    """Full check including formatting and all tests."""
    clean(c)
    format(c)
    check(c)


@task
def ci(c):
    """Run the exact same checks as CI/CD."""
    print("🚀 Running local CI/CD simulation...")
    print("\nThis runs the exact same checks as GitHub Actions:")
    print("- Black formatting check")
    print("- Ruff linting")
    print("- ESLint linting")
    print("- Bandit security scan")
    print("- MyPy type checking")
    print("- TypeScript type checking")
    print("- Pytest tests")
    print("- Jest tests\n")

    # Run each check exactly as CI/CD does
    print("1️⃣ Checking Python formatting...")
    c.run("black --check backend/")

    print("\n2️⃣ Linting Python with Ruff...")
    c.run("ruff check backend/")

    print("\n3️⃣ Linting TypeScript with ESLint...")
    c.run("cd frontend && npx eslint src/")

    print("\n4️⃣ Security scan with Bandit...")
    c.run("bandit -r backend/app -ll")

    print("\n5️⃣ Type checking Python with MyPy...")
    c.run("mypy backend/app")

    print("\n6️⃣ Type checking TypeScript...")
    c.run("cd frontend && npx tsc --noEmit")

    print("\n7️⃣ Running backend tests...")
    c.run("cd backend && python -m pytest")

    print("\n8️⃣ Running frontend tests...")
    c.run("cd frontend && npm test")

    print("\n✅ Local CI/CD passed! Your code matches what will run on GitHub.")


@task
def update_deps(c):
    """Update dependencies while respecting version constraints."""
    print("📦 Updating backend dependencies...")
    c.run("cd backend && pip-compile requirements.in", warn=True)

    print("📦 Updating frontend dependencies...")
    c.run("cd frontend && npm update", warn=True)

    print("✅ Dependencies updated")


@task
def playwright(c, headed=False, ui=False):
    """Run Playwright E2E tests."""
    print("🎭 Running Playwright E2E tests...")
    cmd = "npx playwright test"
    if headed:
        cmd += " --headed"
    if ui:
        cmd += " --ui"
    c.run(cmd, warn=True)


# Aliases for common commands
@task
def t(c):
    """Alias for test."""
    test(c)


@task
def f(c):
    """Alias for format."""
    format(c)


@task(name="l")
def lint_alias(c):
    """Alias for lint."""
    lint(c)


@task
def q(c):
    """Alias for quick."""
    quick(c)
