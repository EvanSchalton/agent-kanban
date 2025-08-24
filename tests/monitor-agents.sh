#!/bin/bash

# Temporary monitoring script since tmux-orchestrator daemon is broken
# This script checks agent health and can restart dead agents

echo "=== Agent Health Check ==="
echo "Time: $(date)"
echo ""

DEAD_AGENTS=()

for session in $(tmux list-sessions -F '#{session_name}' 2>/dev/null); do
  windows=$(tmux list-windows -t "$session" -F '#{window_index}:#{window_name}' 2>/dev/null)

  while IFS= read -r window_info; do
    window_idx="${window_info%%:*}"
    window_name="${window_info#*:}"

    # Skip orchestrator windows
    if [[ "$window_name" == *"orchestrator"* ]]; then
      continue
    fi

    # Capture pane content and check for Claude prompt
    pane_content=$(tmux capture-pane -t "$session:$window_idx" -p 2>/dev/null | tail -5)

    if echo "$pane_content" | grep -q "for shortcuts$\|>.*$\|Claude Code.*$"; then
      echo "✓ $session:$window_idx ($window_name) - Claude RUNNING"
    else
      echo "✗ $session:$window_idx ($window_name) - Claude DEAD/MISSING"
      DEAD_AGENTS+=("$session:$window_idx:$window_name")
    fi
  done <<< "$windows"
done

echo ""
echo "=== Summary ==="
echo "Dead agents found: ${#DEAD_AGENTS[@]}"

if [ ${#DEAD_AGENTS[@]} -gt 0 ]; then
  echo ""
  echo "Dead agents:"
  for agent in "${DEAD_AGENTS[@]}"; do
    echo "  - $agent"
  done

  echo ""
  echo "To restart dead agents, run:"
  echo "  ./monitor-agents.sh --restart"
fi

# Restart functionality
if [ "$1" == "--restart" ] && [ ${#DEAD_AGENTS[@]} -gt 0 ]; then
  echo ""
  echo "=== Restarting Dead Agents ==="

  for agent_info in "${DEAD_AGENTS[@]}"; do
    IFS=':' read -r session window name <<< "$agent_info"
    echo "Restarting $session:$window ($name)..."

    # Send claude command to the window
    tmux send-keys -t "$session:$window" "claude" C-m
    sleep 1
  done

  echo "Restart commands sent. Wait a few seconds and run this script again to verify."
fi
