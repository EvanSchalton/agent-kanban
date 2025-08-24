# TMUX Orchestrator Feedback - Version 2.1.27-1

## Issue: Claude PM Agents Consistently Crashing After Spawn

**Date:** 2025-08-20
**Version:** 2.1.27 (upgraded from 2.1.25)
**Severity:** CRITICAL - System Unusable

### Problem Description

Claude PM agents consistently crash/disappear immediately after successful spawn, making the orchestrator system unusable for bug fixing coordination.

### Pattern Observed

1. `tmux-orc spawn pm` reports success: "✓ Successfully spawned pm agent"
2. Session created with Claude-pm window
3. Within minutes, Claude-pm window disappears
4. Only bash window remains in session
5. PM never responds to pubsub messages

### Multiple Spawn Attempts Failed

- **bugfix:1** - Crashed during active work (5 windows → 0)
- **bugfix-emergency:1** - Failed to properly spawn Claude agent
- **bugfix-v2:1** - Claude-pm window disappeared after spawn

### Impact on User

- User has critical blocking bugs ("resource not found" on card creation)
- No active team to provide support
- System effectively non-functional for coordination

### Environment Details

- Platform: Linux/devcontainer
- Updated: 2.1.25 → 2.1.27 (issue persists)
- Pubsub daemon: Running properly
- Session management: Working (sessions persist, but agents crash)

### Error Investigation Needed

1. Claude agent memory/resource issues?
2. Permission problems in devcontainer?
3. Configuration conflicts?
4. Claude Code integration issues?

### Immediate Workaround Required

Orchestrator needs direct bug fixing capability when PM agents are unstable.

### Recommended Fixes

1. Add Claude agent crash detection and logging
2. Implement automatic restart mechanism
3. Add fallback mode for direct orchestrator intervention
4. Improve error reporting for failed agents

---
**Status:** Critical - System cannot provide promised coordination
**Impact:** User blocked with critical bugs, no team support available
