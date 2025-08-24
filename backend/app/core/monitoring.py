"""
Memory and performance monitoring for backend stability
"""

import logging
import resource
import threading
import time
from datetime import datetime
from typing import Any, Dict, Optional

import psutil

logger = logging.getLogger(__name__)


class MemoryMonitor:
    """Monitor memory usage and detect potential leaks"""

    def __init__(self, alert_threshold_mb: int = 200, check_interval: int = 30):
        self.alert_threshold_mb = alert_threshold_mb
        self.check_interval = check_interval
        self.process = psutil.Process()
        self.monitoring = False
        self.monitor_thread = None
        self.memory_history = []
        self.max_history = 100  # Keep last 100 readings

    def get_memory_info(self) -> Dict[str, Any]:
        """Get current memory information"""
        try:
            # Process memory info
            memory_info = self.process.memory_info()
            memory_percent = self.process.memory_percent()

            # System memory info
            system_memory = psutil.virtual_memory()

            # Python resource usage
            resource_usage = resource.getrusage(resource.RUSAGE_SELF)

            memory_data = {
                "timestamp": datetime.utcnow().isoformat(),
                "process": {
                    "rss_mb": memory_info.rss / (1024 * 1024),  # Resident Set Size
                    "vms_mb": memory_info.vms / (1024 * 1024),  # Virtual Memory Size
                    "percent": memory_percent,
                    "num_threads": self.process.num_threads(),
                    "num_fds": self.process.num_fds(),  # File descriptors
                    "max_rss_mb": resource_usage.ru_maxrss / 1024,  # Linux: KB to MB
                },
                "system": {
                    "total_mb": system_memory.total / (1024 * 1024),
                    "available_mb": system_memory.available / (1024 * 1024),
                    "used_percent": system_memory.percent,
                },
                "connections": {
                    "tcp": len(self.process.connections(kind="tcp")),
                    "unix": len(self.process.connections(kind="unix")),
                },
            }

            return memory_data

        except Exception as e:
            logger.error(f"Failed to get memory info: {e}")
            return {"error": str(e)}

    def check_memory_threshold(self, memory_data: Dict[str, Any]) -> bool:
        """Check if memory usage exceeds threshold"""
        try:
            rss_mb = memory_data["process"]["rss_mb"]
            if rss_mb > self.alert_threshold_mb:
                logger.warning(
                    f"Memory threshold exceeded: {rss_mb:.1f}MB > {self.alert_threshold_mb}MB"
                )
                return True
            return False
        except KeyError:
            return False

    def detect_memory_leak(self) -> Optional[Dict[str, Any]]:
        """Detect potential memory leaks based on history"""
        if len(self.memory_history) < 10:
            return None

        # Get last 10 memory readings
        recent_memory = [entry["process"]["rss_mb"] for entry in self.memory_history[-10:]]

        # Check for consistent upward trend
        increasing_count = 0
        for i in range(1, len(recent_memory)):
            if recent_memory[i] > recent_memory[i - 1]:
                increasing_count += 1

        # If memory increased in 80% of recent readings, potential leak
        leak_threshold = 0.8
        if increasing_count >= len(recent_memory) * leak_threshold:
            first_reading = recent_memory[0]
            last_reading = recent_memory[-1]
            growth = last_reading - first_reading

            return {
                "detected": True,
                "growth_mb": growth,
                "readings": len(recent_memory),
                "increasing_trend": increasing_count / len(recent_memory),
                "current_mb": last_reading,
            }

        return {"detected": False}

    def monitor_loop(self):
        """Background monitoring loop"""
        logger.info(
            f"Memory monitoring started (threshold: {self.alert_threshold_mb}MB, "
            f"interval: {self.check_interval}s)"
        )

        while self.monitoring:
            try:
                memory_data = self.get_memory_info()

                if "error" not in memory_data:
                    # Store in history
                    self.memory_history.append(memory_data)

                    # Keep only recent history
                    if len(self.memory_history) > self.max_history:
                        self.memory_history = self.memory_history[-self.max_history :]

                    # Check threshold
                    if self.check_memory_threshold(memory_data):
                        # Log detailed memory info when threshold exceeded
                        rss = memory_data["process"]["rss_mb"]
                        threads = memory_data["process"]["num_threads"]
                        fds = memory_data["process"]["num_fds"]
                        logger.warning(
                            f"High memory usage: RSS={rss:.1f}MB, Threads={threads}, FDs={fds}"
                        )

                    # Check for memory leaks
                    leak_info = self.detect_memory_leak()
                    if leak_info and leak_info.get("detected"):
                        logger.critical(
                            f"Potential memory leak detected! "
                            f"Growth: {leak_info['growth_mb']:.1f}MB over "
                            f"{leak_info['readings']} readings"
                        )

                time.sleep(self.check_interval)

            except Exception as e:
                logger.error(f"Memory monitoring error: {e}")
                time.sleep(self.check_interval)

    def start_monitoring(self):
        """Start background memory monitoring"""
        if not self.monitoring:
            self.monitoring = True
            self.monitor_thread = threading.Thread(target=self.monitor_loop, daemon=True)
            self.monitor_thread.start()
            logger.info("Memory monitoring thread started")

    def stop_monitoring(self):
        """Stop background memory monitoring"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
            logger.info("Memory monitoring stopped")

    def get_memory_report(self) -> Dict[str, Any]:
        """Get comprehensive memory report"""
        current_info = self.get_memory_info()
        leak_info = self.detect_memory_leak()

        report = {
            "current": current_info,
            "leak_detection": leak_info,
            "history_count": len(self.memory_history),
            "threshold_mb": self.alert_threshold_mb,
            "monitoring": self.monitoring,
        }

        if self.memory_history:
            # Calculate memory trends
            memory_values = [entry["process"]["rss_mb"] for entry in self.memory_history]
            report["statistics"] = {
                "min_mb": min(memory_values),
                "max_mb": max(memory_values),
                "avg_mb": sum(memory_values) / len(memory_values),
                "latest_mb": memory_values[-1],
            }

        return report


# Global memory monitor instance
memory_monitor = MemoryMonitor(alert_threshold_mb=150, check_interval=30)


def get_system_health() -> Dict[str, Any]:
    """Get overall system health status"""
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=1)

        # Memory info
        memory = memory_monitor.get_memory_info()

        # Disk usage for current directory
        disk_usage = psutil.disk_usage(".")

        # Network connections
        process = psutil.Process()
        connections = len(process.connections())

        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "cpu_percent": cpu_percent,
            "memory": memory,
            "disk": {
                "total_gb": disk_usage.total / (1024**3),
                "used_gb": disk_usage.used / (1024**3),
                "free_gb": disk_usage.free / (1024**3),
                "percent": disk_usage.used / disk_usage.total * 100,
            },
            "network_connections": connections,
        }

        # Determine overall health
        issues = []
        if memory.get("process", {}).get("rss_mb", 0) > memory_monitor.alert_threshold_mb:
            issues.append("high_memory")
        if cpu_percent > 80:
            issues.append("high_cpu")
        if disk_usage.used / disk_usage.total > 0.9:
            issues.append("low_disk_space")

        if issues:
            health_status["status"] = "warning"
            health_status["issues"] = issues

        return health_status

    except Exception as e:
        return {"status": "error", "error": str(e), "timestamp": datetime.utcnow().isoformat()}
