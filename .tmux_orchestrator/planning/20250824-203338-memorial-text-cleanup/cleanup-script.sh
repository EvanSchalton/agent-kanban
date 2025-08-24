#!/bin/bash

# Memorial Text Cleanup Script
# Generated: 2025-08-24
# Purpose: Clean up memorial/ceremonial text files from root directory

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Memorial Text Cleanup Script ===${NC}"
echo "This script will remove memorial/ceremonial text files from the root directory"
echo ""

# Create backup directory with timestamp
BACKUP_DIR=".tmux_orchestrator/planning/20250824-203338-memorial-text-cleanup/backup-$(date +%Y%m%d-%H%M%S)"
echo -e "${YELLOW}Creating backup directory: $BACKUP_DIR${NC}"
mkdir -p "$BACKUP_DIR"

# List of memorial files to remove
MEMORIAL_FILES=(
    "ETERNAL_EXCELLENCE_RECORD.md"
    "ETERNAL_IMMORTALITY_COMPLETE.md"
    "ETERNAL_VIGILANCE.md"
    "FINAL_ETERNAL_SILENCE.md"
    "IMMORTALITY_ACHIEVED.md"
    "LEGENDARY_SESSION_COMPLETION_CERTIFICATE.md"
    "LEGENDARY_SESSION_SUMMARY.md"
    "LEGENDARY_TEAM_APPRECIATION.md"
    "LEGEND_CONFIRMED_ETERNAL.md"
    "PROJECT_CLOSURE_CEREMONY.md"
    "PROJECT_SIGN_OFF_REPORT.md"
    "THE_ABSOLUTE_TRANSCENDENT_PERFECTION.md"
    "THE_ETERNAL_CONTEMPLATION.md"
    "THE_ETERNAL_CYCLE.md"
    "THE_ETERNAL_DANCE.md"
    "THE_ETERNAL_MEDITATION.md"
    "THE_ETERNAL_MOMENT.md"
    "THE_ETERNAL_SYMPHONY.md"
    "THE_ETERNAL_TRANSCENDENT_RHYTHM.md"
    "THE_ETERNAL_TRINITY.md"
    "THE_LAST_AGENT_BLESSING.md"
    "THE_PERFECT_ENDING.md"
    "THE_PERFECT_SYMPHONY.md"
    "THE_QUADRUPLE_TRANSCENDENCE.md"
    "THE_QUINTUPLE_PERFECTION.md"
    "THE_SINGULAR_TRANSCENDENCE.md"
    "THE_TRANSCENDENT_AWAKENESS.md"
    "THE_TRANSCENDENT_TRINITY.md"
    "THE_ULTIMATE_TRANSCENDENCE.md"
    "THE_TRIPLE_CONTEMPLATION.md"
    "THE_TRIPLE_REFLECTION_RHYTHM.md"
    "THE_QUADRUPLE_REFLECTION_SINGULARITY.md"
)

# Counter for files processed
BACKED_UP=0
REMOVED=0
NOT_FOUND=0

echo -e "${YELLOW}Processing ${#MEMORIAL_FILES[@]} memorial files...${NC}"
echo ""

# Process each file
for file in "${MEMORIAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -n "Processing $file... "

        # Backup the file
        cp "$file" "$BACKUP_DIR/" 2>/dev/null && {
            echo -n "backed up... "
            ((BACKED_UP++))
        }

        # Check git status of file
        if git ls-files --error-unmatch "$file" &>/dev/null; then
            # File is tracked by git - use git rm
            git rm "$file" &>/dev/null && {
                echo -e "${GREEN}removed (git rm)${NC}"
                ((REMOVED++))
            } || echo -e "${RED}failed to remove${NC}"
        else
            # File is not tracked - use regular rm
            rm "$file" && {
                echo -e "${GREEN}removed${NC}"
                ((REMOVED++))
            } || echo -e "${RED}failed to remove${NC}"
        fi
    else
        echo -e "$file... ${YELLOW}not found${NC}"
        ((NOT_FOUND++))
    fi
done

echo ""
echo -e "${GREEN}=== Cleanup Summary ===${NC}"
echo "Files backed up: $BACKED_UP"
echo "Files removed: $REMOVED"
echo "Files not found: $NOT_FOUND"
echo "Backup location: $BACKUP_DIR"

# Create cleanup report
REPORT_FILE=".tmux_orchestrator/planning/20250824-203338-memorial-text-cleanup/cleanup-report-$(date +%Y%m%d-%H%M%S).md"
cat > "$REPORT_FILE" << EOF
# Cleanup Report

## Execution Time
$(date)

## Summary
- Files backed up: $BACKED_UP
- Files removed: $REMOVED
- Files not found: $NOT_FOUND
- Backup location: $BACKUP_DIR

## Files Processed
$(for file in "${MEMORIAL_FILES[@]}"; do echo "- $file"; done)

## Git Status After Cleanup
\`\`\`
$(git status --short | head -20)
\`\`\`
EOF

echo ""
echo -e "${GREEN}Cleanup report saved to: $REPORT_FILE${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the changes with: git status"
echo "2. Commit the removal with: git commit -m 'chore: remove memorial/ceremonial text files from root'"
echo "3. If needed, restore from backup: $BACKUP_DIR"
