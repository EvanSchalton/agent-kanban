# Use the base image that supports both Python and Node.js
FROM mcr.microsoft.com/devcontainers/python:1-3.11-bullseye

# Install Node.js LTS and Claude Code
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @anthropic-ai/claude-code

# Install additional system dependencies that might be useful for FastAPI and React development
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    vim \
    nano \
    htop \
    tree \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python development tools and FastAPI-related packages
RUN pip install --upgrade pip \
    && pip install \
    fastapi \
    uvicorn[standard] \
    python-multipart \
    python-jose[cryptography] \
    passlib[bcrypt] \
    sqlalchemy \
    alembic \
    pytest \
    pytest-asyncio \
    httpx \
    black \
    flake8 \
    mypy

# Install global npm packages for React development
RUN npm install -g \
    create-react-app \
    create-vite \
    typescript \
    ts-node \
    eslint \
    prettier \
    nodemon

# Set up working directory
WORKDIR /workspace

# Create directories for backend and frontend
RUN mkdir -p /workspace/backend /workspace/frontend

# Expose common ports for development
EXPOSE 13000 18000 15173

# Set environment variables
ENV PYTHONPATH=/workspace/backend
ENV NODE_ENV=development
