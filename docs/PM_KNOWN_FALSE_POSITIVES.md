# PM Advisory: Known False Positive Idle Alerts

## As of 02:28 UTC

### Agents to IGNORE in idle reports

1. **bugfix-fresh:4 (Claude-qa-validator)**
   - Actually running: System health monitoring
   - Check interval: 2 minutes

2. **bugfix-fresh:6 (Claude-frontend-recovery)**
   - Actually running: Frontend performance monitoring
   - Check interval: 60 seconds

### Why These Are False Positives

These agents are running automated monitoring loops via bash scripts. The idle detection system incorrectly flags them because it monitors Claude AI activity, not shell process activity.

### Verification Commands

To verify agents are actually working:

```bash
# Check QA validator
tmux capture-pane -t bugfix-fresh:4 -p | tail -10

# Check frontend recovery
tmux capture-pane -t bugfix-fresh:6 -p | tail -10

# Check for running monitoring processes
ps aux | grep -E "(curl|while)" | grep -v grep
```

### Real Issues to Watch For

- Agents stuck at Claude usage limits
- Agents with actual error messages
- Agents showing no bash processes running

### Status

This is a known TMUX Orchestrator bug documented in:

- `/workspaces/agent-kanban/tmux-orc-feedback/idle-detection-false-positive.md`

No further action needed on these specific idle alerts.
