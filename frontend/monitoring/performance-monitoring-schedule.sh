#!/bin/bash

# FRONTEND PERFORMANCE MONITORING SCHEDULE
# Runs every 15 minutes to monitor application performance

LOG_FILE="performance-monitoring.log"
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:8000"

echo "🚀 Frontend Performance Monitoring - $(date)" | tee -a $LOG_FILE

# Function to check service health
check_service_health() {
    local service_name="$1"
    local url="$2"

    echo "🔍 Checking $service_name..." | tee -a $LOG_FILE

    response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" "$url" || echo "HTTPSTATUS:000;TIME:0")
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    time_total=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)

    if [ "$http_code" = "200" ]; then
        echo "✅ $service_name: OK (${time_total}s)" | tee -a $LOG_FILE
    else
        echo "❌ $service_name: FAILED (HTTP $http_code)" | tee -a $LOG_FILE
    fi
}

# Function to measure page performance
measure_page_performance() {
    echo "📊 Measuring page performance..." | tee -a $LOG_FILE

    # Use curl to measure loading times
    curl_stats=$(curl -s -w "namelookup:%{time_namelookup};connect:%{time_connect};starttransfer:%{time_starttransfer};total:%{time_total};size:%{size_download}" -o /dev/null "$FRONTEND_URL")

    namelookup=$(echo "$curl_stats" | grep -o "namelookup:[0-9.]*" | cut -d: -f2)
    connect=$(echo "$curl_stats" | grep -o "connect:[0-9.]*" | cut -d: -f2)
    starttransfer=$(echo "$curl_stats" | grep -o "starttransfer:[0-9.]*" | cut -d: -f2)
    total=$(echo "$curl_stats" | grep -o "total:[0-9.]*" | cut -d: -f2)
    size=$(echo "$curl_stats" | grep -o "size:[0-9.]*" | cut -d: -f2)

    echo "⏱️  Page Load Metrics:" | tee -a $LOG_FILE
    echo "   - DNS Lookup: ${namelookup}s" | tee -a $LOG_FILE
    echo "   - Connection: ${connect}s" | tee -a $LOG_FILE
    echo "   - First Byte: ${starttransfer}s" | tee -a $LOG_FILE
    echo "   - Total Time: ${total}s" | tee -a $LOG_FILE
    echo "   - Page Size: $size bytes" | tee -a $LOG_FILE

    # Performance thresholds
    total_ms=$(echo "$total * 1000" | bc -l)
    if (( $(echo "$total_ms > 3000" | bc -l) )); then
        echo "⚠️  WARNING: Page load time exceeds 3 seconds" | tee -a $LOG_FILE
    fi
}

# Function to check API performance
check_api_performance() {
    echo "🌐 Testing API performance..." | tee -a $LOG_FILE

    # Test key API endpoints
    apis=(
        "health:$BACKEND_URL/health"
        "boards:$FRONTEND_URL/api/boards/1"
        "tickets:$FRONTEND_URL/api/boards/1/tickets"
    )

    for api in "${apis[@]}"; do
        api_name=$(echo "$api" | cut -d: -f1)
        api_url=$(echo "$api" | cut -d: -f2-)

        start_time=$(date +%s%N)
        response=$(curl -s -w "%{http_code}" -o /dev/null "$api_url")
        end_time=$(date +%s%N)

        duration=$(echo "scale=2; ($end_time - $start_time) / 1000000" | bc)

        if [ "$response" = "200" ]; then
            echo "✅ $api_name API: ${duration}ms" | tee -a $LOG_FILE
            if (( $(echo "$duration > 500" | bc -l) )); then
                echo "⚠️  WARNING: $api_name API response time is slow" | tee -a $LOG_FILE
            fi
        else
            echo "❌ $api_name API: FAILED (HTTP $response)" | tee -a $LOG_FILE
        fi
    done
}

# Function to check resource utilization
check_system_resources() {
    echo "💻 System resource check..." | tee -a $LOG_FILE

    # Check CPU usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    echo "   - CPU Usage: ${cpu_usage}%" | tee -a $LOG_FILE

    # Check memory usage
    memory_info=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
    echo "   - Memory Usage: ${memory_info}%" | tee -a $LOG_FILE

    # Check disk usage
    disk_usage=$(df -h / | awk 'NR==2{print $5}')
    echo "   - Disk Usage: $disk_usage" | tee -a $LOG_FILE
}

# Function to generate performance recommendations
generate_recommendations() {
    echo "🎯 Performance Recommendations:" | tee -a $LOG_FILE

    # Analyze recent logs for patterns
    recent_errors=$(tail -n 100 $LOG_FILE | grep -c "❌\|⚠️")

    if [ "$recent_errors" -gt 5 ]; then
        echo "   - Multiple issues detected in recent checks" | tee -a $LOG_FILE
        echo "   - Consider investigating system stability" | tee -a $LOG_FILE
    fi

    echo "   - Monitor memory usage during peak hours" | tee -a $LOG_FILE
    echo "   - Consider implementing service worker for caching" | tee -a $LOG_FILE
    echo "   - Review bundle size optimization opportunities" | tee -a $LOG_FILE
}

# Main monitoring function
run_monitoring_cycle() {
    echo "========================================" | tee -a $LOG_FILE
    echo "Performance Monitoring Cycle - $(date)" | tee -a $LOG_FILE
    echo "========================================" | tee -a $LOG_FILE

    check_service_health "Frontend" "$FRONTEND_URL"
    check_service_health "Backend" "$BACKEND_URL"
    measure_page_performance
    check_api_performance
    check_system_resources
    generate_recommendations

    echo "----------------------------------------" | tee -a $LOG_FILE
    echo "Monitoring cycle completed at $(date)" | tee -a $LOG_FILE
    echo "" | tee -a $LOG_FILE
}

# Main execution
if [ "$1" = "once" ]; then
    # Run once for testing
    run_monitoring_cycle
else
    # Run continuous monitoring
    echo "🚀 Starting continuous performance monitoring..."
    echo "📝 Logging to: $LOG_FILE"
    echo "⏰ Running every 15 minutes"
    echo "🛑 Press Ctrl+C to stop"

    while true; do
        run_monitoring_cycle
        sleep 900  # 15 minutes
    done
fi
