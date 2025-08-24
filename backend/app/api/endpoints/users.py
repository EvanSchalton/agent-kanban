import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional

from fastapi import APIRouter, Cookie, Header, HTTPException, Response
from pydantic import BaseModel

router = APIRouter()

# In-memory session storage (in production, use Redis or database)
user_sessions: Dict[str, Dict] = {}


class UserSessionCreate(BaseModel):
    username: str


class UserSessionResponse(BaseModel):
    username: str
    session_id: str
    created_at: str


@router.post("/session", response_model=UserSessionResponse)
async def create_user_session(session_data: UserSessionCreate, response: Response):
    """Create a new user session with username"""
    # Generate session ID
    session_id = str(uuid.uuid4())

    # Store session data
    user_sessions[session_id] = {
        "username": session_data.username,
        "created_at": datetime.utcnow(),
        "last_activity": datetime.utcnow(),
    }

    # Set cookie with session ID
    response.set_cookie(
        key="session_id",
        value=session_id,
        max_age=86400 * 7,  # 7 days
        httponly=True,
        samesite="lax",
    )

    return UserSessionResponse(
        username=session_data.username,
        session_id=session_id,
        created_at=user_sessions[session_id]["created_at"].isoformat(),
    )


@router.get("/session", response_model=UserSessionResponse)
async def get_user_session(
    session_id: Optional[str] = Cookie(None), x_session_id: Optional[str] = Header(None)
):
    """Get current user session"""
    # Check cookie first, then header (for API clients)
    sid = session_id or x_session_id

    if not sid or sid not in user_sessions:
        raise HTTPException(status_code=404, detail="No active session found")

    session = user_sessions[sid]

    # Update last activity
    session["last_activity"] = datetime.utcnow()

    return UserSessionResponse(
        username=session["username"], session_id=sid, created_at=session["created_at"].isoformat()
    )


@router.put("/session", response_model=UserSessionResponse)
async def update_username(
    session_data: UserSessionCreate,
    session_id: Optional[str] = Cookie(None),
    x_session_id: Optional[str] = Header(None),
):
    """Update username for existing session"""
    # Check cookie first, then header
    sid = session_id or x_session_id

    if not sid or sid not in user_sessions:
        raise HTTPException(status_code=404, detail="No active session found")

    # Update username
    user_sessions[sid]["username"] = session_data.username
    user_sessions[sid]["last_activity"] = datetime.utcnow()

    return UserSessionResponse(
        username=session_data.username,
        session_id=sid,
        created_at=user_sessions[sid]["created_at"].isoformat(),
    )


@router.delete("/session")
async def delete_user_session(
    response: Response,
    session_id: Optional[str] = Cookie(None),
    x_session_id: Optional[str] = Header(None),
):
    """Delete user session (logout)"""
    sid = session_id or x_session_id

    if sid and sid in user_sessions:
        del user_sessions[sid]

    # Clear cookie
    response.delete_cookie("session_id")

    return {"message": "Session deleted successfully"}


def get_username_from_session(
    session_id: Optional[str] = None, x_session_id: Optional[str] = None
) -> Optional[str]:
    """Helper function to get username from session"""
    sid = session_id or x_session_id

    if sid and sid in user_sessions:
        # Update last activity
        user_sessions[sid]["last_activity"] = datetime.utcnow()
        return user_sessions[sid]["username"]

    return None


# Cleanup old sessions periodically
async def cleanup_old_sessions():
    """Remove sessions older than 7 days"""
    cutoff = datetime.utcnow() - timedelta(days=7)
    to_remove = []

    for sid, session in user_sessions.items():
        if session["last_activity"] < cutoff:
            to_remove.append(sid)

    for sid in to_remove:
        del user_sessions[sid]
