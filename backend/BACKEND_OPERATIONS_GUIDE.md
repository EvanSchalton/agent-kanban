# BACKEND TECHNICAL OPERATIONS GUIDE

Generated: Wed Aug 20 13:32:07 UTC 2025

**Agent Kanban Board - Backend Operations Manual**
**Version:** 1.0
**Environment:** Production-Ready

---

## 🎯 Overview

This guide provides comprehensive technical operations procedures for the Agent Kanban Board backend system. It covers deployment, monitoring, maintenance, troubleshooting, and emergency procedures for production environments.

### System Architecture

- **Framework:** FastAPI with Python 3.11+
- **Database:** SQLite with WAL journaling mode
- **WebSocket:** Socket.IO for real-time features
- **Authentication:** JWT with refresh tokens
- **Caching:** Redis (optional, graceful fallback)
- **Rate Limiting:** slowapi middleware
- **Monitoring:** Built-in health checks and metrics

---

## 🚀 Deployment Procedures

### Prerequisites

```bash
# System requirements
- Python 3.11 or higher
- SQLite 3.35+ (with WAL support)
- Redis (optional but recommended)
- 512MB+ RAM
- 1GB+ disk space
```

### Production Deployment

#### 1. Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd agent-kanban/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

#### 2. Environment Configuration

```bash
# Create production .env file
cat > .env << 'EOF'
# Database Configuration
DATABASE_URL=sqlite:///./agent_kanban.db
TESTING=false

# Security
SECRET_KEY=your-super-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS Configuration
CORS_ORIGINS=["https://your-frontend-domain.com"]

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379/0

# Monitoring
MEMORY_THRESHOLD_MB=150
MONITORING_INTERVAL_SECONDS=30

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_BURST=200
EOF
```

#### 3. Database Initialization

```bash
# Initialize database safely
python -c "from app.core.database import create_db_and_tables; create_db_and_tables()"

# Verify database integrity
python -c "import sqlite3; conn=sqlite3.connect('agent_kanban.db'); print('Tables:', [x[0] for x in conn.execute('SELECT name FROM sqlite_master WHERE type=\"table\";').fetchall()]); conn.close()"
```

#### 4. Production Server Start

```bash
# Using uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port 18000 --workers 4

# Or using the run script
python run.py

# With systemd service (recommended)
sudo systemctl start agent-kanban-backend
sudo systemctl enable agent-kanban-backend
```

### Docker Deployment (Alternative)

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 18000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "18000"]
```

```bash
# Build and run
docker build -t agent-kanban-backend .
docker run -p 18000:18000 -v $(pwd)/agent_kanban.db:/app/agent_kanban.db agent-kanban-backend
```

---

## 🔧 System Configuration

### Database Configuration

```python
# app/core/config.py - Key settings
DATABASE_URL = "sqlite:///./agent_kanban.db"
TESTING = False  # CRITICAL: Must be False in production

# SQLite optimization settings
PRAGMA foreign_keys=ON
PRAGMA journal_mode=WAL
PRAGMA synchronous=NORMAL
```

### Performance Tuning

```python
# Connection pool settings
pool_pre_ping=True
pool_recycle=3600  # 1 hour

# SQLite WAL mode benefits:
# - Better concurrency
# - Reduced write blocking
# - Atomic commits
```

### Security Configuration

```python
# JWT Configuration
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Rate limiting
@limiter.limit("100/minute")  # Standard endpoints
@limiter.limit("5/hour")      # Registration endpoint
```

---

## 📊 Monitoring & Health Checks

### Built-in Health Endpoints

```bash
# Basic health check
curl http://localhost:18000/health
# Response: {"status":"healthy","socketio":"available","cors":"enabled"}

# Detailed health check
curl http://localhost:18000/health/detailed

# Memory health check
curl http://localhost:18000/health/memory

# API health check
curl http://localhost:18000/api/health/
```

### System Monitoring Scripts

#### 1. Health Check Script

```bash
#!/bin/bash
# health_check.sh
BACKEND_URL="http://localhost:18000"

echo "=== Backend Health Check ==="
echo "Timestamp: $(date)"

