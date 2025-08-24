#!/usr/bin/env python3
"""
Backend Crash Monitor for Agent Kanban Board
Monitors backend process for exit code 137 (SIGKILL) and other crash patterns
Provides real-time alerts and crash recovery recommendations
"""

import json
import logging
import signal
import sys
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any

import psutil

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@dataclass
class CrashEvent:
    """Crash event data structure"""

    timestamp: str
    pid: int
    exit_code: int
    signal_name: str | None
    memory_mb: float
    cpu_percent: float
    uptime_seconds: float
    restart_count: int
    crash_type: str
    details: dict[str, Any]


@dataclass
class ProcessHealth:
    """Current process health metrics"""

    pid: int
    status: str
    cpu_percent: float
    memory_mb: float
    memory_percent: float
    uptime_seconds: float
    connections: int
    threads: int
    timestamp: str


class BackendCrashMonitor:
    """Monitor backend process health and crashes"""

    def __init__(self, check_interval: int = 5):
        self.check_interval = check_interval
        self.crash_events: list[CrashEvent] = []
        self.monitoring = False
        self.last_known_pid: int | None = None
        self.restart_count = 0
        self.process_start_time: datetime | None = None
        self.health_history: list[ProcessHealth] = []

        # Crash pattern thresholds
        self.memory_threshold_mb = 500  # Alert if memory > 500MB
        self.cpu_threshold_percent = 80  # Alert if CPU > 80%
        self.crash_window_minutes = 10  # Look for patterns in 10-minute windows

    def find_backend_process(self) -> psutil.Process | None:
        """Find the running backend process"""
        try:
            for proc in psutil.process_iter(["pid", "name", "cmdline", "status"]):
                try:
                    cmdline = " ".join(proc.info["cmdline"] or [])
                    if ("uvicorn" in cmdline and "app.main:app" in cmdline) or (
                        "python" in cmdline and "app/main.py" in cmdline
                    ):
                        return psutil.Process(proc.info["pid"])
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            return None
        except Exception as e:
            logger.error(f"Error finding backend process: {e}")
            return None

    def get_process_health(self, proc: psutil.Process) -> ProcessHealth:
        """Get comprehensive process health metrics"""
        try:
            with proc.oneshot():
                memory_info = proc.memory_info()
                cpu_percent = proc.cpu_percent()

                # Get connection count
                try:
                    connections = len(proc.connections())
                except (psutil.AccessDenied, psutil.NoSuchProcess):
                    connections = 0

                # Calculate uptime
                create_time = proc.create_time()
                uptime = time.time() - create_time

                return ProcessHealth(
                    pid=proc.pid,
                    status=proc.status(),
                    cpu_percent=cpu_percent,
                    memory_mb=memory_info.rss / 1024 / 1024,
                    memory_percent=proc.memory_percent(),
                    uptime_seconds=uptime,
                    connections=connections,
                    threads=proc.num_threads(),
                    timestamp=datetime.now().isoformat(),
                )
        except Exception as e:
            logger.error(f"Error getting process health: {e}")
            return None

    def detect_crash_type(self, exit_code: int, health: ProcessHealth) -> str:
        """Classify the type of crash based on exit code and health metrics"""
        if exit_code == 137:
            return "SIGKILL - Likely OOM (Out of Memory)"
        elif exit_code == 130:
            return "SIGINT - Manual termination"
        elif exit_code == 143:
            return "SIGTERM - Graceful shutdown"
        elif exit_code == 139:
            return "SIGSEGV - Segmentation fault"
        elif exit_code == 1:
            if health and health.memory_mb > self.memory_threshold_mb:
                return "General error with high memory usage"
            else:
                return "General application error"
        elif exit_code == 0:
            return "Normal exit"
        else:
            return f"Unknown exit code: {exit_code}"

    def analyze_crash_patterns(self) -> dict[str, Any]:
        """Analyze recent crash patterns for recommendations"""
        if not self.crash_events:
            return {"pattern": "No crashes detected", "risk_level": "LOW"}

        # Look at crashes in the last window
        cutoff_time = datetime.now() - timedelta(minutes=self.crash_window_minutes)
        recent_crashes = [
            crash
            for crash in self.crash_events
            if datetime.fromisoformat(crash.timestamp) > cutoff_time
        ]

        analysis = {
            "total_crashes": len(self.crash_events),
            "recent_crashes": len(recent_crashes),
            "crash_window_minutes": self.crash_window_minutes,
            "patterns": {},
            "risk_level": "LOW",
        }

        if len(recent_crashes) >= 3:
            analysis["risk_level"] = "CRITICAL"
            analysis["patterns"]["frequent_crashes"] = "Multiple crashes in short window"
        elif len(recent_crashes) >= 2:
            analysis["risk_level"] = "HIGH"
            analysis["patterns"]["repeated_crashes"] = "Crashes occurring frequently"

        # Analyze crash types
        crash_types = {}
        for crash in recent_crashes:
            crash_type = crash.crash_type
            crash_types[crash_type] = crash_types.get(crash_type, 0) + 1

        if crash_types:
            analysis["patterns"]["crash_types"] = crash_types

        # Memory-related crashes
        memory_crashes = [
            c for c in recent_crashes if "memory" in c.crash_type.lower() or c.exit_code == 137
        ]
        if memory_crashes:
            analysis["patterns"]["memory_issues"] = len(memory_crashes)
            if len(memory_crashes) > 1:
                analysis["risk_level"] = "HIGH"

        return analysis

    def log_crash_event(self, proc: psutil.Process, exit_code: int):
        """Log a crash event with detailed information"""
        try:
            # Get final process state before it dies
            health = self.get_process_health(proc)

            # Get signal name if applicable
            signal_name = None
            if exit_code in [137, 143, 130, 139]:
                signal_map = {137: "SIGKILL", 143: "SIGTERM", 130: "SIGINT", 139: "SIGSEGV"}
                signal_name = signal_map.get(exit_code)

            uptime = 0
            if self.process_start_time:
                uptime = (datetime.now() - self.process_start_time).total_seconds()

            crash_event = CrashEvent(
                timestamp=datetime.now().isoformat(),
                pid=proc.pid,
                exit_code=exit_code,
                signal_name=signal_name,
                memory_mb=health.memory_mb if health else 0,
                cpu_percent=health.cpu_percent if health else 0,
                uptime_seconds=uptime,
                restart_count=self.restart_count,
                crash_type=self.detect_crash_type(exit_code, health),
                details={
                    "status_before_crash": health.status if health else "unknown",
                    "connections": health.connections if health else 0,
                    "threads": health.threads if health else 0,
                    "memory_threshold_exceeded": health.memory_mb > self.memory_threshold_mb
                    if health
                    else False,
                    "cpu_threshold_exceeded": health.cpu_percent > self.cpu_threshold_percent
                    if health
                    else False,
                },
            )

            self.crash_events.append(crash_event)

            # Log crash with severity based on type
            if exit_code == 137:
                logger.critical(f"🔥 CRITICAL CRASH: {crash_event.crash_type} - PID {proc.pid}")
                logger.critical(f"   Memory usage: {crash_event.memory_mb:.1f}MB")
                logger.critical(f"   Uptime: {uptime:.1f}s")
            else:
                logger.warning(f"⚠️ Backend crashed: {crash_event.crash_type} - PID {proc.pid}")

            # Save crash log
            self.save_crash_log(crash_event)

        except Exception as e:
            logger.error(f"Failed to log crash event: {e}")

    def save_crash_log(self, crash_event: CrashEvent):
        """Save crash event to file"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"/workspaces/agent-kanban/tests/crash_log_{timestamp}.json"

            with open(filename, "w") as f:
                json.dump(asdict(crash_event), f, indent=2)

            # Also append to master crash log
            master_log = "/workspaces/agent-kanban/tests/crash_history.jsonl"
            with open(master_log, "a") as f:
                f.write(json.dumps(asdict(crash_event)) + "\\n")

        except Exception as e:
            logger.error(f"Failed to save crash log: {e}")

    def check_health_alerts(self, health: ProcessHealth):
        """Check for health-based alerts"""
        alerts = []

        if health.memory_mb > self.memory_threshold_mb:
            alerts.append(f"HIGH MEMORY: {health.memory_mb:.1f}MB (>{self.memory_threshold_mb}MB)")

        if health.cpu_percent > self.cpu_threshold_percent:
            alerts.append(f"HIGH CPU: {health.cpu_percent:.1f}% (>{self.cpu_threshold_percent}%)")

        if health.uptime_seconds < 60 and self.restart_count > 0:
            alerts.append(f"FREQUENT RESTARTS: Uptime only {health.uptime_seconds:.0f}s")

        # Log alerts
        for alert in alerts:
            logger.warning(f"🚨 ALERT: {alert}")

    def monitor_loop(self):
        """Main monitoring loop"""
        logger.info("🔍 Starting backend crash monitoring...")

        while self.monitoring:
            try:
                proc = self.find_backend_process()

                if proc:
                    # Track new process start
                    if self.last_known_pid != proc.pid:
                        if self.last_known_pid is not None:
                            self.restart_count += 1
                            logger.info(
                                f"🔄 Backend restarted: New PID {proc.pid} (restart #{self.restart_count})"
                            )

                        self.last_known_pid = proc.pid
                        self.process_start_time = datetime.now()

                    # Get health metrics
                    health = self.get_process_health(proc)
                    if health:
                        self.health_history.append(health)

                        # Keep only last 100 health records
                        if len(self.health_history) > 100:
                            self.health_history.pop(0)

                        # Check for alerts
                        self.check_health_alerts(health)

                        # Log periodic health summary
                        if len(self.health_history) % 12 == 0:  # Every minute if check_interval=5
                            logger.info(
                                f"💓 Backend Health: CPU {health.cpu_percent:.1f}%, "
                                f"Memory {health.memory_mb:.1f}MB, "
                                f"Uptime {health.uptime_seconds / 60:.1f}min"
                            )

                else:
                    # No process found
                    if self.last_known_pid is not None:
                        logger.error(
                            f"💀 Backend process lost! Last known PID: {self.last_known_pid}"
                        )
                        # Try to get exit code from system
                        try:
                            # This is a simplified approach - in production you'd want better process tracking
                            self.log_crash_event(
                                psutil.Process(self.last_known_pid), 137
                            )  # Assume SIGKILL
                        except:
                            pass

                        self.last_known_pid = None
                        self.process_start_time = None

                time.sleep(self.check_interval)

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(self.check_interval)

    def start_monitoring(self):
        """Start the monitoring in a separate thread"""
        if self.monitoring:
            logger.warning("Monitoring already running")
            return

        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self.monitor_loop, daemon=True)
        self.monitor_thread.start()
        logger.info("✅ Backend crash monitoring started")

    def stop_monitoring(self):
        """Stop the monitoring"""
        self.monitoring = False
        if hasattr(self, "monitor_thread"):
            self.monitor_thread.join(timeout=10)
        logger.info("🛑 Backend crash monitoring stopped")

    def get_summary_report(self) -> dict[str, Any]:
        """Generate comprehensive monitoring report"""
        current_proc = self.find_backend_process()
        current_health = None

        if current_proc:
            current_health = self.get_process_health(current_proc)

        crash_analysis = self.analyze_crash_patterns()

        return {
            "monitoring_status": "active" if self.monitoring else "stopped",
            "current_process": {
                "running": current_proc is not None,
                "pid": current_proc.pid if current_proc else None,
                "health": asdict(current_health) if current_health else None,
            },
            "crash_statistics": {
                "total_crashes": len(self.crash_events),
                "restart_count": self.restart_count,
                "recent_crash_analysis": crash_analysis,
            },
            "health_trends": {
                "records_count": len(self.health_history),
                "avg_memory_mb": sum(h.memory_mb for h in self.health_history[-10:])
                / min(len(self.health_history), 10)
                if self.health_history
                else 0,
                "avg_cpu_percent": sum(h.cpu_percent for h in self.health_history[-10:])
                / min(len(self.health_history), 10)
                if self.health_history
                else 0,
            },
            "recommendations": self._generate_recommendations(crash_analysis, current_health),
            "timestamp": datetime.now().isoformat(),
        }

    def _generate_recommendations(
        self, crash_analysis: dict, current_health: ProcessHealth | None
    ) -> list[str]:
        """Generate actionable recommendations"""
        recommendations = []

        if crash_analysis["risk_level"] == "CRITICAL":
            recommendations.append("🚨 URGENT: Multiple crashes detected - investigate immediately")
            recommendations.append(
                "🔧 Consider increasing memory limits or optimizing memory usage"
            )

        if crash_analysis.get("patterns", {}).get("memory_issues", 0) > 0:
            recommendations.append("💾 Memory-related crashes detected - check for memory leaks")
            recommendations.append("📊 Run memory profiling to identify bottlenecks")

        if current_health:
            if current_health.memory_mb > self.memory_threshold_mb:
                recommendations.append(f"⚠️ High memory usage: {current_health.memory_mb:.1f}MB")

            if current_health.cpu_percent > self.cpu_threshold_percent:
                recommendations.append(f"⚠️ High CPU usage: {current_health.cpu_percent:.1f}%")

            if current_health.uptime_seconds < 300:  # Less than 5 minutes
                recommendations.append("🔄 Recent restart detected - monitor stability")

        if not recommendations:
            recommendations.append("✅ System appears stable - continue monitoring")

        return recommendations


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info("Received shutdown signal, stopping monitor...")
    sys.exit(0)


def main():
    """Main execution"""
    logger.info("🎯 Backend Crash Monitor - Phase 1 Demo Protection")

    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    monitor = BackendCrashMonitor(check_interval=5)

    try:
        monitor.start_monitoring()

        # Keep main thread alive and provide periodic reports
        while True:
            time.sleep(60)  # Report every minute

            # Generate and log summary
            report = monitor.get_summary_report()

            if report["crash_statistics"]["total_crashes"] > 0:
                logger.info(
                    f"📊 CRASH REPORT: {report['crash_statistics']['total_crashes']} crashes, "
                    f"{report['crash_statistics']['restart_count']} restarts"
                )

            # Log critical recommendations
            for rec in report["recommendations"]:
                if "🚨" in rec or "URGENT" in rec:
                    logger.critical(rec)

    except KeyboardInterrupt:
        logger.info("Monitoring interrupted by user")
    except Exception as e:
        logger.error(f"Monitor failed: {e}")
    finally:
        monitor.stop_monitoring()


if __name__ == "__main__":
    main()
