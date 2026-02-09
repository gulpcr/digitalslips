# app/main.py
"""
Precision Receipt - FastAPI Application
Meezan Bank Pakistan - Digital Transaction Receipt System
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
import logging
import time
from typing import AsyncGenerator

from app.core.config import settings
from app.core.database import engine
from app.models import Base
from app.services.signature_service import SignatureService

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.LOG_LEVEL == "INFO" else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Application lifespan manager
    Handles startup and shutdown events
    """
    # Startup
    logger.info("Starting Precision Receipt API...")
    logger.info(f"Environment: {settings.NODE_ENV}")
    logger.info(f"Database: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")

    # Create database tables (in production, use Alembic migrations)
    if settings.NODE_ENV == "development":
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created")

    # Initialize digital signature service (SBP Compliance)
    logger.info("Initializing digital signature service...")
    if SignatureService.initialize():
        logger.info("Digital signature service initialized successfully")
    else:
        logger.warning("Digital signature service initialization failed - receipts will not be signed")

    yield

    # Shutdown
    logger.info("Shutting down Precision Receipt API...")


# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade Digital Transaction Receipt System for Meezan Bank Pakistan",
    version=settings.APP_VERSION,
    docs_url="/api/docs" if settings.ENABLE_SWAGGER_DOCS else None,
    redoc_url="/api/redoc" if settings.ENABLE_SWAGGER_DOCS else None,
    openapi_url="/api/openapi.json" if settings.ENABLE_SWAGGER_DOCS else None,
    lifespan=lifespan
)

# ================================
# MIDDLEWARE CONFIGURATION
# ================================

# CORS Middleware - Allow all for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request ID and Timing Middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add request ID and processing time to response headers"""
    start_time = time.time()
    request_id = request.headers.get("X-Request-ID", f"req_{int(time.time() * 1000)}")

    response = await call_next(request)

    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(round(process_time * 1000, 2))

    return response


# ================================
# EXCEPTION HANDLERS
# ================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Validation error",
            "errors": exc.errors(),
            "body": exc.body
        }
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Handle generic exceptions"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "Internal server error",
            "error": str(exc) if settings.DEBUG else "An unexpected error occurred"
        }
    )


# ================================
# HEALTH CHECK ENDPOINTS
# ================================

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint"""
    return {
        "success": True,
        "message": "Precision Receipt API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "success": True,
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.NODE_ENV,
        "timestamp": time.time()
    }


@app.get("/api/ping", tags=["Health"])
async def ping():
    """Simple ping endpoint"""
    return {"success": True, "message": "pong"}


# ================================
# API ROUTERS
# ================================

# Import routers
from app.api.v1 import auth, transactions, receipts, customers, users, branches, deposit_slips, demo, reports, cheque_ocr

# Include routers with /api/v1 prefix
API_PREFIX = f"/api/{settings.API_VERSION}"

app.include_router(
    auth.router,
    prefix=f"{API_PREFIX}/auth",
    tags=["Authentication"]
)

app.include_router(
    transactions.router,
    prefix=f"{API_PREFIX}/transactions",
    tags=["Transactions"]
)

app.include_router(
    receipts.router,
    prefix=f"{API_PREFIX}/receipts",
    tags=["Receipts"]
)

app.include_router(
    customers.router,
    prefix=f"{API_PREFIX}/customers",
    tags=["Customers"]
)

app.include_router(
    users.router,
    prefix=f"{API_PREFIX}/users",
    tags=["Users"]
)

app.include_router(
    branches.router,
    prefix=f"{API_PREFIX}/branches",
    tags=["Branches"]
)

app.include_router(
    deposit_slips.router,
    prefix=f"{API_PREFIX}/deposit-slips",
    tags=["Digital Deposit Slips (DRID)"]
)

app.include_router(
    demo.router,
    prefix=f"{API_PREFIX}/demo",
    tags=["Demo Setup"]
)

app.include_router(
    reports.router,
    prefix=f"{API_PREFIX}/reports",
    tags=["Reports"]
)

app.include_router(
    cheque_ocr.router,
    prefix=f"{API_PREFIX}/cheque-ocr",
    tags=["Cheque OCR"]
)

logger.info("API routers loaded successfully")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
