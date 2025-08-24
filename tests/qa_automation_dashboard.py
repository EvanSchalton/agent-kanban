#!/usr/bin/env python3
"""
QA Automation Dashboard for Agent Kanban Board
Real-time monitoring and test execution dashboard for Phase 1 demo
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class SystemHealth:
    """System health metrics"""

    api_status: str
    websocket_status: str
    backend_process_status: str
    response_times: dict[str, float]
    error_count: int
    uptime_seconds: float
    memory_usage_mb: float
    cpu_percent: float
    timestamp: str


class QAAutomationDashboard:
    """Comprehensive QA automation dashboard"""

    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

        # Dashboard state
        self.is_running = False
        self.health_history: list[SystemHealth] = []
        self.test_results = []
        self.alerts = []

        # Test configuration
        self.test_intervals = {
            "health_check": 10,  # Every 10 seconds
            "api_tests": 30,  # Every 30 seconds
            "performance_tests": 60,  # Every minute
            "stress_tests": 300,  # Every 5 minutes
        }

        self.last_test_runs = {}
        self.performance_thresholds = {
            "response_time_ms": 1000,
            "error_rate_percent": 5,
            "memory_mb": 500,
            "cpu_percent": 80,
        }

    def log_alert(self, level: str, message: str):
        """Log system alert"""
        alert = {"level": level, "message": message, "timestamp": datetime.now().isoformat()}
        self.alerts.append(alert)

        # Keep only last 100 alerts
        if len(self.alerts) > 100:
            self.alerts.pop(0)

        emoji = {"INFO": "ℹ️", "WARNING": "⚠️", "ERROR": "❌", "CRITICAL": "🚨"}.get(level, "📍")
        logger.info(f"{emoji} {level}: {message}")

    def get_system_health(self) -> SystemHealth:
        """Get comprehensive system health metrics"""
        start_time = time.time()

        # Test API endpoints
        response_times = {}
        error_count = 0
        api_status = "DOWN"

        try:
            # Health check
            response = self.session.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                api_status = "UP"
                response_times["health"] = (time.time() - start_time) * 1000
            else:
                error_count += 1
        except Exception as e:
            error_count += 1
            self.log_alert("ERROR", f"Health check failed: {e}")

        # Quick API tests
        endpoints = [
            ("/api/boards/", "boards"),
            ("/api/boards/1", "board_detail"),
            ("/api/tickets/?board_id=1", "tickets"),
        ]

        for endpoint, name in endpoints:
            try:
                test_start = time.time()
                response = self.session.get(f"{self.base_url}{endpoint}", timeout=5)
                if response.status_code == 200:
                    response_times[name] = (time.time() - test_start) * 1000
                else:
                    error_count += 1
            except Exception:
                error_count += 1
                response_times[name] = -1  # Mark as failed

        # WebSocket status (simplified check)
        websocket_status = "UNKNOWN"
        try:
            # Just check if websocket endpoint responds
            response = self.session.get(f"{self.base_url}/ws/", timeout=2)
            websocket_status = "AVAILABLE" if response.status_code in [404, 405] else "DOWN"
        except:
            websocket_status = "DOWN"

        # Backend process status
        backend_status = "UNKNOWN"
        memory_mb = 0
        cpu_percent = 0
        uptime_seconds = 0

        try:
            import psutil

            for proc in psutil.process_iter(["pid", "name", "cmdline"]):
                try:
                    cmdline = " ".join(proc.info["cmdline"] or [])
                    if "uvicorn" in cmdline and "app.main:app" in cmdline:
                        p = psutil.Process(proc.info["pid"])
                        backend_status = "RUNNING"
                        memory_mb = p.memory_info().rss / 1024 / 1024
                        cpu_percent = p.cpu_percent()
                        uptime_seconds = time.time() - p.create_time()
                        break
                except:
                    continue
        except ImportError:
            pass

        return SystemHealth(
            api_status=api_status,
            websocket_status=websocket_status,
            backend_process_status=backend_status,
            response_times=response_times,
            error_count=error_count,
            uptime_seconds=uptime_seconds,
            memory_usage_mb=memory_mb,
            cpu_percent=cpu_percent,
            timestamp=datetime.now().isoformat(),
        )

    def run_api_tests(self) -> dict[str, Any]:
        """Run comprehensive API tests"""
        logger.info("🔧 Running API test suite...")

        test_results = {
            "timestamp": datetime.now().isoformat(),
            "tests": [],
            "summary": {"total": 0, "passed": 0, "failed": 0},
        }

        # Critical endpoints
        tests = [
            ("GET", "/health", "Health Check", 200),
            ("GET", "/api/boards/", "List Boards", 200),
            ("GET", "/api/boards/1", "Get Board 1", 200),
            ("GET", "/api/boards/default", "Get Default Board", 200),
            ("GET", "/api/tickets/?board_id=1", "List Board Tickets", 200),
        ]

        for method, endpoint, name, expected_status in tests:
            start_time = time.time()
            try:
                if method == "GET":
                    response = self.session.get(f"{self.base_url}{endpoint}", timeout=10)

                response_time = (time.time() - start_time) * 1000
                success = response.status_code == expected_status

                test_result = {
                    "name": name,
                    "method": method,
                    "endpoint": endpoint,
                    "expected_status": expected_status,
                    "actual_status": response.status_code,
                    "response_time_ms": round(response_time, 2),
                    "success": success,
                }

                test_results["tests"].append(test_result)
                test_results["summary"]["total"] += 1

                if success:
                    test_results["summary"]["passed"] += 1
                else:
                    test_results["summary"]["failed"] += 1
                    self.log_alert("WARNING", f"API test failed: {name} ({response.status_code})")

            except Exception as e:
                test_results["tests"].append(
                    {
                        "name": name,
                        "method": method,
                        "endpoint": endpoint,
                        "expected_status": expected_status,
                        "actual_status": "ERROR",
                        "response_time_ms": -1,
                        "success": False,
                        "error": str(e),
                    }
                )
                test_results["summary"]["total"] += 1
                test_results["summary"]["failed"] += 1
                self.log_alert("ERROR", f"API test error: {name} - {e}")

        # Calculate success rate
        total = test_results["summary"]["total"]
        passed = test_results["summary"]["passed"]
        test_results["summary"]["success_rate"] = (passed / total * 100) if total > 0 else 0

        return test_results

    def run_performance_tests(self, iterations: int = 5) -> dict[str, Any]:
        """Run performance benchmarks"""
        logger.info(f"📊 Running performance tests ({iterations} iterations)...")

        endpoints = [
            ("/api/boards/", "List Boards"),
            ("/api/boards/1", "Get Board Detail"),
            ("/api/tickets/?board_id=1", "List Tickets"),
        ]

        perf_results = {
            "timestamp": datetime.now().isoformat(),
            "iterations": iterations,
            "results": {},
            "alerts": [],
        }

        for endpoint, name in endpoints:
            times = []
            errors = 0

            for _i in range(iterations):
                start_time = time.time()
                try:
                    response = self.session.get(f"{self.base_url}{endpoint}", timeout=10)
                    if response.status_code == 200:
                        response_time = (time.time() - start_time) * 1000
                        times.append(response_time)
                    else:
                        errors += 1
                except Exception:
                    errors += 1

            if times:
                avg_time = sum(times) / len(times)
                perf_results["results"][name] = {
                    "avg_ms": round(avg_time, 2),
                    "min_ms": round(min(times), 2),
                    "max_ms": round(max(times), 2),
                    "successful_requests": len(times),
                    "failed_requests": errors,
                    "success_rate": (len(times) / iterations) * 100,
                }

                # Check performance thresholds
                if avg_time > self.performance_thresholds["response_time_ms"]:
                    alert = f"Slow response: {name} avg {avg_time:.1f}ms > {self.performance_thresholds['response_time_ms']}ms"
                    perf_results["alerts"].append(alert)
                    self.log_alert("WARNING", alert)
            else:
                perf_results["results"][name] = {"error": "All requests failed"}

        return perf_results

    def check_demo_readiness(self) -> dict[str, Any]:
        """Check if system is ready for Phase 1 demo"""
        health = self.get_system_health()

        readiness = {
            "overall_status": "READY",
            "checks": {},
            "blockers": [],
            "warnings": [],
            "recommendations": [],
        }

        # API availability check
        if health.api_status != "UP":
            readiness["checks"]["api"] = "FAIL"
            readiness["blockers"].append("API is not responding")
            readiness["overall_status"] = "NOT_READY"
        else:
            readiness["checks"]["api"] = "PASS"

        # Response time check
        avg_response_time = (
            sum([t for t in health.response_times.values() if t > 0])
            / len([t for t in health.response_times.values() if t > 0])
            if health.response_times
            else 0
        )
        if avg_response_time > self.performance_thresholds["response_time_ms"]:
            readiness["checks"]["performance"] = "WARN"
            readiness["warnings"].append(f"Slow response times: {avg_response_time:.1f}ms")
        else:
            readiness["checks"]["performance"] = "PASS"

        # Error rate check
        total_endpoints = len(health.response_times)
        failed_endpoints = len([t for t in health.response_times.values() if t < 0])
        error_rate = (failed_endpoints / total_endpoints * 100) if total_endpoints > 0 else 0

        if error_rate > self.performance_thresholds["error_rate_percent"]:
            readiness["checks"]["reliability"] = "FAIL"
            readiness["blockers"].append(f"High error rate: {error_rate:.1f}%")
            readiness["overall_status"] = "NOT_READY"
        else:
            readiness["checks"]["reliability"] = "PASS"

        # Memory check
        if health.memory_usage_mb > self.performance_thresholds["memory_mb"]:
            readiness["checks"]["memory"] = "WARN"
            readiness["warnings"].append(f"High memory usage: {health.memory_usage_mb:.1f}MB")
        else:
            readiness["checks"]["memory"] = "PASS"

        # Generate recommendations
        if readiness["overall_status"] == "READY":
            readiness["recommendations"].append("✅ System appears ready for demo")
        else:
            readiness["recommendations"].append("🚨 Address blockers before demo")

        if readiness["warnings"]:
            readiness["recommendations"].append("⚠️ Monitor warnings during demo")

        return readiness

    def generate_dashboard_report(self) -> str:
        """Generate human-readable dashboard report"""
        current_health = self.get_system_health()
        demo_readiness = self.check_demo_readiness()

        report_lines = [
            "🎯 QA AUTOMATION DASHBOARD - PHASE 1 DEMO STATUS",
            "=" * 60,
            "",
            f"📊 SYSTEM HEALTH ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})",
            f"   API Status: {current_health.api_status}",
            f"   WebSocket: {current_health.websocket_status}",
            f"   Backend Process: {current_health.backend_process_status}",
            f"   Memory Usage: {current_health.memory_usage_mb:.1f}MB",
            f"   CPU Usage: {current_health.cpu_percent:.1f}%",
            f"   Uptime: {current_health.uptime_seconds / 60:.1f} minutes",
            f"   Error Count: {current_health.error_count}",
            "",
            "⚡ RESPONSE TIMES",
        ]

        for endpoint, time_ms in current_health.response_times.items():
            status = "✅" if time_ms > 0 else "❌"
            time_str = f"{time_ms:.1f}ms" if time_ms > 0 else "FAILED"
            report_lines.append(f"   {status} {endpoint}: {time_str}")

        report_lines.extend(
            [
                "",
                f"🎭 DEMO READINESS: {demo_readiness['overall_status']}",
            ]
        )

        for check, status in demo_readiness["checks"].items():
            emoji = {"PASS": "✅", "WARN": "⚠️", "FAIL": "❌"}[status]
            report_lines.append(f"   {emoji} {check.title()}: {status}")

        if demo_readiness["blockers"]:
            report_lines.extend(["", "🚨 BLOCKERS:"])
            for blocker in demo_readiness["blockers"]:
                report_lines.append(f"   - {blocker}")

        if demo_readiness["warnings"]:
            report_lines.extend(["", "⚠️ WARNINGS:"])
            for warning in demo_readiness["warnings"]:
                report_lines.append(f"   - {warning}")

        if demo_readiness["recommendations"]:
            report_lines.extend(["", "💡 RECOMMENDATIONS:"])
            for rec in demo_readiness["recommendations"]:
                report_lines.append(f"   - {rec}")

        # Recent alerts
        if self.alerts:
            recent_alerts = [
                a
                for a in self.alerts
                if (datetime.now() - datetime.fromisoformat(a["timestamp"])).seconds < 300
            ]
            if recent_alerts:
                report_lines.extend(["", "🔔 RECENT ALERTS (Last 5 minutes):"])
                for alert in recent_alerts[-5:]:  # Last 5 alerts
                    time_ago = (datetime.now() - datetime.fromisoformat(alert["timestamp"])).seconds
                    report_lines.append(
                        f"   [{time_ago}s ago] {alert['level']}: {alert['message']}"
                    )

        return "\\n".join(report_lines)

    async def monitoring_loop(self):
        """Main monitoring loop"""
        logger.info("🚀 QA Automation Dashboard started")

        while self.is_running:
            try:
                current_time = time.time()

                # Health check (every 10 seconds)
                if (
                    current_time - self.last_test_runs.get("health_check", 0)
                    >= self.test_intervals["health_check"]
                ):
                    health = self.get_system_health()
                    self.health_history.append(health)

                    # Keep only last 360 health records (1 hour at 10s intervals)
                    if len(self.health_history) > 360:
                        self.health_history.pop(0)

                    self.last_test_runs["health_check"] = current_time

                # API tests (every 30 seconds)
                if (
                    current_time - self.last_test_runs.get("api_tests", 0)
                    >= self.test_intervals["api_tests"]
                ):
                    api_results = self.run_api_tests()
                    self.test_results.append(api_results)

                    # Keep only last 100 test results
                    if len(self.test_results) > 100:
                        self.test_results.pop(0)

                    self.last_test_runs["api_tests"] = current_time

                # Performance tests (every 60 seconds)
                if (
                    current_time - self.last_test_runs.get("performance_tests", 0)
                    >= self.test_intervals["performance_tests"]
                ):
                    perf_results = self.run_performance_tests(iterations=3)

                    # Save performance data
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    perf_file = f"/workspaces/agent-kanban/tests/performance_log_{timestamp}.json"
                    with open(perf_file, "w") as f:
                        json.dump(perf_results, f, indent=2)

                    self.last_test_runs["performance_tests"] = current_time

                # Generate and display dashboard (every 30 seconds)
                if current_time - self.last_test_runs.get("dashboard_report", 0) >= 30:
                    report = self.generate_dashboard_report()

                    # Clear screen and show report
                    os.system("clear" if os.name == "posix" else "cls")
                    print(report)

                    # Save dashboard state
                    dashboard_state = {
                        "health_history": [asdict(h) for h in self.health_history[-10:]],
                        "latest_test_results": self.test_results[-1] if self.test_results else None,
                        "demo_readiness": self.check_demo_readiness(),
                        "alerts": self.alerts[-10:],
                        "timestamp": datetime.now().isoformat(),
                    }

                    with open("/workspaces/agent-kanban/tests/dashboard_state.json", "w") as f:
                        json.dump(dashboard_state, f, indent=2)

                    self.last_test_runs["dashboard_report"] = current_time

                await asyncio.sleep(1)  # Check every second

            except Exception as e:
                self.log_alert("ERROR", f"Monitoring loop error: {e}")
                await asyncio.sleep(5)

    async def start_dashboard(self):
        """Start the monitoring dashboard"""
        self.is_running = True
        await self.monitoring_loop()

    def stop_dashboard(self):
        """Stop the monitoring dashboard"""
        self.is_running = False


async def main():
    """Main execution"""
    dashboard = QAAutomationDashboard()

    try:
        await dashboard.start_dashboard()
    except KeyboardInterrupt:
        logger.info("Dashboard stopped by user")
        dashboard.stop_dashboard()


if __name__ == "__main__":
    asyncio.run(main())
