#!/usr/bin/env python3
"""
Monitoring hack to actually check agent status since the daemon isn't working
"""

import subprocess
import time
from datetime import datetime


def get_pane_content(session, window):
    """Get the content of a tmux pane"""
    try:
        result = subprocess.run(
            ["tmux", "capture-pane", "-t", f"{session}:{window}", "-p"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        return result.stdout
    except:
        return ""


def check_agents():
    """Check all agent windows for activity"""
    agents = [
        ("agent-kanban-fullstack", "1", "Project-Manager"),
        ("agent-kanban-fullstack", "2", "Frontend-Developer"),
        ("agent-kanban-fullstack", "3", "Backend-Developer"),
    ]

    print(f"\n[{datetime.now()}] Checking agents...")

    for session, window, name in agents:
        content = get_pane_content(session, window)

        # Check if pane is empty (agent crashed)
        if not content.strip():
            print(f"  ⚠️  {name} appears to have CRASHED (empty pane)")
            # Try to notify PM
            subprocess.run(
                [
                    "tmux",
                    "send-keys",
                    "-t",
                    f"{session}:1",
                    f"ALERT: {name} has crashed and needs restart",
                    "C-m",
                ]
            )
        # Check if agent is at prompt (idle)
        elif "│ >" in content and "bypass permissions" in content:
            print(f"  ⚠️  {name} is IDLE at Claude prompt")
        else:
            # Check last few lines for activity
            last_lines = content.strip().split("\n")[-5:]
            print(
                f"  ✓  {name} last output: {last_lines[-1][:50]}..."
                if last_lines
                else f"  ?  {name} unknown state"
            )


if __name__ == "__main__":
    print("Starting monitoring hack (Ctrl+C to stop)...")
    print("Checking every 10 seconds...")

    while True:
        try:
            check_agents()
            time.sleep(10)
        except KeyboardInterrupt:
            print("\nMonitoring stopped")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(10)
