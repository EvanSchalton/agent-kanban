# IMMEDIATE DELETION LIST - PHASE 1

## Files Ready for Deletion (Verified)

### Test/Redundant Configs
- `playwright-no-server.config.ts` - Redundant test config
- `playwright-test-15175.config.ts` - Temporary test config

### Log Files
- `backend_log.txt` - Old backend log
- `dragdrop_test_backend.log` - Old test log
- `monitor-debug.log` - Debug log
- `performance-monitoring.log` - Performance log

### Safe to Delete After Verification
These files can be deleted after confirming newer backups exist:
- Check if `agent_kanban.backup.20250819_044314.db` has copy in backups/
- Check if `agent_kanban.db.backup` has copy in database_backups/

## Deletion Command
```bash
# Delete verified junk files
rm -f playwright-no-server.config.ts playwright-test-15175.config.ts
rm -f backend_log.txt dragdrop_test_backend.log
rm -f monitor-debug.log performance-monitoring.log

# Count reduction
echo "Files removed: 6-8 files"
```

## Post-Deletion Validation
Run: `./qa-quick-validation.sh`
