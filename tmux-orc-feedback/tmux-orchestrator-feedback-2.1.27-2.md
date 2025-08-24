# TMUX Orchestrator Feedback - Version 2.1.27-2

## Issue: Agent Error Status Not Providing Details

### Description

When checking team status with `tmux-orc team status bugfix-stable`, 5 out of 6 agents show "Error" status with message "Has errors", but there's no way to get more details about what errors occurred.

### Commands Tried

- `tmux-orc project objective bugfix-stable` - Command doesn't exist
- `tmux-orc team objective bugfix-stable` - Command doesn't exist
- `tmux-orc session info bugfix-stable` - Command doesn't exist

### Requested Features

1. **Error Details Command**: Add `tmux-orc agent errors <session:window>` to show error logs
2. **Project Objective Command**: Add `tmux-orc session objective <session>` to view current objectives
3. **Agent Health Check**: Add `tmux-orc agent health <session:window>` for diagnostics

### Workaround Used

Had to manually send messages to each agent window to investigate status:

```bash
tmux send-keys -t bugfix-stable:1 "message" Enter
```

### Impact

- Cannot quickly diagnose why agents are in error state
- No visibility into what caused agents to fail
- Manual investigation required for each agent
- Slows down PM coordination significantly

## Issue: Monitoring Report Shows Idle Agents Without Context

### Description

Monitoring reports show idle agents but don't indicate if they're appropriately idle or stuck due to errors.

### Suggested Enhancement

Include agent status (Active/Idle/Error) in monitoring reports to help PMs distinguish between:

- Agents waiting for tasks (normal idle)
- Agents stuck due to errors (needs intervention)

## Positive Feedback

- Team status display is clean and informative
- Window numbering makes it easy to target specific agents
- Session management works well for persistent teams