# Check health endpoint
if curl -s "${BACKEND_URL}/health" | grep -q "healthy"; then
    echo "✅ Health endpoint: OK"
else
    echo "❌ Health endpoint: FAILED"
    exit 1
fi

# Check database
if [ -f "agent_kanban.db" ]; then
    DB_SIZE=$(ls -lh agent_kanban.db | awk '{print $5}')
    echo "✅ Database file: OK (${DB_SIZE})"
else
    echo "❌ Database file: MISSING"
    exit 1
fi

# Check WebSocket
if curl -s "${BACKEND_URL}/ws/stats" | grep -q "active_connections"; then
    echo "✅ WebSocket: OK"
else
    echo "⚠️  WebSocket: Limited functionality"
fi

echo "=== Health Check Complete ==="
```

#### 2. Performance Monitor

```bash
#!/bin/bash
# performance_monitor.sh

echo "=== Performance Monitoring ==="
echo "Timestamp: $(date)"

# Database size monitoring
DB_SIZE=$(ls -lh agent_kanban.db | awk '{print $5}')
echo "Database size: ${DB_SIZE}"

# WAL file monitoring
if [ -f "agent_kanban.db-wal" ]; then
    WAL_SIZE=$(ls -lh agent_kanban.db-wal | awk '{print $5}')
    echo "WAL file size: ${WAL_SIZE}"
fi

# Memory usage
MEMORY_USAGE=$(ps aux | grep uvicorn | grep -v grep | awk '{print $6}')
echo "Memory usage: ${MEMORY_USAGE}KB"

# Active connections
CONNECTIONS=$(curl -s http://localhost:18000/ws/stats | grep -o '"active_connections":[0-9]*' | cut -d':' -f2)
echo "Active WebSocket connections: ${CONNECTIONS}"

# Response time check
RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null http://localhost:18000/health)
echo "Health endpoint response time: ${RESPONSE_TIME}s"
```

### Monitoring Integration

#### Prometheus Metrics (Future Enhancement)

```python
# Example metrics endpoint implementation
from prometheus_client import Counter, Histogram, generate_latest

request_count = Counter('api_requests_total', 'Total API requests')
request_duration = Histogram('api_request_duration_seconds', 'API request duration')

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type="text/plain")
```

#### Log Monitoring

```bash
# Monitor application logs
tail -f backend.log | grep -E "(ERROR|WARNING|CRITICAL)"

# Monitor access logs
tail -f backend.log | grep -E "(POST|PUT|DELETE)" | grep -v "200"
```

---

## 🛠️ Maintenance Procedures

### Daily Maintenance

#### 1. Backup Database

```bash
#!/bin/bash
# daily_backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/daily"
mkdir -p "${BACKUP_DIR}"

# Create database backup
cp agent_kanban.db "${BACKUP_DIR}/agent_kanban_${DATE}.db"

# Compress older backups
find "${BACKUP_DIR}" -name "*.db" -mtime +1 -exec gzip {} \;

# Remove backups older than 30 days
find "${BACKUP_DIR}" -name "*.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_DIR}/agent_kanban_${DATE}.db"
```

#### 2. Database Maintenance

```bash
#!/bin/bash
# database_maintenance.sh

echo "=== Database Maintenance ==="

# SQLite optimization
sqlite3 agent_kanban.db "PRAGMA optimize;"
sqlite3 agent_kanban.db "VACUUM;"

# Check integrity
INTEGRITY=$(sqlite3 agent_kanban.db "PRAGMA integrity_check;")
if [ "$INTEGRITY" = "ok" ]; then
    echo "✅ Database integrity: OK"
else
    echo "❌ Database integrity: ISSUES FOUND"
    echo "$INTEGRITY"
fi

# WAL checkpoint
sqlite3 agent_kanban.db "PRAGMA wal_checkpoint(TRUNCATE);"

echo "Database maintenance completed"
```

### Weekly Maintenance

#### 1. Log Rotation

```bash
#!/bin/bash
# log_rotation.sh

LOG_DIR="logs"
mkdir -p "${LOG_DIR}/archive"

# Archive current logs
DATE=$(date +%Y%m%d)
mv backend.log "${LOG_DIR}/archive/backend_${DATE}.log"
mv backend_test.log "${LOG_DIR}/archive/backend_test_${DATE}.log"

