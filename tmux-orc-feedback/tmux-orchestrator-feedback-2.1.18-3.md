# Aggressive PM Recovery Through Kill-and-Restart Strategy

## Enhanced Escalation Strategy with Automatic PM Termination

### Problem Summary

PMs get stuck in monitoring report loops, responding minimally while their entire team sits idle. Since the daemon already has PM recovery capabilities, we should use them aggressively.

## Proposed 3-Strike Escalation System

### Strike 1: Gentle Reminder (0-5 minutes idle)

```python
def first_notification(self, pm_target, idle_agents):
    """Gentle nudge - PM might be thinking/planning"""
    message = f"""
📊 Team Status Update
{len(idle_agents)} agents are idle and ready for tasks.
As PM, please assign work or confirm you're planning next steps.
"""
    return message
```

### Strike 2: Urgent Instruction (5-10 minutes idle)

```python
def second_notification(self, pm_target, idle_agents):
    """Direct instruction with role reminder"""
    message = f"""
⚠️ URGENT: Team idle for 10 minutes!

YOU ARE THE PROJECT MANAGER. Take action NOW:
1. Check project plan: .tmux_orchestrator/planning/
2. Assign specific tasks to each idle agent:
   {self.format_idle_list(idle_agents)}

Example commands:
- tmux-orc agent send {idle_agents[0]} "Implement user login"
- tmux-orc agent send {idle_agents[1]} "Write API tests"

If you don't act within 5 minutes, you will be replaced.
"""
    return message
```

### Strike 3: Termination (10+ minutes idle)

```python
def third_strike_termination(self, pm_target):
    """PM has failed - kill and let daemon recover"""

    # Log the failure
    self.logger.warning(f"PM at {pm_target} failed to manage team - terminating for recovery")

    # Send final warning (optional - might already be too late)
    final_message = """
🔴 PM PERFORMANCE FAILURE
You have been idle while your team waited for 15 minutes.
Initiating PM replacement protocol...
"""
    self.send_message(pm_target, final_message)

    # Kill the PM window
    time.sleep(2)  # Let them see the message
    self.kill_agent(pm_target)

    # Log for daemon recovery
    self.logger.info(f"PM at {pm_target} terminated - daemon will recover on next cycle")

    # Clear notification state for fresh start
    self.reset_pm_state(pm_target)
```

## Implementation Details

### Tracking System

```python
class PMPerformanceTracker:
    def __init__(self):
        self.pm_idle_start = {}  # When team first went idle
        self.pm_strike_count = {}  # Current escalation level
        self.pm_last_notification = {}  # Prevent spam
        self.pm_minimal_responses = {}  # Track ".", "ok", etc.

    def check_pm_performance(self, pm_target, idle_agents):
        """Main escalation logic"""

        # Initialize tracking
        if pm_target not in self.pm_idle_start:
            self.pm_idle_start[pm_target] = time.time()
            self.pm_strike_count[pm_target] = 0

        idle_duration = time.time() - self.pm_idle_start[pm_target]
        current_strike = self.pm_strike_count[pm_target]

        # Escalation thresholds (aggressive)
        if idle_duration < 300:  # < 5 min
            if current_strike == 0:
                self.send_first_notification(pm_target, idle_agents)
                self.pm_strike_count[pm_target] = 1

        elif idle_duration < 600:  # 5-10 min
            if current_strike == 1:
                self.send_second_notification(pm_target, idle_agents)
                self.pm_strike_count[pm_target] = 2

        else:  # 10+ min - PM has failed
            if current_strike == 2:
                self.terminate_pm(pm_target)
                # Reset everything - daemon will spawn new PM
                del self.pm_idle_start[pm_target]
                del self.pm_strike_count[pm_target]
```

### Response Quality Detection

```python
def analyze_pm_response(self, pm_target, captured_output):
    """Detect if PM is actually working or just acknowledging"""

    # Patterns indicating PM is stuck/not working
    minimal_patterns = [
        r'^\.+$',  # Just periods
        r'^ok\s*$',  # Just "ok"
        r'^acknowledged?\s*$',  # Just "acknowledged"
        r'^\[\d+\+ minutes\.\]$',  # Time counter
        r'^received\s*$',  # Just "received"
    ]

    # Check recent output for minimal responses
    recent_lines = captured_output.split('\n')[-5:]  # Last 5 lines
    minimal_count = sum(
        1 for line in recent_lines
        if any(re.match(p, line.strip(), re.I) for p in minimal_patterns)
    )

    if minimal_count >= 2:  # Multiple minimal responses
        # Accelerate to termination
        self.pm_strike_count[pm_target] = 2
        self.logger.warning(f"PM at {pm_target} giving minimal responses - accelerating to termination")
        return "minimal"

    # Check if PM is actually sending commands to agents
    command_patterns = [
        r'tmux-orc agent send',
        r'Assigning .* to',
        r'Task for .*:',
        r'Starting .*',
    ]

    has_commands = any(
        re.search(p, captured_output, re.I)
        for p in command_patterns
    )

    if has_commands:
        # PM is working - reset strikes
        self.pm_strike_count[pm_target] = 0
        self.pm_idle_start[pm_target] = time.time()
        return "active"

    return "idle"
```

## Benefits of This Approach

1. **Fast Recovery**: 10-minute maximum before a stuck PM is replaced
2. **Clear Expectations**: PM knows exactly what's expected and consequences
3. **Automatic Healing**: Leverages existing daemon recovery mechanism
4. **No Manual Intervention**: System self-heals without orchestrator involvement
5. **Learning Opportunity**: New PM spawned with context about why previous failed

## Configuration Options

```python
# Allow customization for different project types
class MonitorConfig:
    # Aggressive for production systems
    PRODUCTION = {
        "first_strike_minutes": 3,
        "second_strike_minutes": 6,
        "termination_minutes": 10,
        "notification_cooldown": 60,
    }

    # Relaxed for research/exploration projects
    RESEARCH = {
        "first_strike_minutes": 10,
        "second_strike_minutes": 20,
        "termination_minutes": 30,
        "notification_cooldown": 300,
    }

    # Current default (should be aggressive)
    DEFAULT = PRODUCTION
```

## Example Timeline

```
T+0min:   4 agents become idle
T+3min:   "📊 Team Status Update..." (Strike 1)
T+6min:   "⚠️ URGENT: Team idle for 6 minutes!" (Strike 2)
T+10min:  "🔴 PM PERFORMANCE FAILURE" → PM killed
T+11min:  Daemon detects missing PM → spawns new PM
T+12min:  New PM receives context and team list
T+13min:  Team productive again
```

## Critical Success Factor

The daemon MUST include in the new PM's context:

- Why the previous PM was terminated
- Current state of all agents
- Immediate tasks that need assignment
- Warning about performance expectations

```python
def generate_recovery_context(self, terminated_reason, idle_agents):
    return f"""
You are replacing a PM who was terminated for: {terminated_reason}

IMMEDIATE PRIORITIES:
1. Your team has been idle - assign tasks NOW
2. Idle agents: {', '.join(idle_agents)}
3. Check project plan and distribute work immediately

WARNING: You have 10 minutes to get the team working or you'll be replaced too.
"""
```

---
*Version: tmux-orchestrator v2.1.18*
*Date: 2025-08-13*
*Enhancement: Aggressive PM recovery through automated termination*
*Benefit: Self-healing orchestration system with no manual intervention*
