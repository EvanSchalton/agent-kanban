#!/usr/bin/env python3
"""
QA Automation Suite for Agent Kanban Board
Comprehensive API and WebSocket testing for Phase 1 demo preparation
"""

import asyncio
import json
import logging
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

import psutil
import requests
import websockets

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@dataclass
class TestResult:
    """Test result structure"""

    test_name: str
    status: str  # PASS, FAIL, ERROR
    response_time_ms: float
    status_code: int | None = None
    error_message: str | None = None
    response_data: Any | None = None
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()


class QAAutomationSuite:
    """Comprehensive QA automation test suite"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.results: list[TestResult] = []
        self.session = requests.Session()
        self.session.headers.update(
            {"Content-Type": "application/json", "Accept": "application/json"}
        )

    def log_result(self, result: TestResult):
        """Log and store test result"""
        self.results.append(result)
        status_emoji = "✅" if result.status == "PASS" else "❌"
        logger.info(
            f"{status_emoji} {result.test_name}: {result.status} ({result.response_time_ms:.0f}ms)"
        )
        if result.error_message:
            logger.error(f"   Error: {result.error_message}")

    def test_api_endpoint(
        self,
        method: str,
        endpoint: str,
        test_name: str,
        expected_status: int = 200,
        payload: dict | None = None,
    ) -> TestResult:
        """Generic API endpoint test"""
        url = f"{self.base_url}{endpoint}"
        start_time = time.time()

        try:
            if method == "GET":
                response = self.session.get(url, timeout=10)
            elif method == "POST":
                response = self.session.post(url, json=payload, timeout=10)
            elif method == "PUT":
                response = self.session.put(url, json=payload, timeout=10)
            elif method == "DELETE":
                response = self.session.delete(url, timeout=10)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            response_time = (time.time() - start_time) * 1000

            # Parse response data
            try:
                response_data = response.json()
            except:
                response_data = response.text[:200] if response.text else None

            # Determine test status
            if response.status_code == expected_status:
                status = "PASS"
                error_message = None
            else:
                status = "FAIL"
                error_message = f"Expected {expected_status}, got {response.status_code}"

            result = TestResult(
                test_name=test_name,
                status=status,
                response_time_ms=response_time,
                status_code=response.status_code,
                error_message=error_message,
                response_data=response_data,
            )

        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            result = TestResult(
                test_name=test_name,
                status="ERROR",
                response_time_ms=response_time,
                error_message=str(e),
            )

        self.log_result(result)
        return result

    async def test_websocket_connection(self) -> TestResult:
        """Test WebSocket connection and basic functionality"""
        ws_url = self.base_url.replace("http", "ws") + "/ws/connect"
        start_time = time.time()

        try:
            async with websockets.connect(ws_url, timeout=10) as websocket:
                # Test connection established
                connection_time = (time.time() - start_time) * 1000

                # Send a test message
                test_message = {"type": "ping", "data": {"timestamp": time.time()}}
                await websocket.send(json.dumps(test_message))

                # Wait for response (with timeout)
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    response_data = json.loads(response)

                    result = TestResult(
                        test_name="WebSocket Connection & Message",
                        status="PASS",
                        response_time_ms=connection_time,
                        response_data=response_data,
                    )
                except TimeoutError:
                    result = TestResult(
                        test_name="WebSocket Connection & Message",
                        status="FAIL",
                        response_time_ms=connection_time,
                        error_message="No response received within timeout",
                    )

        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            result = TestResult(
                test_name="WebSocket Connection & Message",
                status="ERROR",
                response_time_ms=response_time,
                error_message=str(e),
            )

        self.log_result(result)
        return result

    def monitor_backend_process(self) -> dict[str, Any]:
        """Monitor backend process health and resource usage"""
        try:
            # Find backend process
            backend_proc = None
            for proc in psutil.process_iter(["pid", "name", "cmdline", "status"]):
                try:
                    if "uvicorn" in " ".join(proc.info["cmdline"] or []):
                        backend_proc = psutil.Process(proc.info["pid"])
                        break
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            if not backend_proc:
                return {"status": "NOT_FOUND", "error": "Backend process not found"}

            # Get process info
            memory_info = backend_proc.memory_info()
            cpu_percent = backend_proc.cpu_percent(interval=1)

            return {
                "status": "RUNNING",
                "pid": backend_proc.pid,
                "cpu_percent": cpu_percent,
                "memory_mb": memory_info.rss / 1024 / 1024,
                "status_code": backend_proc.status(),
                "create_time": datetime.fromtimestamp(backend_proc.create_time()).isoformat(),
            }

        except Exception as e:
            return {"status": "ERROR", "error": str(e)}

    def run_critical_api_tests(self):
        """Run tests for the specific failing endpoints mentioned"""
        logger.info("🚀 Starting Critical API Endpoint Tests")

        # Test 1: Health check
        self.test_api_endpoint("GET", "/health", "Health Check")

        # Test 2: List boards
        self.test_api_endpoint("GET", "/api/boards", "List Boards")

        # Test 3: Get specific board (corrected endpoint)
        self.test_api_endpoint("GET", "/api/boards/1", "Get Board 1")

        # Test 4: Get board tickets (corrected format)
        self.test_api_endpoint("GET", "/api/tickets/?board_id=1", "Get Board 1 Tickets")

        # Test 5: Create a test ticket first
        ticket_payload = {
            "title": "QA Test Ticket",
            "description": "Automated test ticket",
            "current_column": "todo",
            "priority": "1.0",
            "board_id": 1,
        }
        create_result = self.test_api_endpoint(
            "POST", "/api/tickets", "Create Test Ticket", payload=ticket_payload
        )

        # Test 6: Move ticket (if creation succeeded)
        if create_result.status == "PASS" and create_result.response_data:
            ticket_id = create_result.response_data.get("id")
            if ticket_id:
                move_payload = {"column_id": "in_progress"}
                self.test_api_endpoint(
                    "POST", f"/api/tickets/{ticket_id}/move", "Move Ticket", payload=move_payload
                )

                # Cleanup - delete test ticket
                self.test_api_endpoint(
                    "DELETE",
                    f"/api/tickets/{ticket_id}",
                    "Cleanup Test Ticket",
                    expected_status=204,
                )

        # Test 7: Test the problematic endpoints mentioned
        self.test_api_endpoint(
            "GET", "/api/boards/default", "Get Default Board (Expected Fail)", expected_status=422
        )

    async def run_websocket_tests(self):
        """Run WebSocket-specific tests"""
        logger.info("🔌 Starting WebSocket Tests")
        await self.test_websocket_connection()

    def run_performance_benchmarks(self, iterations: int = 10):
        """Run performance benchmarks for demo preparation"""
        logger.info(f"📊 Starting Performance Benchmarks ({iterations} iterations)")

        endpoints = [
            ("GET", "/api/boards", "Boards List Performance"),
            ("GET", "/api/boards/1", "Board Detail Performance"),
            ("GET", "/api/tickets/?board_id=1", "Tickets List Performance"),
        ]

        for method, endpoint, test_name in endpoints:
            times = []
            for i in range(iterations):
                result = self.test_api_endpoint(method, endpoint, f"{test_name} Run {i + 1}")
                if result.status == "PASS":
                    times.append(result.response_time_ms)

            if times:
                avg_time = sum(times) / len(times)
                min_time = min(times)
                max_time = max(times)

                perf_result = TestResult(
                    test_name=f"{test_name} Summary",
                    status="PASS",
                    response_time_ms=avg_time,
                    response_data={
                        "avg_ms": round(avg_time, 2),
                        "min_ms": round(min_time, 2),
                        "max_ms": round(max_time, 2),
                        "iterations": len(times),
                    },
                )
                self.log_result(perf_result)

    def generate_report(self) -> dict[str, Any]:
        """Generate comprehensive test report"""
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r.status == "PASS"])
        failed_tests = len([r for r in self.results if r.status == "FAIL"])
        error_tests = len([r for r in self.results if r.status == "ERROR"])

        avg_response_time = (
            sum(r.response_time_ms for r in self.results) / total_tests if total_tests > 0 else 0
        )

        # Backend process status
        backend_status = self.monitor_backend_process()

        report = {
            "summary": {
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
                "errors": error_tests,
                "success_rate": round((passed_tests / total_tests) * 100, 2)
                if total_tests > 0
                else 0,
                "avg_response_time_ms": round(avg_response_time, 2),
            },
            "backend_status": backend_status,
            "test_results": [asdict(result) for result in self.results],
            "timestamp": datetime.now().isoformat(),
            "recommendations": self._generate_recommendations(),
        }

        return report

    def _generate_recommendations(self) -> list[str]:
        """Generate recommendations based on test results"""
        recommendations = []

        failed_tests = [r for r in self.results if r.status in ["FAIL", "ERROR"]]
        if failed_tests:
            recommendations.append(
                f"❌ {len(failed_tests)} tests failing - requires immediate attention"
            )

        slow_tests = [r for r in self.results if r.response_time_ms > 1000]
        if slow_tests:
            recommendations.append(
                f"⚠️ {len(slow_tests)} slow responses (>1s) - performance optimization needed"
            )

        backend_status = self.monitor_backend_process()
        if backend_status.get("cpu_percent", 0) > 80:
            recommendations.append("🔥 High CPU usage detected - backend under stress")

        if backend_status.get("memory_mb", 0) > 500:
            recommendations.append("💾 High memory usage detected - potential memory leak")

        if not recommendations:
            recommendations.append("✅ All tests passing - system ready for demo")

        return recommendations


async def main():
    """Main execution function"""
    logger.info("🎯 QA AUTOMATION SUITE - Phase 1 Demo Preparation")
    logger.info("=" * 60)

    qa_suite = QAAutomationSuite()

    try:
        # Run critical API tests
        qa_suite.run_critical_api_tests()

        # Run WebSocket tests
        await qa_suite.run_websocket_tests()

        # Run performance benchmarks
        qa_suite.run_performance_benchmarks(iterations=5)

        # Generate and save report
        report = qa_suite.generate_report()

        # Save detailed report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = f"/workspaces/agent-kanban/tests/qa_automation_report_{timestamp}.json"
        with open(report_file, "w") as f:
            json.dump(report, f, indent=2)

        # Print summary
        logger.info("=" * 60)
        logger.info("📋 TEST SUMMARY")
        logger.info(f"Total Tests: {report['summary']['total_tests']}")
        logger.info(f"✅ Passed: {report['summary']['passed']}")
        logger.info(f"❌ Failed: {report['summary']['failed']}")
        logger.info(f"🔧 Errors: {report['summary']['errors']}")
        logger.info(f"📊 Success Rate: {report['summary']['success_rate']}%")
        logger.info(f"⏱️ Avg Response: {report['summary']['avg_response_time_ms']}ms")

        logger.info("\n🎯 RECOMMENDATIONS:")
        for rec in report["recommendations"]:
            logger.info(f"  {rec}")

        logger.info(f"\n📄 Detailed report saved: {report_file}")

        return report

    except Exception as e:
        logger.error(f"Test suite failed: {e}")
        return None


if __name__ == "__main__":
    asyncio.run(main())
