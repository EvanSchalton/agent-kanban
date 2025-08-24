# TMUX Orchestrator Feedback - Idle Detection Issue

## Version

tmux-orchestrator 2.1.28

## Issue Type

False Positive - Idle Agent Detection

## Description

The monitoring system is incorrectly reporting an agent as idle when it has an active background monitoring task running.

## Details

- **Agent**: Claude-frontend-recovery (bugfix-fresh:6)
- **Status**: Reported as IDLE
- **Actual State**: Running continuous monitoring loop
- **Evidence**:
  - Process running: `curl -s -o /dev/null -w 'Frontend response time: %{time_total}s\n' http://localhost:5173`
  - Background bash process active (bash_7)
  - Monitoring results visible in agent output

## Expected Behavior

Agents with active background tasks should not be flagged as idle, especially when:

1. They have active bash subprocesses
2. They are producing periodic output
3. They are performing monitoring duties

## Suggested Fix

Consider checking for:

- Active background processes (`jobs` command)
- Recent output activity (within monitoring interval)
- Running loops or continuous tasks

## Workaround Applied

Accepting the false positive as the agent is confirmed to be actively monitoring.

## Additional Occurrences

- **02:25 UTC**: QA validator (bugfix-fresh:4) also flagged as idle despite having monitoring tasks
- **02:27 UTC**: Both QA validator and Frontend-recovery flagged as idle simultaneously
- Pattern: Agents with long-running shell commands or monitoring loops consistently flagged as idle
- **Workarounds attempted**: Background jobs, periodic echo statements - NOT EFFECTIVE

## Impact

HIGH - Causes repeated PM interventions every 1-2 minutes, creating severe notification fatigue and making it impossible to identify genuinely idle agents. The idle detection appears to be checking for Claude AI activity rather than shell/bash activity.

## Root Cause Hypothesis

The idle detection may be monitoring Claude AI prompt/response activity rather than actual shell process activity. Agents running automated monitoring scripts appear idle because Claude isn't actively processing prompts, even though their assigned tasks are running.
