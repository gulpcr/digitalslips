# app/api/v1/settings.py
"""
System Settings API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.middleware.auth import require_admin, get_current_active_user
from app.models import SystemSettings, User

router = APIRouter()


class SettingUpdate(BaseModel):
    value: str


class SettingResponse(BaseModel):
    key: str
    value: str
    description: Optional[str] = None


@router.get("/extension")
async def get_extension_settings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get settings needed by the Chrome extension (any authenticated user)"""
    keys = [
        "extension.transact_url",
        "extension.auto_open_transact",
        "extension.t24_version",
    ]
    settings = db.query(SystemSettings).filter(SystemSettings.key.in_(keys)).all()
    return {s.key.replace("extension.", ""): s.value for s in settings}


@router.get("/category/{category}")
async def get_settings_by_category(
    category: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all settings in a category (any authenticated user, excludes sensitive)"""
    settings = db.query(SystemSettings).filter(
        SystemSettings.category == category,
        SystemSettings.is_sensitive == False
    ).all()
    return [
        {"key": s.key, "value": s.value, "description": s.description}
        for s in settings
    ]


@router.put("/{key:path}")
async def update_setting(
    key: str,
    body: SettingUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a system setting (admin only)"""
    setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Setting '{key}' not found"
        )
    setting.value = body.value
    setting.updated_by = current_user.id
    db.commit()
    db.refresh(setting)
    return {"key": setting.key, "value": setting.value, "message": "Setting updated"}
