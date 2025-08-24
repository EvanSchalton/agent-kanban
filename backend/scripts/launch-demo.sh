#!/bin/bash

# Agent Kanban Multi-User Demo Launcher
# This script launches the full application demo with multiple browser windows

echo "🎯 Agent Kanban - Multi-User WebSocket Demo"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
check_backend() {
    if curl -s http://localhost:18000/api/boards/ > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is running on port 18000${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Backend not detected on port 18000${NC}"
        return 1
    fi
}

# Check if frontend is running
check_frontend() {
    # Check multiple possible ports
    for port in 15184 15173 5173; do
        if curl -s http://localhost:$port > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Frontend is running on port $port${NC}"
            FRONTEND_PORT=$port
            return 0
        fi
    done
    echo -e "${YELLOW}⚠️  Frontend not detected${NC}"
    return 1
}

# Start backend if needed
start_backend() {
    echo -e "${BLUE}🚀 Starting backend server...${NC}"
    cd backend
    python -m uvicorn app.main:app --host 0.0.0.0 --port 18000 --reload > ../backend_log.txt 2>&1 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    sleep 3
    cd ..
}

# Start frontend if needed
start_frontend() {
    echo -e "${BLUE}🚀 Starting frontend development server...${NC}"
    cd frontend
    npm run dev > ../frontend_log.txt 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    sleep 5
    cd ..

    # Find the port
    for port in 15184 15173 5173; do
        if curl -s http://localhost:$port > /dev/null 2>&1; then
            FRONTEND_PORT=$port
            break
        fi
    done
}

# Launch browser windows with different users
launch_demo_windows() {
    echo ""
    echo -e "${BLUE}🌐 Launching demo browser windows...${NC}"
    echo ""

    # Set different usernames in localStorage using JavaScript
    # This would normally be done through the UI

    URL="http://localhost:${FRONTEND_PORT}"

    echo "📋 Demo Instructions:"
    echo "===================="
    echo ""
    echo "1. Three browser windows will open (or tabs if your browser prefers)"
    echo "2. In each window:"
    echo "   - Click the user icon (top-right)"
    echo "   - Set a different username:"
    echo "     • Window 1: Set as 'Alice'"
    echo "     • Window 2: Set as 'Bob'"
    echo "     • Window 3: Set as 'Charlie'"
    echo ""
    echo "3. Test Real-Time Sync:"
    echo "   - In Alice's window: Create a new ticket"
    echo "   - Watch it appear instantly in Bob's window"
    echo "   - In Bob's window: Drag the ticket to 'In Progress'"
    echo "   - Watch it move in all windows with attribution"
    echo ""
    echo "4. Test Board Isolation:"
    echo "   - Create Board 2 in any window"
    echo "   - Switch Charlie to Board 2"
    echo "   - Create tickets in Board 2"
    echo "   - Verify Alice and Bob don't see Board 2 tickets"
    echo ""
    echo "5. Observe User Attribution:"
    echo "   - Each action shows who performed it"
    echo "   - WebSocket events include username"
    echo "   - Real-time updates show 'moved by Bob' etc."
    echo ""

    # Open browser windows/tabs based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo -e "${GREEN}Opening Safari windows...${NC}"
        open -n -a "Safari" "$URL"
        sleep 1
        open -n -a "Safari" "$URL"
        sleep 1
        open -n -a "Safari" "$URL"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v google-chrome &> /dev/null; then
            echo -e "${GREEN}Opening Chrome windows...${NC}"
            google-chrome --new-window "$URL" &
            sleep 1
            google-chrome --new-window "$URL" &
            sleep 1
            google-chrome --new-window "$URL" &
        elif command -v firefox &> /dev/null; then
            echo -e "${GREEN}Opening Firefox windows...${NC}"
            firefox --new-window "$URL" &
            sleep 1
            firefox --new-window "$URL" &
            sleep 1
            firefox --new-window "$URL" &
        else
            echo -e "${YELLOW}Please manually open 3 browser windows to: $URL${NC}"
        fi
    else
        # Windows or other
        echo -e "${YELLOW}Please manually open 3 browser windows to: $URL${NC}"
    fi

    echo ""
    echo -e "${GREEN}✅ Demo windows launched!${NC}"
    echo ""
    echo "URL: $URL"
    echo ""
    echo "Press Ctrl+C to stop the demo and close servers."
}

# Main execution
echo "🔍 Checking services..."
echo ""

# Check and start backend if needed
if ! check_backend; then
    start_backend
    sleep 2
    if ! check_backend; then
        echo -e "${YELLOW}❌ Failed to start backend. Please check backend/backend_log.txt${NC}"
        exit 1
    fi
fi

# Check and start frontend if needed
if ! check_frontend; then
    start_frontend
    sleep 3
    if ! check_frontend; then
        echo -e "${YELLOW}❌ Failed to start frontend. Please check frontend/frontend_log.txt${NC}"
        exit 1
    fi
fi

# Launch the demo
launch_demo_windows

# Keep script running
echo ""
echo "Demo is running. Press Ctrl+C to stop all services."
echo ""

# Trap Ctrl+C to cleanup
trap cleanup INT

cleanup() {
    echo ""
    echo "🧹 Cleaning up..."

    if [ ! -z "$BACKEND_PID" ]; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi

    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
    fi

    echo "✅ Demo stopped"
    exit 0
}

# Wait indefinitely
while true; do
    sleep 1
done
