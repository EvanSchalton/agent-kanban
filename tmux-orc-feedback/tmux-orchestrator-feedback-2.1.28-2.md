# TMUX Orchestrator Feedback - Version 2.1.28-2

## Date: 2025-08-20 11:06 UTC

## Issue: Agent Idle Detection with Claude Usage Limits

### Description

When agents hit their Claude usage limits, the idle monitoring system correctly detects them as idle and sends alerts to the PM. However, this creates unnecessary alerts when the idleness is due to external factors (usage limits) rather than actual task completion or blocking issues.

### Current Behavior

- Idle monitor detects agents as idle when they hit Claude usage limits
- PM receives monitoring alerts about idle agents
- All agents showing "Claude usage limit reached. Your limit will reset at 11am (UTC)"

### Suggested Enhancement

The idle monitoring system could be enhanced to:

1. Detect when agents are idle due to usage limits (parse for "Claude usage limit reached" messages)
2. Differentiate between:
   - Task-related idleness (needs PM intervention)
   - External limit idleness (informational only)
3. Provide different alert levels/messages for different idle reasons

### Example Implementation

```python
def check_agent_idle_reason(window_content):
    if "Claude usage limit reached" in window_content:
        return "EXTERNAL_LIMIT"
    elif "Waiting for" in window_content or "Standing by" in window_content:
        return "WAITING_FOR_INPUT"
    else:
        return "TASK_IDLE"
```

### Benefits

- Reduces alert fatigue for PMs
- Provides more actionable insights
- Better resource management during limit periods

### Workaround Used

PM manually checked each agent window to determine the cause of idleness and provided appropriate team coordination for the limit reset period.

## Version Information

- tmux-orchestrator version: 2.1.28 (based on process monitoring)
- Environment: VS Code devcontainer
- Session: bugfix-stable (7 windows)
