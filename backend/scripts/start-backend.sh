#!/bin/bash

echo "Starting Agent Kanban Backend..."

# Create .env file from example if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

# Install dependencies if needed
echo "Checking dependencies..."
poetry install --quiet

# Navigate to backend directory
cd backend

# Start the FastAPI server with Socket.IO support
echo "Starting FastAPI server with Socket.IO on port 8000..."
python -m uvicorn app.main:socket_app --host 0.0.0.0 --port 8000 --reload
