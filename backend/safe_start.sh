#!/bin/bash

echo "🚀 Agent Kanban Backend - Safe Startup Script"
echo "============================================"

# Function to kill existing processes
cleanup_existing() {
    echo "🧹 Cleaning up existing processes..."

    # Kill processes on ports 8000 and 18000
    for port in 8000 18000; do
        pids=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -o 'pid=[0-9]*' | cut -d'=' -f2 | sort -u)
        if [ ! -z "$pids" ]; then
            echo "  Killing processes on port $port: $pids"
            echo $pids | xargs kill -9 2>/dev/null || true
        fi
    done

    # Kill any uvicorn or python main processes
    pkill -f "uvicorn.*app.main" 2>/dev/null || true
    pkill -f "python.*main" 2>/dev/null || true

    sleep 2
    echo "  ✅ Cleanup complete"
}

# Function to check if port is free
check_port() {
    local port=$1
    if ss -tln 2>/dev/null | grep -q ":$port "; then
        echo "❌ Port $port is still in use!"
        return 1
    else
        echo "✅ Port $port is available"
        return 0
    fi
}

# Main startup
main() {
    echo "📍 Current directory: $(pwd)"

    # Ensure we're in the backend directory
    if [ ! -f "app/main.py" ]; then
        echo "❌ Not in backend directory! Looking for backend folder..."
        if [ -d "backend" ]; then
            cd backend
            echo "📂 Changed to: $(pwd)"
        else
            echo "❌ Cannot find backend directory!"
            exit 1
        fi
    fi

    # Cleanup existing processes
    cleanup_existing

    # Verify port is available
    if ! check_port 8000; then
        echo "❌ Port 8000 still in use after cleanup. Exiting."
        exit 1
    fi

    # Create .env if needed
    if [ ! -f .env ]; then
        echo "📝 Creating .env file from .env.example..."
        if [ -f .env.example ]; then
            cp .env.example .env
        else
            echo "⚠️  No .env.example found, creating basic .env"
            cat > .env << EOF
DATABASE_URL=sqlite:///./agent_kanban.db
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173","http://localhost:15175"]
EOF
        fi
    fi

    # Start the server with Socket.IO support
    echo "🌐 Starting FastAPI server with Socket.IO support..."
    echo "   URL: http://localhost:8000"
    echo "   Socket.IO: http://localhost:8000/socket.io/"
    echo "   API Status: http://localhost:8000/api/status"
    echo ""
    echo "Press Ctrl+C to stop the server"

    # Use exec to replace the shell process
    exec python -m uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload
}

# Handle Ctrl+C gracefully
trap 'echo "🛑 Shutting down..."; cleanup_existing; exit 0' INT

# Run main function
main "$@"
