# app/core/config.py
"""
Application Configuration
Uses Pydantic Settings for environment variable management
"""

from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Precision Receipt"
    APP_VERSION: str = "1.0.0"
    NODE_ENV: str = "development"
    API_VERSION: str = "v1"
    PORT: int = 8000
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "precision_receipt"
    DB_USER: str = "precision"
    DB_PASSWORD: str = "precision123"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 0
    DB_ECHO: bool = False
    
    # Authentication & Security
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    PASSWORD_HASH_SCHEME: str = "bcrypt"
    BCRYPT_ROUNDS: int = 12
    
    ENCRYPTION_KEY: str
    
    SESSION_SECRET: str
    SESSION_TIMEOUT_SECONDS: int = 3600
    MAX_LOGIN_ATTEMPTS: int = 3
    LOCKOUT_DURATION_SECONDS: int = 1800
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: str = "GET,POST,PUT,DELETE,PATCH,OPTIONS"
    CORS_ALLOW_HEADERS: str = "*"
    
    # WhatsApp
    WHATSAPP_ENABLED: bool = True
    WHATSAPP_API_URL: str = ""
    WHATSAPP_API_KEY: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = ""
    
    # SMS (Twilio)
    SMS_ENABLED: bool = True
    SMS_PROVIDER: str = "twilio"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    
    # Email
    EMAIL_ENABLED: bool = True
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_FROM_NAME: str = "Meezan Bank - Precision Receipt"
    
    # T24 Core Banking
    T24_ENABLED: bool = True
    T24_API_URL: str = ""
    T24_API_KEY: str = ""
    T24_TIMEOUT_SECONDS: int = 30
    
    # File Storage
    STORAGE_TYPE: str = "local"
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = ""
    
    # Receipt
    RECEIPT_QR_EXPIRY_HOURS: int = 24
    RECEIPT_PDF_ENABLED: bool = True
    RECEIPT_BLOCKCHAIN_ENABLED: bool = True
    RECEIPT_BLOCKCHAIN_NETWORK: str = "ethereum-mainnet"
    
    BLOCKCHAIN_RPC_URL: str = ""
    BLOCKCHAIN_CONTRACT_ADDRESS: str = ""
    
    # Transaction Limits
    DEFAULT_DAILY_LIMIT: float = 500000.00
    DEFAULT_MONTHLY_LIMIT: float = 5000000.00
    TRANSACTION_FEE_PERCENTAGE: float = 0.01
    MIN_TRANSACTION_FEE: float = 10.00
    MAX_TRANSACTION_FEE: float = 1000.00
    
    # Fraud Detection
    FRAUD_DETECTION_ENABLED: bool = True
    FRAUD_THRESHOLD_SCORE: float = 0.75
    AUTO_BLOCK_SUSPICIOUS: bool = False
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: str = "logs/precision-receipt.log"
    LOG_MAX_BYTES: int = 10485760
    LOG_BACKUP_COUNT: int = 10
    
    # Monitoring
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0
    REDIS_ENABLED: bool = True
    
    # Timezone
    TIMEZONE: str = "Asia/Karachi"
    
    # Feature Flags
    ENABLE_SWAGGER_DOCS: bool = True
    ENABLE_AUDIT_LOGS: bool = True
    ENABLE_NOTIFICATIONS: bool = True
    ENABLE_QR_CODES: bool = True
    ENABLE_BIOMETRIC_AUTH: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
