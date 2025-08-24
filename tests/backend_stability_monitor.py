#!/usr/bin/env python3
"""Backend Stability Monitor - Track crash patterns and health"""

import json
import time
from datetime import datetime, timedelta

import requests


class BackendStabilityMonitor:
    def __init__(self):
        self.base_url = "http://localhost:15173/api"
        self.health_data = {
            "checks": [],
            "errors": [],
            "response_times": [],
            "status": "MONITORING",
        }

    def health_check(self):
        """Perform comprehensive health check"""
        check_time = datetime.now()
        check_results = {
            "timestamp": check_time.isoformat(),
            "endpoints": {},
            "overall_health": "UNKNOWN",
        }

        # Test core endpoints
        endpoints = [
            ("GET", "/boards/", "Board listing"),
            ("GET", "/tickets/?board_id=1", "Ticket listing"),
            ("GET", "/tickets/1", "Individual ticket"),
        ]

        healthy_endpoints = 0
        total_endpoints = len(endpoints)

        for method, endpoint, description in endpoints:
            try:
                start_time = time.time()

                if method == "GET":
                    response = requests.get(f"{self.base_url}{endpoint}", timeout=10)

                response_time = (time.time() - start_time) * 1000  # ms

                endpoint_health = {
                    "status_code": response.status_code,
                    "response_time_ms": round(response_time, 2),
                    "description": description,
                    "healthy": response.status_code == 200,
                }

                if response.status_code == 200:
                    healthy_endpoints += 1
                    self.health_data["response_times"].append(response_time)
                else:
                    self.health_data["errors"].append(
                        {
                            "timestamp": check_time.isoformat(),
                            "endpoint": endpoint,
                            "status_code": response.status_code,
                            "error": response.text[:200],
                        }
                    )

                check_results["endpoints"][endpoint] = endpoint_health

            except requests.exceptions.ConnectionError:
                check_results["endpoints"][endpoint] = {
                    "status_code": 0,
                    "response_time_ms": 0,
                    "description": description,
                    "healthy": False,
                    "error": "Connection refused - Backend down",
                }
                self.health_data["errors"].append(
                    {
                        "timestamp": check_time.isoformat(),
                        "endpoint": endpoint,
                        "error": "Connection refused - Backend appears to be down",
                    }
                )

            except Exception as e:
                check_results["endpoints"][endpoint] = {
                    "status_code": 0,
                    "response_time_ms": 0,
                    "description": description,
                    "healthy": False,
                    "error": str(e),
                }
                self.health_data["errors"].append(
                    {"timestamp": check_time.isoformat(), "endpoint": endpoint, "error": str(e)}
                )

        # Overall health assessment
        health_percentage = (healthy_endpoints / total_endpoints) * 100

        if health_percentage == 100:
            check_results["overall_health"] = "EXCELLENT"
        elif health_percentage >= 80:
            check_results["overall_health"] = "GOOD"
        elif health_percentage >= 50:
            check_results["overall_health"] = "DEGRADED"
        else:
            check_results["overall_health"] = "CRITICAL"

        check_results["healthy_percentage"] = health_percentage
        self.health_data["checks"].append(check_results)

        return check_results

    def detect_crash_patterns(self):
        """Analyze error patterns to detect potential crashes"""
        patterns = {
            "connection_refused_count": 0,
            "timeout_count": 0,
            "5xx_errors": 0,
            "consecutive_failures": 0,
            "pattern_analysis": "STABLE",
        }

        consecutive_failures = 0
        recent_checks = self.health_data["checks"][-10:]  # Last 10 checks

        for check in recent_checks:
            if check["overall_health"] in ["CRITICAL", "DEGRADED"]:
                consecutive_failures += 1
            else:
                consecutive_failures = 0  # Reset on success

        # Analyze errors
        recent_errors = [
            e
            for e in self.health_data["errors"]
            if datetime.fromisoformat(e["timestamp"]) > datetime.now() - timedelta(minutes=30)
        ]

        for error in recent_errors:
            if "Connection refused" in error.get("error", ""):
                patterns["connection_refused_count"] += 1
            elif "timeout" in error.get("error", "").lower():
                patterns["timeout_count"] += 1
            elif error.get("status_code", 0) >= 500:
                patterns["5xx_errors"] += 1

        patterns["consecutive_failures"] = consecutive_failures

        # Pattern analysis
        if patterns["connection_refused_count"] > 3:
            patterns["pattern_analysis"] = "BACKEND_CRASHES"
        elif patterns["consecutive_failures"] > 5:
            patterns["pattern_analysis"] = "PERSISTENT_ISSUES"
        elif patterns["5xx_errors"] > 10:
            patterns["pattern_analysis"] = "INTERNAL_ERRORS"
        elif patterns["timeout_count"] > 5:
            patterns["pattern_analysis"] = "PERFORMANCE_ISSUES"
        else:
            patterns["pattern_analysis"] = "STABLE"

        return patterns

    def generate_stability_report(self):
        """Generate comprehensive stability report"""
        current_check = self.health_check()
        crash_patterns = self.detect_crash_patterns()

        avg_response_time = (
            (sum(self.health_data["response_times"]) / len(self.health_data["response_times"]))
            if self.health_data["response_times"]
            else 0
        )

        report = {
            "timestamp": datetime.now().isoformat(),
            "current_health": current_check,
            "stability_metrics": {
                "total_checks": len(self.health_data["checks"]),
                "total_errors": len(self.health_data["errors"]),
                "average_response_time_ms": round(avg_response_time, 2),
                "uptime_percentage": self._calculate_uptime(),
            },
            "crash_patterns": crash_patterns,
            "recent_errors": self.health_data["errors"][-5:],  # Last 5 errors
            "recommendations": self._generate_recommendations(crash_patterns, current_check),
        }

        return report

    def _calculate_uptime(self):
        """Calculate uptime percentage from health checks"""
        if not self.health_data["checks"]:
            return 0

        healthy_checks = sum(
            1
            for check in self.health_data["checks"]
            if check["overall_health"] in ["EXCELLENT", "GOOD"]
        )

        return (healthy_checks / len(self.health_data["checks"])) * 100

    def _generate_recommendations(self, patterns, current_check):
        """Generate recommendations based on stability analysis"""
        recommendations = []

        if patterns["pattern_analysis"] == "BACKEND_CRASHES":
            recommendations.append(
                "URGENT: Backend appears to be crashing frequently - check server logs"
            )

        elif patterns["pattern_analysis"] == "PERSISTENT_ISSUES":
            recommendations.append(
                "ATTENTION: Persistent issues detected - investigate API endpoint stability"
            )

        elif current_check["overall_health"] == "CRITICAL":
            recommendations.append(
                "CRITICAL: Backend health degraded - immediate attention required"
            )

        elif patterns["pattern_analysis"] == "STABLE":
            recommendations.append("GOOD: Backend stability appears normal")

        # Performance recommendations
        if patterns.get("timeout_count", 0) > 3:
            recommendations.append("Performance issue: Multiple timeouts detected")

        return recommendations

    def monitor_continuous(self, duration_minutes=5, check_interval_seconds=30):
        """Run continuous monitoring for specified duration"""
        print(f"🔍 Starting {duration_minutes}-minute backend stability monitoring...")
        print(f"Checking every {check_interval_seconds} seconds")
        print("=" * 60)

        start_time = datetime.now()
        end_time = start_time + timedelta(minutes=duration_minutes)

        while datetime.now() < end_time:
            check_result = self.health_check()

            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] "
                f"Health: {check_result['overall_health']} "
                f"({check_result['healthy_percentage']:.0f}% healthy)"
            )

            if check_result["overall_health"] in ["CRITICAL", "DEGRADED"]:
                print("  ⚠️ Issues detected in endpoints:")
                for endpoint, data in check_result["endpoints"].items():
                    if not data["healthy"]:
                        print(f"    - {endpoint}: {data.get('error', 'Unknown error')}")

            time.sleep(check_interval_seconds)

        # Final report
        final_report = self.generate_stability_report()

        print("\n" + "=" * 60)
        print("📊 STABILITY MONITORING COMPLETE")
        print("=" * 60)
        print(f"Duration: {duration_minutes} minutes")
        print(f"Total checks: {final_report['stability_metrics']['total_checks']}")
        print(f"Uptime: {final_report['stability_metrics']['uptime_percentage']:.1f}%")
        print(
            f"Avg response time: {final_report['stability_metrics']['average_response_time_ms']:.1f}ms"
        )
        print(f"Pattern analysis: {final_report['crash_patterns']['pattern_analysis']}")

        if final_report["recommendations"]:
            print("\n🔧 RECOMMENDATIONS:")
            for rec in final_report["recommendations"]:
                print(f"  • {rec}")

        return final_report


def quick_stability_check():
    """Quick stability check for immediate PM reporting"""
    monitor = BackendStabilityMonitor()
    report = monitor.generate_stability_report()

    print("⚡ QUICK BACKEND STABILITY CHECK")
    print("=" * 40)
    print(f"Current Health: {report['current_health']['overall_health']}")
    print(f"Healthy Endpoints: {report['current_health']['healthy_percentage']:.0f}%")
    print(f"Pattern Analysis: {report['crash_patterns']['pattern_analysis']}")

    if report["recent_errors"]:
        print(f"Recent Errors: {len(report['recent_errors'])}")
        for error in report["recent_errors"][-2:]:  # Last 2 errors
            print(f"  - {error['endpoint']}: {error['error'][:50]}...")
    else:
        print("Recent Errors: None")

    return report


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "quick":
        quick_stability_check()
    else:
        monitor = BackendStabilityMonitor()
        final_report = monitor.monitor_continuous(duration_minutes=2, check_interval_seconds=15)

        # Save report
        with open("/workspaces/agent-kanban/tests/backend_stability_report.json", "w") as f:
            json.dump(final_report, f, indent=2, default=str)
