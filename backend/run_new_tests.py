#!/usr/bin/env python3
"""
Test runner for new backend optimizations
Runs all new tests for Phase 2 backend enhancements
"""

import subprocess
import sys
import time


def run_command(command, description):
    """Run a command and return success status"""
    print(f"\n{'=' * 60}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print("=" * 60)

    start_time = time.time()
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    duration = time.time() - start_time

    print(f"Duration: {duration:.2f}s")

    if result.returncode == 0:
        print(f"✅ {description} - PASSED")
        if result.stdout:
            print("STDOUT:")
            print(result.stdout)
    else:
        print(f"❌ {description} - FAILED")
        if result.stderr:
            print("STDERR:")
            print(result.stderr)
        if result.stdout:
            print("STDOUT:")
            print(result.stdout)

    return result.returncode == 0


def check_server_running():
    """Check if the backend server is running"""
    try:
        import httpx

        client = httpx.Client()
        response = client.get("http://localhost:8000/health", timeout=5)
        client.close()
        return response.status_code == 200
    except Exception:
        return False


def main():
    """Run all new tests"""
    print("🧪 Agent Kanban Backend - Phase 2 Optimization Tests")
    print("This will test all new features: bulk operations, enhanced statistics, logging, caching")

    # Check if server is running
    if not check_server_running():
        print("\n⚠️  Backend server is not running!")
        print("Please start the server with: python -m uvicorn app.main:app --reload")
        print("Or run: python start-backend.sh")
        sys.exit(1)

    print("✅ Backend server is running")

    # Define test commands
    tests = [
        {
            "command": "python tests/test_drag_drop_logging.py",
            "description": "Drag & Drop Logging Tests (Unit Tests - No Server Required)",
            "critical": True,
        },
        {
            "command": "python tests/test_bulk_operations.py",
            "description": "Bulk Operations API Tests (Requires Server)",
            "critical": True,
        },
        {
            "command": "python tests/test_enhanced_statistics.py",
            "description": "Enhanced Statistics API Tests (Requires Server)",
            "critical": True,
        },
        {
            "command": "python -m pytest tests/test_websocket_manager.py -v",
            "description": "WebSocket Manager Tests (Existing Enhanced)",
            "critical": False,
        },
        {
            "command": "python -m pytest tests/test_statistics_service.py -v",
            "description": "Statistics Service Tests (Existing)",
            "critical": False,
        },
    ]

    # Run tests
    results = []
    total_time = time.time()

    for test in tests:
        success = run_command(test["command"], test["description"])
        results.append(
            {"description": test["description"], "success": success, "critical": test["critical"]}
        )

        # Wait a bit between tests
        time.sleep(1)

    total_duration = time.time() - total_time

    # Print summary
    print(f"\n{'=' * 60}")
    print("🏁 TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for r in results if r["success"])
    total = len(results)
    critical_passed = sum(1 for r in results if r["success"] and r["critical"])
    critical_total = sum(1 for r in results if r["critical"])

    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Critical Tests: {critical_total}")
    print(f"Critical Passed: {critical_passed}")
    print(f"Total Duration: {total_duration:.2f}s")

    print("\nDetailed Results:")
    for result in results:
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        critical = " (CRITICAL)" if result["critical"] else ""
        print(f"  {status} - {result['description']}{critical}")

    # Overall result
    all_critical_passed = critical_passed == critical_total

    if all_critical_passed:
        print("\n🎉 ALL CRITICAL TESTS PASSED! Phase 2 optimizations are working correctly.")
        if passed == total:
            print("🏆 PERFECT SCORE - All tests passed!")
        else:
            print(f"⚠️  Some non-critical tests failed ({total - passed}/{total})")
        return 0
    else:
        print(f"\n💥 CRITICAL TESTS FAILED! ({critical_total - critical_passed}/{critical_total})")
        print("Phase 2 optimizations need attention before deployment.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
