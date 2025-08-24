# Daemon Monitoring Messages Cause PM Context Collapse

## Root Cause Analysis: Why PM Got Stuck

### The Problem Chain

1. **Repetitive, non-actionable messages**: The daemon sends the same format message every 60 seconds
2. **Context pollution**: Each monitoring report takes up context space without providing new information
3. **PM loses purpose**: After many identical reports, PM forgets its management role and enters minimal response mode
4. **Feedback loop**: PM's minimal responses (".", "[X+ minutes]") don't trigger any daemon behavior change
5. **Context exhaustion**: PM showed "Context left until auto-compact: 7%" - near context limit

### Evidence

```
🔔 MONITORING REPORT - 13:31:26 UTC
⚠️ IDLE AGENTS:
- kanban-v2:1 (Claude-developer)
- kanban-v2:2 (Claude-developer)
- kanban-v2:3 (Claude-qa)
- kanban-v2:4 (Claude-developer)
Please review and take appropriate action.
```

This exact message repeated every 60 seconds for 540+ minutes, causing PM to respond with just "."

## Proposed Fixes

### 1. Progressive Message Escalation

Instead of repeating the same message, escalate the urgency and provide actionable guidance:

```python
# First notification (gentle reminder)
"📊 Team Status: 4 agents idle. Consider assigning tasks if available."

# Second notification (10 min later - instructive)
"⚠️ IDLE TEAM ALERT (10 min)
Your agents are waiting for instructions:
- Developer agents: Could work on features, bugs, or refactoring
- QA agent: Could run tests or review code
As PM, you should: Check project plan → Assign tasks → Monitor progress"

# Third notification (20 min later - urgent + role reminder)
"🚨 CRITICAL: Team idle for 20 minutes!
YOU ARE THE PROJECT MANAGER. Your responsibilities:
1. Read team plan in .tmux_orchestrator/planning/
2. Assign specific tasks to each agent
3. Use: tmux-orc agent send [target] '[task]'
Example: tmux-orc agent send project:1 'Implement user authentication'"

# Fourth+ notifications (30+ min - include recovery)
"🔴 SYSTEM INTERVENTION REQUIRED
Team paralyzed for 30+ minutes.
IMMEDIATE ACTIONS:
1. Stop what you're doing
2. List your agents: tmux-orc agent list
3. Send each agent a specific task NOW
If you're stuck, restart with: tmux-orc agent restart project:0"
```

### 2. Implement Backoff Strategy

```python
class IdleMonitor:
    def __init__(self):
        self.idle_notification_count = {}  # per PM
        self.notification_intervals = [60, 300, 600, 1800, 3600]  # 1m, 5m, 10m, 30m, 1h

    def should_notify(self, pm_target, last_notification_time):
        count = self.idle_notification_count.get(pm_target, 0)
        interval_index = min(count, len(self.notification_intervals) - 1)
        interval = self.notification_intervals[interval_index]

        if time.time() - last_notification_time >= interval:
            return True, count
        return False, count
```

### 3. Add PM Response Analysis

```python
def analyze_pm_response(self, pm_target, response):
    """Detect stuck PMs and take corrective action"""

    # Detect minimal responses
    minimal_patterns = [r'^\.+$', r'^\[\d+\+ minutes\.\]$', r'^ok$', r'^acknowledged$']

    if any(re.match(pattern, response.strip()) for pattern in minimal_patterns):
        self.minimal_response_count[pm_target] += 1

        if self.minimal_response_count[pm_target] >= 3:
            # PM is stuck - intervene
            self.send_recovery_message(pm_target)
            self.reset_pm_context(pm_target)
            return "stuck"
    else:
        # Reset counter on substantive response
        self.minimal_response_count[pm_target] = 0
        return "active"
```

### 4. Include Task Suggestions in Notifications

```python
def generate_task_suggestions(self, project_path):
    """Generate contextual task suggestions based on project state"""

    suggestions = []

    # Check for common next steps
    if not os.path.exists(f"{project_path}/backend/main.py"):
        suggestions.append("Backend Developer: Create FastAPI server structure")

    if os.path.exists(f"{project_path}/backend") and not self.is_process_running(18000):
        suggestions.append("Backend Developer: Start backend server on port 18000")

    if os.path.exists(f"{project_path}/frontend") and not self.is_process_running(15173):
        suggestions.append("Frontend Developer: Start React dev server")

    if os.path.exists(f"{project_path}/tests"):
        suggestions.append("QA Engineer: Run test suite and report results")

    return suggestions
```

### 5. PM Context Enhancement

Add to PM context:

```markdown
## Handling Monitoring Reports

CRITICAL: When you receive idle agent notifications:

1. **First notification**: Acknowledge briefly and assign tasks
2. **Repeated notifications**: You're failing as PM - take immediate action
3. **Never respond with just "." or "ok"** - always include your action plan

If you see "IDLE AGENTS" more than twice:
- STOP everything else
- List what each agent should do
- Send specific tasks immediately

Remember: Idle agents = Failed PM. Your #1 job is keeping the team productive.
```

## Implementation Priority

1. **HIGH**: Progressive message escalation (prevents context pollution)
2. **HIGH**: PM response analysis (detects and breaks stuck loops)
3. **MEDIUM**: Backoff strategy (reduces message frequency)
4. **MEDIUM**: Task suggestions (helps PM know what to assign)
5. **LOW**: Enhanced PM context (backup prevention)

## Why This Matters

The current implementation treats monitoring as a passive notification system, but it needs to be an **active management assistance system** that:

- Educates the PM on their role
- Provides actionable guidance
- Detects when PM is failing
- Intervenes to restore functionality

Without these fixes, the orchestration system will repeatedly fail when PMs lose context from notification spam.

---
*Version: tmux-orchestrator v2.1.18*
*Date: 2025-08-13*
*Issue: Monitoring message design causes PM context collapse*
*Solution: Progressive escalation with actionable guidance*
