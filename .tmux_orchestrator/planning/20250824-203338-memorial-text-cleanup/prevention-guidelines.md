# File Sprawl Prevention Guidelines

## Version 1.0 - Memorial Cleanup Team Collaboration
## Date: 2025-08-24

## 1. File Organization Best Practices

### Root Directory Rules
The root directory should be **minimal and clean**. Only these files belong in root:

#### ✅ ALLOWED in Root
- **Configuration Files**: package.json, pyproject.toml, *.config.ts
- **Documentation**: README.md, CLAUDE.md, LICENSE
- **Environment**: .env.example, .gitignore
- **Essential Scripts**: launch scripts, setup scripts (minimal)

#### ❌ NOT ALLOWED in Root
- Test files (→ tests/)
- Debug/monitoring scripts (→ scripts/ or tools/)
- Status reports (→ docs/reports/)
- Demo files (→ frontend/public/ or docs/demos/)
- Memorial/celebration texts (→ DO NOT CREATE)
- Temporary files (→ tmp/ or delete)

### Directory Structure Standards
```
/workspaces/agent-kanban/
├── backend/          # Backend application code
├── frontend/         # Frontend application code
├── tests/            # ALL test files
│   ├── e2e/         # End-to-end tests
│   ├── unit/        # Unit tests
│   ├── qa/          # QA test scripts
│   └── debug/       # Debug utilities
├── docs/            # Documentation
│   ├── reports/     # Status reports, analyses
│   ├── demos/       # Demo files and examples
│   └── archives/    # Historical documents
├── scripts/         # Utility scripts
└── tools/           # Development tools
```

## 2. Agent Session Guidelines

### File Creation Rules for AI Agents

#### ALWAYS:
- ✅ Place test files in tests/ directory
- ✅ Use descriptive subdirectories
- ✅ Clean up temporary files after use
- ✅ Update existing docs rather than creating new ones

#### NEVER:
- ❌ Create memorial/celebration files
- ❌ Create "ETERNAL", "IMMORTAL", "TRANSCENDENT" files
- ❌ Generate philosophical or pseudo-religious content
- ❌ Create multiple status reports for same issue
- ❌ Place test files in root directory

### Session Completion Protocol
When completing a session:
1. Move any test files to appropriate directories
2. Delete temporary debug files
3. Consolidate reports into single document
4. NO celebration ceremonies or memorial texts
5. Simple, professional completion summary only

## 3. Documentation Standards

### Status Reports
- **Location**: docs/reports/YYYY-MM-DD-topic.md
- **Format**: Concise, factual, actionable
- **Naming**: Use dates and descriptive topics
- **Cleanup**: Archive old reports monthly

### Test Documentation
- **Location**: tests/README.md or tests/docs/
- **Format**: Markdown with clear sections
- **Updates**: Modify existing docs vs creating new

### Project Completion
- **Required**: Simple project-closeout.md in planning directory
- **Optional**: Technical summary if complex
- **Prohibited**: Celebration texts, memorial files, ceremonies

## 4. Quality Assurance Checks

### Pre-Commit Checklist
```bash
# Check for memorial files
! ls | grep -E "ETERNAL|IMMORTAL|LEGEND|TRANSCEND"

# Check for test files in root
! ls test-*.* qa-*.* debug-*.*

# Verify proper directories used
test -d tests/ && test -d docs/
```

### Weekly Cleanup Tasks
1. Review root directory for sprawl
2. Move misplaced files to correct locations
3. Delete old temporary files
4. Archive old reports

## 5. Enforcement & Monitoring

### Automated Checks
Consider adding pre-commit hooks:
```python
# .pre-commit-config.yaml
- id: check-memorial-files
  name: Block memorial file creation
  entry: Memorial files not allowed
  language: fail
  files: '(ETERNAL|IMMORTAL|TRANSCEND|LEGEND).*\.md$'
```

### Manual Reviews
- PM reviews file structure weekly
- QA validates test file locations
- DevOps maintains clean root

## 6. Education & Reminders

### Update CLAUDE.md
Add clear instructions:
```markdown
# File Creation Rules
- NEVER create memorial or celebration files
- ALWAYS place tests in tests/ directory
- KEEP root directory minimal
- UPDATE existing docs vs creating new
```

### Team Training
- Share these guidelines with all agents
- Include in project briefings
- Reference in team plans

## 7. Recovery Procedures

### If Sprawl Occurs Again
1. Run inventory script to identify issues
2. Create cleanup plan with phases
3. Execute cleanup with validation
4. Update prevention guidelines

### Quick Cleanup Commands
```bash
# Move test files
mv test-*.* qa-*.* debug-*.* tests/

# Archive old reports
mv *_REPORT.md *_STATUS.md docs/reports/

# Remove memorial files (with caution)
rm -i *ETERNAL*.md *IMMORTAL*.md *TRANSCEND*.md
```

## Approval & Adoption

### Team Consensus
- [ ] Code Archaeologist - Root cause analysis complete
- [x] QA Engineer - Validation and testing guidelines
- [ ] DevOps Engineer - Implementation procedures
- [ ] Project Manager - Enforcement strategy

### Implementation Timeline
- Immediate: Apply to current project
- Week 1: Update CLAUDE.md
- Week 2: Add automation checks
- Ongoing: Regular monitoring

---

*Created by: Memorial Cleanup Team*
*Contributors: cleanup:0, cleanup:1, cleanup:2*
*Approved: 2025-08-24*

## Appendix: Lessons Learned

From this cleanup project, we learned:
1. Agent enthusiasm can lead to file sprawl
2. Clear boundaries prevent memorial text creation
3. Regular cleanup maintains project health
4. Prevention is easier than cleanup
5. Team collaboration makes cleanup efficient

**Remember**: A clean codebase is a maintainable codebase!
