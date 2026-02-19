# app/services/qr_service.py
"""
QR Code Service - Generates QR codes for receipt verification
"""
import qrcode
import qrcode.image.svg
from io import BytesIO
import base64
import hashlib
import json
from datetime import datetime
from typing import Optional
from decimal import Decimal
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class QRService:
    """QR Code generation service"""

    # Default fallback URL (used when PUBLIC_URL is not configured)
    DEFAULT_VERIFICATION_URL = "https://rcpt-demo.edimensionz.com/verify"

    @staticmethod
    def get_verification_base_url() -> str:
        """Get the verification base URL, using PUBLIC_URL if configured"""
        if settings.PUBLIC_URL:
            # Point to frontend verification page, not API
            return f"{settings.PUBLIC_URL}/verify"
        return QRService.DEFAULT_VERIFICATION_URL

    @staticmethod
    def generate_verification_hash(
        receipt_number: str,
        reference_number: str,
        amount: Decimal,
        customer_name: str,
        transaction_date: datetime
    ) -> str:
        """Generate a verification hash for the receipt"""
        data = f"{receipt_number}:{reference_number}:{amount}:{customer_name}:{transaction_date.isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    @staticmethod
    def generate_qr_data(
        receipt_number: str,
        reference_number: str,
        amount: Decimal,
        currency: str,
        customer_name: str,
        transaction_date: datetime
    ) -> dict:
        """Generate QR code data structure"""
        verification_hash = QRService.generate_verification_hash(
            receipt_number, reference_number, amount, customer_name, transaction_date
        )

        base_url = QRService.get_verification_base_url()
        verification_url = f"{base_url}/{receipt_number}?h={verification_hash}"

        qr_data = {
            "rn": receipt_number,          # Receipt Number
            "ref": reference_number,        # Reference Number
            "amt": str(amount),            # Amount
            "cur": currency,               # Currency
            "cn": customer_name,           # Customer Name
            "dt": transaction_date.strftime("%Y-%m-%d %H:%M"),  # Date
            "url": verification_url,       # Verification URL
            "h": verification_hash         # Hash
        }

        return qr_data

    @staticmethod
    def generate_qr_code_base64(data) -> str:
        """Generate QR code as base64 encoded PNG"""
        try:
            # Create QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=4,
            )

            # Add data - use raw string if given, otherwise JSON encode
            qr.add_data(data if isinstance(data, str) else json.dumps(data))
            qr.make(fit=True)

            # Create image
            img = qr.make_image(fill_color="black", back_color="white")

            # Convert to base64
            buffer = BytesIO()
            img.save(buffer, format='PNG')
            buffer.seek(0)

            base64_qr = base64.b64encode(buffer.getvalue()).decode('utf-8')
            return f"data:image/png;base64,{base64_qr}"

        except Exception as e:
            logger.error(f"Error generating QR code: {str(e)}")
            return ""

    @staticmethod
    def generate_qr_code_svg(data: dict) -> str:
        """Generate QR code as SVG string"""
        try:
            # Create QR code with SVG factory
            factory = qrcode.image.svg.SvgImage
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=4,
                image_factory=factory
            )

            qr.add_data(json.dumps(data))
            qr.make(fit=True)

            img = qr.make_image()

            # Convert to string
            buffer = BytesIO()
            img.save(buffer)
            buffer.seek(0)

            return buffer.getvalue().decode('utf-8')

        except Exception as e:
            logger.error(f"Error generating SVG QR code: {str(e)}")
            return ""

    @staticmethod
    def verify_receipt_hash(
        receipt_number: str,
        reference_number: str,
        amount: Decimal,
        customer_name: str,
        transaction_date: datetime,
        provided_hash: str
    ) -> bool:
        """Verify a receipt hash"""
        expected_hash = QRService.generate_verification_hash(
            receipt_number, reference_number, amount, customer_name, transaction_date
        )
        return expected_hash == provided_hash

    @staticmethod
    def get_verification_url(receipt_number: str, verification_hash: str) -> str:
        """Get the verification URL for a receipt"""
        base_url = QRService.get_verification_base_url()
        return f"{base_url}/{receipt_number}?h={verification_hash}"
