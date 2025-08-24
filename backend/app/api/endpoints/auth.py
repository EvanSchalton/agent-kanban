from datetime import datetime, timedelta
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session, select

from app.api.schemas.auth import Token, UserLogin, UserRegister, UserResponse, UserUpdate
from app.core.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    authenticate_user,
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    verify_token,
)
from app.core.database import get_session
from app.core.redis_client import redis_client
from app.models.user import User

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def register(
    request: Request, user_data: UserRegister, session: Session = Depends(get_session)
) -> User:
    # Check if username already exists
    existing_user = session.exec(
        select(User).where(User.username == user_data.username.lower())
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered"
        )

    # Check if email already exists
    existing_email = session.exec(select(User).where(User.email == user_data.email.lower())).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username.lower(),
        email=user_data.email.lower(),
        hashed_password=hashed_password,
        role=user_data.role,
    )

    session.add(db_user)
    session.commit()
    session.refresh(db_user)

    return db_user


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    request: Request, user_credentials: UserLogin, session: Session = Depends(get_session)
) -> Dict:
    user = authenticate_user(session, user_credentials.username.lower(), user_credentials.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive"
        )

    # Update last login time
    user.last_login = datetime.utcnow()
    session.add(user)
    session.commit()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.username, "user_id": user.id})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: RefreshTokenRequest, session: Session = Depends(get_session)
) -> Dict:
    refresh_token = request.refresh_token
    payload = verify_token(refresh_token, token_type="refresh")

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    user = session.exec(select(User).where(User.username == username)).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id}, expires_delta=access_token_expires
    )

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    current_user: User = Depends(get_current_user),
) -> Dict:
    # Blacklist the token
    token = credentials.credentials
    # Token will be blacklisted for 24 hours (same as token expiry)
    redis_client.add_to_blacklist(token, ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_user_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> User:
    if user_update.email:
        # Check if email is already taken
        existing_email = session.exec(
            select(User).where(User.email == user_update.email.lower(), User.id != current_user.id)
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
            )
        current_user.email = user_update.email.lower()

    if user_update.password:
        current_user.hashed_password = get_password_hash(user_update.password)

    if user_update.is_active is not None:
        # Only superusers can change active status
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can change active status",
        )

    session.add(current_user)
    session.commit()
    session.refresh(current_user)

    return current_user
