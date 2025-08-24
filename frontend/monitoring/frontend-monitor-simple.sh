#!/bin/bash

# Frontend Emergency Monitoring Script
# Tests critical flows every 10 minutes

FRONTEND_URL="http://localhost:5173"
LOG_FILE="/tmp/frontend-monitor.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

test_frontend_health() {
    log_message "🔍 FRONTEND HEALTH CHECK STARTING"

    # Test 1: Server Response
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
    if [ "$HTTP_STATUS" = "200" ]; then
        log_message "✅ Frontend server responding (HTTP $HTTP_STATUS)"
    else
        log_message "🚨 ANOMALY: Frontend server not responding (HTTP $HTTP_STATUS)"
        return 1
    fi

    # Test 2: Page Content Check
    PAGE_CONTENT=$(curl -s "$FRONTEND_URL")

    if echo "$PAGE_CONTENT" | grep -q "React"; then
        log_message "✅ React application detected"
    else
        log_message "⚠️ WARNING: React not detected in page content"
    fi

    if echo "$PAGE_CONTENT" | grep -q "root"; then
        log_message "✅ Root element found"
    else
        log_message "🚨 ANOMALY: Root element missing"
    fi

    # Test 3: JavaScript Errors Check
    if echo "$PAGE_CONTENT" | grep -qi "error\|exception\|failed"; then
        log_message "⚠️ WARNING: Potential errors found in page content"
    else
        log_message "✅ No obvious errors in page content"
    fi

    # Test 4: Backend API Health
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/health")
    if [ "$API_STATUS" = "200" ]; then
        log_message "✅ Backend API responding (HTTP $API_STATUS)"
    else
        log_message "🚨 ANOMALY: Backend API not responding (HTTP $API_STATUS)"
    fi

    log_message "🔍 FRONTEND HEALTH CHECK COMPLETE"
    return 0
}

test_critical_flows() {
    log_message "🎯 Testing Critical User Flows"

    # Since we can't interact with the UI directly via curl,
    # we'll test the underlying API endpoints that support these flows

    # Test Board Creation API
    BOARDS_RESPONSE=$(curl -s "http://localhost:8000/api/boards")
    if [ $? -eq 0 ]; then
        log_message "✅ Board API accessible"
    else
        log_message "🚨 ANOMALY: Board API not accessible"
    fi

    # Test Tickets API (Card Creation)
    TICKETS_RESPONSE=$(curl -s "http://localhost:8000/api/tickets?board_id=1")
    if [ $? -eq 0 ]; then
        log_message "✅ Tickets API accessible"
    else
        log_message "🚨 ANOMALY: Tickets API not accessible"
    fi

    # Test WebSocket endpoint
    WEBSOCKET_RESPONSE=$(curl -s -I "http://localhost:8000/ws/connect")
    if echo "$WEBSOCKET_RESPONSE" | grep -q "101\|upgrade"; then
        log_message "✅ WebSocket endpoint responding"
    else
        log_message "⚠️ WARNING: WebSocket endpoint may not be accessible via HTTP"
    fi
}

run_monitoring_cycle() {
    log_message "🚨 FRONTEND EMERGENCY SPECIALIST - MONITORING CYCLE START"

    test_frontend_health
    test_critical_flows

    log_message "📊 Monitoring cycle complete. Next check in 10 minutes."
    log_message "----------------------------------------"
}

# Initial check
run_monitoring_cycle

# Start monitoring loop
log_message "🚨 Starting 10-minute monitoring intervals..."
while true; do
    sleep 600  # 10 minutes
    run_monitoring_cycle
done
