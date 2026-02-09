# app/services/auth_service.py
"""
Authentication Service - Handles user authentication and authorization
"""
from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
import logging

from app.models import User, Session as UserSession
from app.core.security import (
    verify_password,
    hash_password,
    create_tokens,
    decode_token,
    TokenResponse
)
from app.schemas.user import LoginRequest, UserResponse

logger = logging.getLogger(__name__)


class AuthService:
    """Authentication service class"""

    @staticmethod
    def authenticate_user(
        db: Session,
        username: str,
        password: str
    ) -> Tuple[Optional[User], Optional[str]]:
        """
        Authenticate a user with username and password
        Returns: (user, error_message)
        """
        # Find user by username
        user = db.query(User).filter(User.username == username).first()

        if not user:
            logger.warning(f"Login attempt for non-existent user: {username}")
            return None, "Invalid username or password"

        # Check if account is locked
        if user.is_locked:
            logger.warning(f"Login attempt for locked account: {username}")
            return None, "Account is locked. Please contact administrator."

        # Check if account is active
        if not user.is_active:
            logger.warning(f"Login attempt for inactive account: {username}")
            return None, "Account is inactive. Please contact administrator."

        # Verify password
        if not verify_password(password, user.password_hash):
            # Increment failed login attempts
            user.failed_login_attempts += 1

            # Lock account after 5 failed attempts
            if user.failed_login_attempts >= 5:
                user.is_locked = True
                logger.warning(f"Account locked due to failed attempts: {username}")

            db.commit()
            return None, "Invalid username or password"

        # Reset failed login attempts on successful login
        user.failed_login_attempts = 0
        user.last_login_at = datetime.utcnow()
        db.commit()

        logger.info(f"Successful login: {username}")
        return user, None

    @staticmethod
    def create_user_tokens(user: User) -> TokenResponse:
        """Create access and refresh tokens for a user"""
        return create_tokens(
            user_id=str(user.id),
            username=user.username,
            role=user.role.value,
            branch_id=str(user.branch_id) if user.branch_id else None
        )

    @staticmethod
    def get_user_from_token(db: Session, token: str) -> Optional[User]:
        """Get user from JWT token"""
        token_data = decode_token(token)

        if not token_data:
            return None

        user = db.query(User).filter(User.id == token_data.user_id).first()
        return user

    @staticmethod
    def change_password(
        db: Session,
        user: User,
        current_password: str,
        new_password: str
    ) -> Tuple[bool, str]:
        """
        Change user password
        Returns: (success, message)
        """
        # Verify current password
        if not verify_password(current_password, user.password_hash):
            return False, "Current password is incorrect"

        # Hash and save new password
        user.password_hash = hash_password(new_password)
        user.password_changed_at = datetime.utcnow()
        db.commit()

        logger.info(f"Password changed for user: {user.username}")
        return True, "Password changed successfully"

    @staticmethod
    def create_user_session(
        db: Session,
        user: User,
        session_id: str,
        device_info: dict = None,
        ip_address: str = None,
        user_agent: str = None
    ) -> UserSession:
        """Create a new user session"""
        from datetime import timedelta

        session = UserSession(
            session_id=session_id,
            user_id=user.id,
            device_info=device_info,
            ip_address=ip_address,
            user_agent=user_agent,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        return session

    @staticmethod
    def invalidate_session(db: Session, session_id: str) -> bool:
        """Invalidate a user session"""
        session = db.query(UserSession).filter(
            UserSession.session_id == session_id
        ).first()

        if session:
            db.delete(session)
            db.commit()
            return True

        return False

    @staticmethod
    def user_to_response(user: User) -> UserResponse:
        """Convert User model to UserResponse schema"""
        return UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role.value,
            branch_id=str(user.branch_id) if user.branch_id else None,
            is_active=user.is_active,
            is_locked=user.is_locked,
            last_login_at=user.last_login_at,
            created_at=user.created_at
        )
