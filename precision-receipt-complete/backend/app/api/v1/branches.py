# app/api/v1/branches.py
"""
Branch API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, field_validator
from datetime import datetime
from decimal import Decimal

from app.core.database import get_db
from app.middleware.auth import get_current_active_user, require_admin, require_manager_or_above
from app.models import Branch, BranchType, User

router = APIRouter()


class BranchCreate(BaseModel):
    """Schema for creating a branch"""
    branch_code: str
    branch_name: str
    branch_type: str = "SUB"
    region: Optional[str] = None
    address: str
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "Pakistan"
    phone: str
    email: Optional[str] = None

    @field_validator('branch_code')
    @classmethod
    def validate_branch_code(cls, v):
        if not v or len(v) < 3:
            raise ValueError('Branch code must be at least 3 characters')
        return v.upper()

    @field_validator('branch_type')
    @classmethod
    def validate_branch_type(cls, v):
        valid_types = ['MAIN', 'SUB', 'REGIONAL']
        if v not in valid_types:
            raise ValueError(f'Branch type must be one of: {valid_types}')
        return v


class BranchUpdate(BaseModel):
    """Schema for updating a branch"""
    branch_name: Optional[str] = None
    branch_type: Optional[str] = None
    region: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class BranchResponse(BaseModel):
    """Branch response schema"""
    id: str
    branch_code: str
    branch_name: str
    branch_type: str
    region: Optional[str] = None
    address: str
    city: str
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str
    phone: str
    email: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    working_hours: Optional[dict] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[BranchResponse])
async def get_branches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    city: Optional[str] = None,
    region: Optional[str] = None,
    is_active: Optional[bool] = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all branches with optional filtering
    """
    query = db.query(Branch)

    # Filter by city
    if city:
        query = query.filter(Branch.city.ilike(f"%{city}%"))

    # Filter by region
    if region:
        query = query.filter(Branch.region.ilike(f"%{region}%"))

    # Filter by active status
    if is_active is not None:
        query = query.filter(Branch.is_active == is_active)

    branches = query.order_by(Branch.branch_name).offset(skip).limit(limit).all()

    return [
        BranchResponse(
            id=str(b.id),
            branch_code=b.branch_code,
            branch_name=b.branch_name,
            branch_type=b.branch_type.value,
            region=b.region,
            address=b.address,
            city=b.city,
            state=b.state,
            postal_code=b.postal_code,
            country=b.country,
            phone=b.phone,
            email=b.email,
            latitude=float(b.latitude) if b.latitude else None,
            longitude=float(b.longitude) if b.longitude else None,
            working_hours=b.working_hours,
            is_active=b.is_active,
            created_at=b.created_at
        )
        for b in branches
    ]


@router.get("/{branch_id}", response_model=BranchResponse)
async def get_branch(
    branch_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get branch by ID
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    return BranchResponse(
        id=str(branch.id),
        branch_code=branch.branch_code,
        branch_name=branch.branch_name,
        branch_type=branch.branch_type.value,
        region=branch.region,
        address=branch.address,
        city=branch.city,
        state=branch.state,
        postal_code=branch.postal_code,
        country=branch.country,
        phone=branch.phone,
        email=branch.email,
        latitude=float(branch.latitude) if branch.latitude else None,
        longitude=float(branch.longitude) if branch.longitude else None,
        working_hours=branch.working_hours,
        is_active=branch.is_active,
        created_at=branch.created_at
    )


@router.get("/code/{branch_code}", response_model=BranchResponse)
async def get_branch_by_code(
    branch_code: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get branch by branch code
    """
    branch = db.query(Branch).filter(Branch.branch_code == branch_code).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Branch with code {branch_code} not found"
        )

    return BranchResponse(
        id=str(branch.id),
        branch_code=branch.branch_code,
        branch_name=branch.branch_name,
        branch_type=branch.branch_type.value,
        region=branch.region,
        address=branch.address,
        city=branch.city,
        state=branch.state,
        postal_code=branch.postal_code,
        country=branch.country,
        phone=branch.phone,
        email=branch.email,
        latitude=float(branch.latitude) if branch.latitude else None,
        longitude=float(branch.longitude) if branch.longitude else None,
        working_hours=branch.working_hours,
        is_active=branch.is_active,
        created_at=branch.created_at
    )


@router.post("/", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(
    branch_data: BranchCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new branch (Admin only)
    """
    # Check if branch code already exists
    existing = db.query(Branch).filter(Branch.branch_code == branch_data.branch_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Branch with code {branch_data.branch_code} already exists"
        )

    # Create branch
    branch = Branch(
        branch_code=branch_data.branch_code,
        branch_name=branch_data.branch_name,
        branch_type=BranchType[branch_data.branch_type],
        region=branch_data.region,
        address=branch_data.address,
        city=branch_data.city,
        state=branch_data.state,
        postal_code=branch_data.postal_code,
        country=branch_data.country,
        phone=branch_data.phone,
        email=branch_data.email,
        is_active=True
    )

    db.add(branch)
    db.commit()
    db.refresh(branch)

    return BranchResponse(
        id=str(branch.id),
        branch_code=branch.branch_code,
        branch_name=branch.branch_name,
        branch_type=branch.branch_type.value,
        region=branch.region,
        address=branch.address,
        city=branch.city,
        state=branch.state,
        postal_code=branch.postal_code,
        country=branch.country,
        phone=branch.phone,
        email=branch.email,
        latitude=float(branch.latitude) if branch.latitude else None,
        longitude=float(branch.longitude) if branch.longitude else None,
        working_hours=branch.working_hours,
        is_active=branch.is_active,
        created_at=branch.created_at
    )


@router.put("/{branch_id}", response_model=BranchResponse)
async def update_branch(
    branch_id: str,
    branch_data: BranchUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update a branch (Admin only)
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    # Update fields
    update_data = branch_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == 'branch_type' and value:
            setattr(branch, field, BranchType[value])
        elif value is not None:
            setattr(branch, field, value)

    db.commit()
    db.refresh(branch)

    return BranchResponse(
        id=str(branch.id),
        branch_code=branch.branch_code,
        branch_name=branch.branch_name,
        branch_type=branch.branch_type.value,
        region=branch.region,
        address=branch.address,
        city=branch.city,
        state=branch.state,
        postal_code=branch.postal_code,
        country=branch.country,
        phone=branch.phone,
        email=branch.email,
        latitude=float(branch.latitude) if branch.latitude else None,
        longitude=float(branch.longitude) if branch.longitude else None,
        working_hours=branch.working_hours,
        is_active=branch.is_active,
        created_at=branch.created_at
    )


@router.delete("/{branch_id}")
async def delete_branch(
    branch_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Deactivate a branch (Admin only)
    Note: We don't actually delete, just deactivate
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    # Check if branch has active users
    active_users = db.query(User).filter(
        User.branch_id == branch_id,
        User.is_active == True
    ).count()

    if active_users > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot deactivate branch with {active_users} active users"
        )

    branch.is_active = False
    db.commit()

    return {"success": True, "message": "Branch deactivated successfully"}


@router.post("/{branch_id}/activate")
async def activate_branch(
    branch_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Activate a branch (Admin only)
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    branch.is_active = True
    db.commit()

    return {"success": True, "message": "Branch activated successfully"}
