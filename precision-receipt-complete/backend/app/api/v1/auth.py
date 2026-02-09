# app/api/v1/auth.py
"""
Authentication API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from app.core.database import get_db
from app.services.auth_service import AuthService
from app.middleware.auth import get_current_active_user
from app.models import User
from app.schemas.user import (
    LoginRequest, LoginResponse, UserResponse,
    PasswordChangeRequest, PasswordResetRequest
)
from app.schemas.common import ResponseBase

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user and return JWT tokens
    """
    # Authenticate user
    user, error = AuthService.authenticate_user(
        db=db,
        username=login_data.username,
        password=login_data.password
    )

    if error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=error,
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create tokens
    tokens = AuthService.create_user_tokens(user)

    # Create session
    session_id = str(uuid.uuid4())
    AuthService.create_user_session(
        db=db,
        user=user,
        session_id=session_id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

    # Return response
    return LoginResponse(
        success=True,
        message="Login successful",
        user=AuthService.user_to_response(user),
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in
    )


@router.post("/logout", response_model=ResponseBase)
async def logout(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Logout current user (invalidate session)
    """
    # In a full implementation, you would invalidate the token
    # For now, just return success
    return ResponseBase(
        success=True,
        message="Logout successful"
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current authenticated user information
    """
    return AuthService.user_to_response(current_user)


@router.post("/change-password", response_model=ResponseBase)
async def change_password(
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change current user's password
    """
    success, message = AuthService.change_password(
        db=db,
        user=current_user,
        current_password=password_data.current_password,
        new_password=password_data.new_password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message
        )

    return ResponseBase(
        success=True,
        message=message
    )


@router.post("/refresh", response_model=dict)
async def refresh_token(
    current_user: User = Depends(get_current_active_user)
):
    """
    Refresh access token
    """
    tokens = AuthService.create_user_tokens(current_user)

    return {
        "success": True,
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "token_type": tokens.token_type,
        "expires_in": tokens.expires_in
    }
