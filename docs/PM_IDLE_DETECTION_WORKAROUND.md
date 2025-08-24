# PM Idle Detection Workaround

## Issue

TMUX Orchestrator v2.1.28 incorrectly flags agents as idle when they have background monitoring tasks.

## Workaround Applied

Added periodic activity indicators to agents:

- QA Validator: 30-second activity pulse
- Frontend Recovery: 60-second monitoring reports

## Expected Result

Reduce false positive idle alerts by maintaining visible activity.

## Status

Monitoring effectiveness of workaround starting at 02:26 UTC.

## Next Steps

If false positives continue, will escalate to TMUX Orchestrator team for priority fix.