# Compress archived logs
gzip "${LOG_DIR}/archive/backend_${DATE}.log"
gzip "${LOG_DIR}/archive/backend_test_${DATE}.log"

# Remove logs older than 90 days
find "${LOG_DIR}/archive" -name "*.gz" -mtime +90 -delete

# Restart logging (if using systemd)
sudo systemctl reload agent-kanban-backend
```

#### 2. Performance Analysis

```bash
#!/bin/bash
# performance_analysis.sh

echo "=== Weekly Performance Analysis ==="

# Database statistics
python3 << EOF
import sqlite3
conn = sqlite3.connect('agent_kanban.db')
cursor = conn.cursor()

tables = ['boards', 'tickets', 'comments', 'ticket_history', 'users']
for table in tables:
    cursor.execute(f'SELECT COUNT(*) FROM {table}')
    count = cursor.fetchone()[0]
    print(f'{table}: {count} records')

conn.close()
EOF

# Check for slow queries (if query logging enabled)
if [ -f "slow_queries.log" ]; then
    echo "Top slow queries:"
    sort -n slow_queries.log | tail -10
fi

# Analyze response times
if [ -f "access.log" ]; then
    echo "Average response times by endpoint:"
    awk '{print $7, $10}' access.log | sort | uniq -c | sort -nr | head -10
fi
```

### Monthly Maintenance

#### 1. Database Optimization

```bash
#!/bin/bash
# monthly_optimization.sh

echo "=== Monthly Database Optimization ==="

# Full database analysis
sqlite3 agent_kanban.db "ANALYZE;"

# Check for unused space
DB_SIZE_BEFORE=$(ls -l agent_kanban.db | awk '{print $5}')
sqlite3 agent_kanban.db "VACUUM;"
DB_SIZE_AFTER=$(ls -l agent_kanban.db | awk '{print $5}')

SPACE_SAVED=$((DB_SIZE_BEFORE - DB_SIZE_AFTER))
echo "Space reclaimed: ${SPACE_SAVED} bytes"

# Update table statistics
sqlite3 agent_kanban.db << EOF
UPDATE sqlite_stat1 SET stat = NULL;
ANALYZE;
EOF

echo "Database optimization completed"
```

#### 2. Security Audit

```bash
#!/bin/bash
# security_audit.sh

echo "=== Monthly Security Audit ==="

# Check for unusual activity
if [ -f "backend.log" ]; then
    echo "Failed authentication attempts:"
    grep -c "401" backend.log

    echo "Rate limiting triggers:"
    grep -c "429" backend.log

    echo "Server errors:"
    grep -c "500" backend.log
fi

# Check file permissions
echo "Database file permissions:"
ls -la agent_kanban.db*

# Check for old refresh tokens
python3 << EOF
import sqlite3
from datetime import datetime, timedelta

conn = sqlite3.connect('agent_kanban.db')
cursor = conn.cursor()

# Count expired refresh tokens
expired_date = datetime.now() - timedelta(days=7)
cursor.execute('SELECT COUNT(*) FROM refresh_tokens WHERE created_at < ?', (expired_date,))
expired_count = cursor.fetchone()[0]

print(f'Expired refresh tokens to cleanup: {expired_count}')

# Cleanup expired tokens
cursor.execute('DELETE FROM refresh_tokens WHERE created_at < ?', (expired_date,))
conn.commit()
conn.close()
EOF
```

---

## 🚨 Troubleshooting Guide

### Common Issues

#### 1. Database Connection Issues

**Symptoms:** `database is locked` errors

```bash
# Diagnosis
lsof agent_kanban.db  # Check what's using the database

# Resolution
# 1. Stop all processes using the database
sudo pkill -f uvicorn

# 2. Checkpoint WAL file
sqlite3 agent_kanban.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 3. Restart the application
uvicorn app.main:app --host 0.0.0.0 --port 18000
```

#### 2. High Memory Usage

**Symptoms:** Application consuming excessive memory

```bash
# Diagnosis
ps aux | grep uvicorn  # Check memory usage
cat /proc/$(pgrep uvicorn)/status | grep VmRSS

