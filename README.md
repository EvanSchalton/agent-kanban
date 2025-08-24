# Agent Kanban

A modern kanban board application with FastAPI backend and React frontend, running in a DevContainer with Claude Code integration.

## Development Environment

This project uses a DevContainer that includes:

- **Python 3.11** with FastAPI and related packages
- **Node.js LTS** with React development tools
- **Claude Code** AI assistant
- **Docker-in-Docker** for containerization
- **Poetry** for Python dependency management

## Getting Started

### Prerequisites

- VS Code with DevContainer extension
- Docker Desktop

### Setup

1. Open this project in VS Code
2. When prompted, click "Reopen in Container" or use Command Palette: `Dev Containers: Reopen in Container`
3. Wait for the container to build (first time may take a few minutes)

### Running the Applications

#### Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The API will be available at <http://localhost:8000>

#### Frontend (React)

```bash
cd frontend
npm install
npm start
```

The frontend will be available at <http://localhost:3000>

### Development Workflow

1. **Backend Development**: Edit files in `backend/` directory
   - API endpoints in `main.py`
   - Add new dependencies to `requirements.txt`
   - Use `uvicorn main:app --reload --host 0.0.0.0 --port 8000` for auto-reload

2. **Frontend Development**: Edit files in `frontend/src/` directory
   - React components in TypeScript
   - Styling with CSS (Tailwind CSS is pre-configured)
   - API calls using axios

3. **Claude Code Integration**:
   - Claude Code is pre-installed and available globally
   - Use it for AI-assisted coding and debugging

### Available Ports

- 3000: React development server
- 8000: FastAPI backend
- 5173: Vite development server (if using Vite instead of CRA)

### VS Code Extensions Included

- Python support with Black formatting, Flake8 linting, and MyPy type checking
- TypeScript and React support
- ESLint and Prettier for code formatting
- Tailwind CSS IntelliSense

### Project Structure

```
agent-kanban/
├── .devcontainer/
│   ├── Dockerfile
│   └── devcontainer.json
├── backend/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## API Documentation

Once the backend is running, visit <http://localhost:8000/docs> for interactive API documentation powered by FastAPI's built-in Swagger UI.

## MCP Server Integration

This application includes a Model Context Protocol (MCP) server that allows AI agents to interact with the kanban board programmatically.

### MCP Tools Available

The following tools are exposed through the MCP server:

- **list_tasks** - List all tickets with optional filtering
- **get_task** - Get detailed information about a specific ticket
- **create_task** - Create a new ticket
- **edit_task** - Update ticket properties
- **claim_task** - Assign a ticket to an agent
- **update_task_status** - Move ticket between columns
- **add_comment** - Add comments to tickets
- **list_columns** - Get available board columns
- **get_board_state** - Get complete board overview

### Setting up MCP for Claude

#### Option 1: Using Claude CLI (Recommended)

Add the MCP server using the Claude CLI:

```bash
cd /workspaces/agent-kanban/backend
claude mcp add agent-kanban "python run_mcp.py" -e PYTHONPATH=/workspaces/agent-kanban/backend
```

This command:

- Names the server `agent-kanban`
- Runs the standalone MCP server script
- Configures the PYTHONPATH environment variable
- Saves to local configuration at `~/.claude.json`

#### Option 2: Manual Configuration (Claude Desktop)

1. **Locate Claude Desktop Configuration**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Add MCP Server Configuration**

   Edit the configuration file and add:

   ```json
   {
     "mcpServers": {
       "agent-kanban": {
         "command": "python",
         "args": ["run_mcp.py"],
         "cwd": "/workspaces/agent-kanban/backend",
         "env": {
           "PYTHONPATH": "/workspaces/agent-kanban/backend"
         }
       }
     }
   }
   ```

3. **Start the Backend Server**

   ```bash
   cd backend
   python -m uvicorn app.main:app --port 8000
   ```

4. **Verify MCP Installation**
   - For CLI: Check `~/.claude.json` contains the agent-kanban server
   - For Desktop: Restart Claude Desktop after configuration
   - The MCP tools should now be available

### Testing MCP Integration

After setup, you can test the MCP integration in Claude by:

1. Opening Claude Desktop
2. Using commands like:
   - "List all tasks on the kanban board"
   - "Create a new task titled 'Test MCP Integration'"
   - "Move task #1 to In Progress"
   - "Add a comment to task #2"

### MCP Server Implementation

The MCP server is implemented in `/workspaces/agent-kanban/backend/app/mcp/server.py` using FastMCP, which integrates seamlessly with the FastAPI application.

### Troubleshooting MCP

1. **Server Not Starting**
   - The MCP server runs separately from the FastAPI backend
   - Ensure you're running `python run_mcp.py` not the uvicorn command
   - Check that FastMCP is installed: `pip install fastmcp`
   - Verify PYTHONPATH includes `/workspaces/agent-kanban/backend`

2. **Tools Not Showing in Claude**
   - Restart Claude Desktop after configuration changes
   - Check Claude Desktop logs for MCP connection errors
   - Test the MCP server standalone: `python run_mcp.py`
   - The server should output "Starting server agent-kanban-mcp..."

3. **Database Connection Issues**
   - Ensure the backend API is running on port 8000
   - The MCP server needs the backend API for database access
   - Start backend first: `python -m uvicorn app.main:app --port 8000`
   - Then start MCP server: `python run_mcp.py`

4. **Permission Issues**
   - Make sure run_mcp.py is executable: `chmod +x run_mcp.py`
   - Check that Python has execution permissions
   - Verify database file permissions if using SQLite

## Project Status

✅ **COMPLETED** - The Agent Kanban Board is fully functional with:

- Backend API with 103/103 tests passing
- Frontend React application building successfully
- MCP server integration for AI agent interaction
- WebSocket support for real-time updates
- Complete ticket lifecycle management
- Statistical color coding based on time in column

Happy coding! 🚀
