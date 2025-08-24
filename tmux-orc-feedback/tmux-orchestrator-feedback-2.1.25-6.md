# TMUX Orchestrator Feedback - Version 2.1.25-6

## Issue: PM Using send-keys Instead of tmux-orc Pubsub

**Date:** 2025-08-20
**Version:** 2.1.25
**Severity:** HIGH - Communication Breakdown

### Problem Description

The spawned PM is using `tmux send-keys` commands instead of the tmux-orc pubsub messaging system. This results in:

- Messages not being properly submitted to the messaging queue
- Communication breakdown between orchestrator and PM
- Bypassing the orchestrator's messaging infrastructure

### Observed Behavior

- PM attempts to communicate using raw tmux commands
- Messages don't reach the pubsub system
- Orchestrator cannot track message delivery
- Team coordination fails

### Expected Behavior

PM should use:

```bash
tmux-orc pubsub publish --target [session:window] "message"
tmux-orc pubsub read --target [session:window]
```

Instead of:

```bash
tmux send-keys -t session:window "message" Enter
```

### Root Cause Analysis

The PM context may not be emphasizing the requirement to use tmux-orc commands exclusively. PMs might default to familiar tmux commands without understanding the orchestrator's messaging infrastructure.

### Recommended Fix

1. **Update PM Context:** Explicitly state in PM spawning context that ALL communication must use tmux-orc pubsub
2. **Add Warning:** Include warning about NOT using raw tmux commands
3. **Provide Examples:** Show correct pubsub syntax in PM briefings
4. **Validation:** Consider adding detection when agents use raw tmux commands

### Suggested PM Context Addition

```markdown
## CRITICAL: Communication Protocol
- NEVER use raw tmux commands (send-keys, etc.)
- ALL communication must use: tmux-orc pubsub publish/read
- Example: tmux-orc pubsub publish --target qa:1 "message"
- Raw tmux bypasses orchestrator messaging system
```

### Impact

- Communication failures between agents
- Orchestrator cannot monitor message delivery
- Team coordination breakdown
- Project delays due to messaging issues

### Workaround

Manually corrected PM via pubsub message explaining proper protocol.

---
**Status:** Reported
**Next Steps:** Update PM context documentation to prevent this issue