# Resolution
# 1. Check for memory leaks in logs
grep -i "memory" backend.log

# 2. Restart application with fresh memory space
sudo systemctl restart agent-kanban-backend

# 3. Monitor memory usage
watch "ps aux | grep uvicorn"
```

#### 3. Slow Response Times

**Symptoms:** API responses taking >1 second

```bash
# Diagnosis
curl -w "%{time_total}" -s -o /dev/null http://localhost:18000/api/boards/

# Check database performance
sqlite3 agent_kanban.db "EXPLAIN QUERY PLAN SELECT * FROM tickets WHERE board_id = 1;"

# Resolution
# 1. Optimize database
sqlite3 agent_kanban.db "PRAGMA optimize; VACUUM;"

# 2. Check for large result sets
sqlite3 agent_kanban.db "SELECT COUNT(*) FROM tickets;"

# 3. Review recent changes
git log --oneline -10
```

#### 4. WebSocket Connection Issues

**Symptoms:** Real-time features not working

```bash
# Diagnosis
curl -s http://localhost:18000/ws/stats

# Check WebSocket errors in logs
grep -i "websocket\|socketio" backend.log

# Resolution
# 1. Restart the application
sudo systemctl restart agent-kanban-backend

# 2. Check CORS settings
grep -i "cors" app/main.py

# 3. Test WebSocket connection
wscat -c ws://localhost:18000/ws/connect
```

### Emergency Procedures

#### 1. Complete System Failure

```bash
# Emergency recovery procedure
echo "=== EMERGENCY SYSTEM RECOVERY ==="

# 1. Stop all processes
sudo pkill -f uvicorn
sudo pkill -f python

# 2. Check system resources
df -h  # Disk space
free -h  # Memory
top -n 1  # CPU usage

