# app/schemas/common.py
"""
Common Pydantic schemas used across the application
"""
from pydantic import BaseModel
from typing import Optional, List, Any, Generic, TypeVar
from datetime import datetime

T = TypeVar('T')


class ResponseBase(BaseModel):
    """Base response model"""
    success: bool = True
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response model"""
    success: bool = False
    message: str
    error: Optional[str] = None
    errors: Optional[List[Any]] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response model"""
    success: bool = True
    data: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = 1
    page_size: int = 20

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class DateRangeFilter(BaseModel):
    """Date range filter"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SearchParams(BaseModel):
    """Search parameters"""
    query: Optional[str] = None
    field: Optional[str] = None
