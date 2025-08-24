#!/usr/bin/env python3
"""Test script to verify database protection is working."""

import os
import sys


def test_protection():
    """Test that database protection is working correctly."""
    print("=" * 60)
    print("Testing Database Protection Mechanism")
    print("=" * 60)

    # Test 1: Normal operation (no TESTING flag)
    print("\n1. Testing normal operation (TESTING not set)...")
    os.environ.pop("TESTING", None)
    os.environ.pop("DATABASE_URL", None)

    # Clear the module to force reimport
    if "app.core.config" in sys.modules:
        del sys.modules["app.core.config"]
    if "app.core.database" in sys.modules:
        del sys.modules["app.core.database"]

    try:
        from app.core.database import DATABASE_URL

        print(f"   ✅ Normal operation works: {DATABASE_URL}")
    except Exception as e:
        print(f"   ❌ Normal operation failed: {e}")

    # Test 2: TESTING=true without DATABASE_URL
    print("\n2. Testing with TESTING=true (no DATABASE_URL)...")
    os.environ["TESTING"] = "true"
    os.environ.pop("DATABASE_URL", None)

    # Clear modules again
    for module in list(sys.modules.keys()):
        if module.startswith("app."):
            del sys.modules[module]

    try:
        from app.core.database import DATABASE_URL

        print(f"   ❌ Should have failed but got: {DATABASE_URL}")
    except RuntimeError as e:
        if "Tests must provide their own database" in str(e):
            print("   ✅ Protection working: Tests blocked without DB URL")
        else:
            print(f"   ❌ Wrong error: {e}")

    # Test 3: TESTING=true with production DATABASE_URL
    print("\n3. Testing with TESTING=true and production DB...")
    os.environ["TESTING"] = "true"
    os.environ["DATABASE_URL"] = "sqlite:///agent_kanban.db"

    # Clear modules again
    for module in list(sys.modules.keys()):
        if module.startswith("app."):
            del sys.modules[module]

    try:
        from app.core.database import DATABASE_URL

        print(f"   ❌ Should have blocked production DB but got: {DATABASE_URL}")
    except RuntimeError as e:
        if "Tests attempting to use production database" in str(
            e
        ) or "Tests must provide their own database" in str(e):
            print("   ✅ Protection working: Production DB blocked in tests")
        else:
            print(f"   ❌ Wrong error: {e}")

    # Test 4: TESTING=true with test DATABASE_URL
    print("\n4. Testing with TESTING=true and test DB...")
    os.environ["TESTING"] = "true"
    os.environ["DATABASE_URL"] = "sqlite:///test_temp.db"

    # Clear modules again
    for module in list(sys.modules.keys()):
        if module.startswith("app."):
            del sys.modules[module]

    try:
        from app.core.database import DATABASE_URL

        if "test" in DATABASE_URL and "agent_kanban.db" not in DATABASE_URL:
            print(f"   ✅ Test database allowed: {DATABASE_URL}")
        else:
            print(f"   ❌ Unexpected database URL: {DATABASE_URL}")
    except Exception as e:
        print(f"   ❌ Test database should work but failed: {e}")

    print("\n" + "=" * 60)
    print("Database Protection Test Complete!")
    print("=" * 60)


if __name__ == "__main__":
    test_protection()