# 3. Restore from backup if database is corrupted
if ! sqlite3 agent_kanban.db "PRAGMA integrity_check;" | grep -q "ok"; then
    echo "Database corrupted, restoring from backup..."
    LATEST_BACKUP=$(ls -t backups/*.db | head -1)
    cp "$LATEST_BACKUP" agent_kanban.db.corrupted
    cp "$LATEST_BACKUP" agent_kanban.db
fi

# 4. Restart application
uvicorn app.main:app --host 0.0.0.0 --port 18000 &

# 5. Verify recovery
sleep 5
curl http://localhost:18000/health
```

#### 2. Data Corruption Recovery

```bash
# Data corruption recovery
echo "=== DATA CORRUPTION RECOVERY ==="

# 1. Immediate backup of current state
cp agent_kanban.db agent_kanban_corrupted_$(date +%Y%m%d_%H%M%S).db

# 2. Try to recover data
sqlite3 agent_kanban.db ".recover" > recovered_data.sql

# 3. Create new database from recovered data
mv agent_kanban.db agent_kanban.db.broken
sqlite3 agent_kanban.db < recovered_data.sql

# 4. Run integrity check
sqlite3 agent_kanban.db "PRAGMA integrity_check;"

# 5. If recovery fails, restore from backup
if ! sqlite3 agent_kanban.db "PRAGMA integrity_check;" | grep -q "ok"; then
    echo "Recovery failed, restoring from backup..."
    LATEST_BACKUP=$(ls -t backups/*.db | head -1)
    cp "$LATEST_BACKUP" agent_kanban.db
fi
```

---

## 🔍 Log Analysis

### Log File Locations

```
backend/
├── backend.log              # Main application log
├── backend_test.log         # Test execution log
├── backend_log.txt          # Additional logging
├── logs/                    # Archived logs
│   └── archive/            # Compressed historical logs
└── access.log              # HTTP access log (if configured)
```

### Log Analysis Commands

```bash
# Monitor real-time logs
tail -f backend.log

# Find errors in logs
grep -E "(ERROR|CRITICAL)" backend.log

# Analyze request patterns
grep "INFO.*completed:" backend.log | awk '{print $8, $11}' | sort | uniq -c

# Check authentication failures
grep "401\|403" backend.log

# Monitor database operations
grep -E "(SELECT|INSERT|UPDATE|DELETE)" backend.log

# WebSocket activity
grep -E "(websocket|socketio)" backend.log
```

### Log Rotation Configuration

```bash
# /etc/logrotate.d/agent-kanban-backend
/workspaces/agent-kanban/backend/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 user user
    postrotate
        systemctl reload agent-kanban-backend
    endscript
}
```

---

## 🔒 Security Operations

### Security Checklist

- [ ] Environment variables secured (no secrets in code)
- [ ] Database file permissions restricted (600 or 644)
- [ ] HTTPS enabled in production
- [ ] CORS origins properly configured
- [ ] Rate limiting active
- [ ] JWT secrets rotated regularly
- [ ] Database backups encrypted
- [ ] Log files protected from unauthorized access

### Security Monitoring

```bash
# Monitor for suspicious activity
grep -E "(429|401|403|500)" backend.log | tail -20

# Check for SQL injection attempts
grep -i "select\|union\|drop\|delete" backend.log | grep -v "INFO"

# Monitor file access
lsof agent_kanban.db

# Check for unusual database size changes
ls -lh agent_kanban.db
```

### Incident Response

```bash
# Security incident response
echo "=== SECURITY INCIDENT RESPONSE ==="

# 1. Immediately backup current state
cp agent_kanban.db incident_backup_$(date +%Y%m%d_%H%M%S).db

# 2. Block suspicious IP addresses (if identified)
# iptables -A INPUT -s <suspicious_ip> -j DROP

# 3. Rotate all JWT secrets
# Update SECRET_KEY in .env file

# 4. Invalidate all active sessions
sqlite3 agent_kanban.db "DELETE FROM refresh_tokens;"

# 5. Enable additional logging
# Set LOG_LEVEL=DEBUG in environment

# 6. Document incident
echo "Incident report: $(date)" >> security_incidents.log
```

---

## 📈 Performance Optimization

### Database Optimization

```sql
-- Regular maintenance queries
PRAGMA optimize;
VACUUM;
ANALYZE;

-- Index optimization for common queries
CREATE INDEX IF NOT EXISTS idx_tickets_board_id ON tickets(board_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee);
CREATE INDEX IF NOT EXISTS idx_comments_ticket_id ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON ticket_history(ticket_id);
```

### Application Optimization

```python
# Connection pooling optimization
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600
)

# Query optimization
# Use select() with specific columns instead of SELECT *
# Implement pagination for large result sets
# Use lazy loading for related objects
```

### Monitoring Performance

```bash
# Monitor query performance
sqlite3 agent_kanban.db << 'EOF'
.timer on
SELECT COUNT(*) FROM tickets;
SELECT COUNT(*) FROM boards;
SELECT COUNT(*) FROM comments;
EOF

# Monitor API response times
ab -n 100 -c 10 http://localhost:18000/api/boards/

# Monitor WebSocket performance
echo "WebSocket connections:"
curl -s http://localhost:18000/ws/stats
```

---

## 🔄 Backup and Recovery

### Backup Strategy

```bash
# Daily automated backup
0 2 * * * /path/to/daily_backup.sh

# Weekly full system backup
0 1 * * 0 /path/to/weekly_backup.sh

# Monthly archive backup
0 0 1 * * /path/to/monthly_backup.sh
```

### Backup Scripts

```bash
#!/bin/bash
# comprehensive_backup.sh

BACKUP_DIR="/backup/agent-kanban/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Database backup
cp agent_kanban.db "$BACKUP_DIR/"
gzip "$BACKUP_DIR/agent_kanban.db"

# Configuration backup
cp .env "$BACKUP_DIR/"
cp -r app/core/ "$BACKUP_DIR/config/"

# Log backup
cp -r logs/ "$BACKUP_DIR/"

# Create backup manifest
echo "Backup created: $(date)" > "$BACKUP_DIR/manifest.txt"
echo "Database size: $(ls -lh agent_kanban.db | awk '{print $5}')" >> "$BACKUP_DIR/manifest.txt"
echo "Record counts:" >> "$BACKUP_DIR/manifest.txt"
sqlite3 agent_kanban.db << 'EOF' >> "$BACKUP_DIR/manifest.txt"
SELECT 'Boards: ' || COUNT(*) FROM boards;
SELECT 'Tickets: ' || COUNT(*) FROM tickets;
SELECT 'Comments: ' || COUNT(*) FROM comments;
SELECT 'Users: ' || COUNT(*) FROM users;
EOF

# Compress entire backup
tar -czf "${BACKUP_DIR}.tar.gz" -C "$(dirname $BACKUP_DIR)" "$(basename $BACKUP_DIR)"
rm -rf "$BACKUP_DIR"

echo "Backup completed: ${BACKUP_DIR}.tar.gz"
```

### Recovery Procedures

```bash
#!/bin/bash
# recovery_procedure.sh

BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    exit 1
fi

echo "=== SYSTEM RECOVERY ==="
echo "Recovering from: $BACKUP_FILE"

# 1. Stop application
sudo systemctl stop agent-kanban-backend

# 2. Backup current state
mv agent_kanban.db agent_kanban.db.pre_recovery_$(date +%Y%m%d_%H%M%S)

# 3. Extract backup
TEMP_DIR="/tmp/recovery_$(date +%s)"
mkdir -p "$TEMP_DIR"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# 4. Restore database
cp "$TEMP_DIR"/*/agent_kanban.db.gz ./
gunzip agent_kanban.db.gz

# 5. Restore configuration if needed
# cp "$TEMP_DIR"/*/.env ./

# 6. Verify database integrity
if sqlite3 agent_kanban.db "PRAGMA integrity_check;" | grep -q "ok"; then
    echo "✅ Database integrity verified"
else
    echo "❌ Database integrity check failed"
    exit 1
fi

# 7. Start application
sudo systemctl start agent-kanban-backend

# 8. Verify recovery
sleep 5
if curl -s http://localhost:18000/health | grep -q "healthy"; then
    echo "✅ Recovery successful"
else
    echo "❌ Recovery verification failed"
    exit 1
fi

# 9. Cleanup
rm -rf "$TEMP_DIR"

echo "=== RECOVERY COMPLETED ==="
```

---

## 📞 Support and Escalation

### Support Tiers

#### Tier 1: Automated Monitoring

- Health check failures
- High memory usage alerts
- Database corruption warnings
- WebSocket connection issues

#### Tier 2: Manual Investigation

- Performance degradation
- Authentication issues
- Data consistency problems
- Integration failures

#### Tier 3: Emergency Response

- Complete system failure
- Data corruption
- Security incidents
- Critical performance issues

### Contact Information

```
Development Team: dev-team@company.com
Operations Team: ops-team@company.com
Security Team: security@company.com

Emergency Hotline: +1-XXX-XXX-XXXX
Incident Management: incident@company.com
```

### Documentation References

- **API Documentation:** <http://localhost:18000/docs>
- **Database Schema:** `app/models/`
- **Configuration Files:** `app/core/config.py`
- **Health Checks:** `/health` endpoints
- **WebSocket Stats:** `/ws/stats`

---

## 📋 Operational Checklist

### Daily Operations

- [ ] Check health endpoints
- [ ] Monitor log files for errors
- [ ] Verify backup completion
- [ ] Check disk space usage
- [ ] Monitor memory consumption
- [ ] Verify WebSocket functionality

### Weekly Operations

- [ ] Run database maintenance
- [ ] Rotate log files
- [ ] Review performance metrics
- [ ] Check security alerts
- [ ] Verify backup integrity
- [ ] Update system dependencies

### Monthly Operations

- [ ] Full database optimization
- [ ] Security audit
- [ ] Performance analysis
- [ ] Backup strategy review
- [ ] Documentation updates
- [ ] System capacity planning

---

## 🎯 Conclusion

This operations guide provides comprehensive procedures for maintaining the Agent Kanban Board backend system. Regular adherence to these procedures will ensure optimal performance, security, and reliability.

### Key Success Metrics

- **Uptime:** >99.9%
- **Response Time:** <50ms average
- **Database Integrity:** 100%
- **Backup Success Rate:** 100%
- **Security Incidents:** 0

### Emergency Contacts

Keep this guide accessible during incidents. For immediate support, refer to the troubleshooting section and escalation procedures.

---

**Last Updated:** August 20, 2025
**Review Schedule:** Monthly
**Next Review:** September 20, 2025
