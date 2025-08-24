#!/bin/bash

echo "🚨 EMERGENCY CARD CREATION DEBUG TEST"
echo "====================================="

BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:5173"

echo "🔧 Testing backend API directly..."

# Test health
echo "📋 Testing backend health..."
health_response=$(curl -s "$BACKEND_URL/health")
echo "✅ Backend health: $health_response"

# Test board existence
echo "📋 Testing board 1 existence..."
board_response=$(curl -s -w "HTTP_CODE:%{http_code}" "$BACKEND_URL/api/boards/1")
board_code=$(echo "$board_response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
board_body=$(echo "$board_response" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$board_code" = "200" ]; then
    echo "✅ Board 1 exists: $board_body"
else
    echo "❌ Board 1 not found: HTTP $board_code"
    echo "Response: $board_body"
fi

# Test ticket creation
echo "📋 Testing direct ticket creation..."
test_ticket='{
    "title": "Debug Test Card",
    "description": "Testing card creation flow",
    "acceptance_criteria": "Should create successfully",
    "priority": "1.0",
    "assignee": "debug-agent",
    "board_id": 1,
    "current_column": "Not Started"
}'

echo "📤 Creating test ticket..."
create_response=$(curl -s -w "HTTP_CODE:%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$test_ticket" \
    "$BACKEND_URL/api/tickets/")

create_code=$(echo "$create_response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
create_body=$(echo "$create_response" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$create_code" = "200" ] || [ "$create_code" = "201" ]; then
    echo "✅ Ticket created successfully: $create_body"
    # Extract ticket ID for cleanup
    ticket_id=$(echo "$create_body" | grep -o '"id":[0-9]*' | cut -d: -f2)
    if [ ! -z "$ticket_id" ]; then
        echo "🗑️ Cleaning up ticket $ticket_id..."
        curl -s -X DELETE "$BACKEND_URL/api/tickets/$ticket_id"
        echo "✅ Cleanup complete"
    fi
else
    echo "❌ Failed to create ticket: HTTP $create_code"
    echo "Response: $create_body"
fi

echo ""
echo "🎯 Testing frontend API proxy..."

# Test frontend proxy for board
echo "📋 Testing frontend proxy for board..."
frontend_board_response=$(curl -s -w "HTTP_CODE:%{http_code}" "$FRONTEND_URL/api/boards/1")
frontend_board_code=$(echo "$frontend_board_response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
frontend_board_body=$(echo "$frontend_board_response" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$frontend_board_code" = "200" ]; then
    echo "✅ Frontend proxy working for board: $frontend_board_body"
else
    echo "❌ Frontend proxy failed for board: HTTP $frontend_board_code"
    echo "Response: $frontend_board_body"
fi

# Test frontend proxy for ticket creation
echo "📋 Testing frontend proxy for ticket creation..."
frontend_ticket='{
    "title": "Frontend Debug Test Card",
    "description": "Testing frontend proxy",
    "acceptance_criteria": "Should work through proxy",
    "priority": "1.0",
    "assignee": "frontend-debug",
    "board_id": 1,
    "current_column": "Not Started"
}'

frontend_create_response=$(curl -s -w "HTTP_CODE:%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$frontend_ticket" \
    "$FRONTEND_URL/api/tickets/")

frontend_create_code=$(echo "$frontend_create_response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
frontend_create_body=$(echo "$frontend_create_response" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$frontend_create_code" = "200" ] || [ "$frontend_create_code" = "201" ]; then
    echo "✅ Ticket created through frontend proxy: $frontend_create_body"
    # Extract ticket ID for cleanup
    frontend_ticket_id=$(echo "$frontend_create_body" | grep -o '"id":[0-9]*' | cut -d: -f2)
    if [ ! -z "$frontend_ticket_id" ]; then
        echo "🗑️ Cleaning up frontend ticket $frontend_ticket_id..."
        curl -s -X DELETE "$FRONTEND_URL/api/tickets/$frontend_ticket_id"
        echo "✅ Frontend cleanup complete"
    fi
else
    echo "❌ Frontend proxy failed for ticket creation: HTTP $frontend_create_code"
    echo "Response: $frontend_create_body"
fi

echo ""
echo "🔍 Testing error scenarios..."

# Test invalid board
echo "📋 Testing invalid board (should return 404)..."
invalid_board_response=$(curl -s -w "HTTP_CODE:%{http_code}" "$BACKEND_URL/api/boards/999")
invalid_board_code=$(echo "$invalid_board_response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)

if [ "$invalid_board_code" = "404" ]; then
    echo "✅ Correct 404 for invalid board"
else
    echo "⚠️ Unexpected response for invalid board: HTTP $invalid_board_code"
fi

# Test bad ticket data
echo "📋 Testing invalid ticket data (should return 422)..."
bad_ticket='{"title": "", "board_id": "invalid"}'

bad_response=$(curl -s -w "HTTP_CODE:%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$bad_ticket" \
    "$BACKEND_URL/api/tickets/")

bad_code=$(echo "$bad_response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
bad_body=$(echo "$bad_response" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$bad_code" = "422" ]; then
    echo "✅ Correct validation error for bad data: $bad_body"
else
    echo "⚠️ Unexpected response for bad ticket data: HTTP $bad_code"
    echo "Response: $bad_body"
fi

echo ""
echo "📊 SUMMARY:"
if [ "$create_code" = "200" ] || [ "$create_code" = "201" ]; then
    echo "Backend API: ✅ Working"
else
    echo "Backend API: ❌ Failed (HTTP $create_code)"
fi

if [ "$frontend_create_code" = "200" ] || [ "$frontend_create_code" = "201" ]; then
    echo "Frontend Proxy: ✅ Working"
else
    echo "Frontend Proxy: ❌ Failed (HTTP $frontend_create_code)"
fi

if ([ "$create_code" = "200" ] || [ "$create_code" = "201" ]) && ([ "$frontend_create_code" = "200" ] || [ "$frontend_create_code" = "201" ]); then
    echo "🎉 Card creation should be working! Check React component state."
else
    echo "🚨 Found infrastructure issues that need fixing."
fi
