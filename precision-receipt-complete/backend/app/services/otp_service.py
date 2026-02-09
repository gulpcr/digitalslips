# app/services/otp_service.py
"""
OTP Service - Send and verify OTPs via Twilio SMS
"""
import random
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory OTP storage (use Redis in production)
_otp_store: Dict[str, dict] = {}


class OTPService:
    """Service for OTP generation, sending via SMS, and verification"""

    # OTP settings
    OTP_LENGTH = 5
    OTP_EXPIRY_MINUTES = 5
    MAX_ATTEMPTS = 3

    @staticmethod
    def generate_otp() -> str:
        """Generate a random 5-digit OTP"""
        return ''.join([str(random.randint(0, 9)) for _ in range(OTPService.OTP_LENGTH)])

    @staticmethod
    def _get_twilio_client() -> Optional[Client]:
        """Get Twilio client"""
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.error("Twilio credentials not configured")
            return None
        return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """Normalize phone number to international format"""
        # Remove any whitespace
        phone = phone.strip()

        # Remove whatsapp: prefix if present
        if phone.startswith('whatsapp:'):
            phone = phone[9:]

        # Ensure it starts with +
        if not phone.startswith('+'):
            # Pakistani number without +
            if phone.startswith('92'):
                phone = '+' + phone
            elif phone.startswith('0'):
                phone = '+92' + phone[1:]
            else:
                phone = '+92' + phone

        return phone

    @staticmethod
    def send_otp(phone_number: str, drid: str) -> Tuple[bool, str]:
        """
        Generate and send OTP via SMS

        Args:
            phone_number: Customer's phone number
            drid: The DRID for which OTP is being sent (used as key)

        Returns:
            Tuple of (success, message)
        """
        try:
            # Normalize phone number
            phone = OTPService._normalize_phone(phone_number)

            # Generate OTP
            otp = OTPService.generate_otp()

            # Store OTP with expiry
            otp_key = f"{drid}:{phone}"
            _otp_store[otp_key] = {
                'otp': otp,
                'phone': phone,
                'drid': drid,
                'created_at': datetime.utcnow(),
                'expires_at': datetime.utcnow() + timedelta(minutes=OTPService.OTP_EXPIRY_MINUTES),
                'attempts': 0,
                'verified': False
            }

            # Get Twilio client
            client = OTPService._get_twilio_client()
            if not client:
                # For demo/testing without Twilio
                logger.warning(f"Twilio not configured. Demo OTP for {phone}: {otp}")
                return True, f"OTP sent (Demo mode). OTP: {otp}"

            # Send SMS via Twilio (use SMS-specific number if available)
            sms_from = settings.TWILIO_SMS_PHONE_NUMBER or settings.TWILIO_PHONE_NUMBER
            message = client.messages.create(
                body=f"Your Meezan Bank transaction OTP is: {otp}. Valid for {OTPService.OTP_EXPIRY_MINUTES} minutes. Do not share this code.",
                from_=sms_from,
                to=phone
            )

            logger.info(f"OTP SMS sent to {phone}, SID: {message.sid}")
            return True, f"OTP sent to {phone[-4:].rjust(len(phone), '*')}"

        except TwilioRestException as e:
            logger.error(f"Twilio error sending OTP: {e}")
            return False, f"Failed to send SMS: {str(e)}"
        except Exception as e:
            logger.error(f"Error sending OTP: {e}")
            return False, f"Failed to send OTP: {str(e)}"

    @staticmethod
    def verify_otp(phone_number: str, drid: str, otp: str) -> Tuple[bool, str]:
        """
        Verify OTP

        Args:
            phone_number: Customer's phone number
            drid: The DRID for which OTP was sent
            otp: The OTP entered by user

        Returns:
            Tuple of (success, message)
        """
        try:
            phone = OTPService._normalize_phone(phone_number)
            otp_key = f"{drid}:{phone}"

            # Check if OTP exists
            if otp_key not in _otp_store:
                return False, "OTP not found. Please request a new OTP."

            otp_data = _otp_store[otp_key]

            # Check if already verified
            if otp_data['verified']:
                return True, "OTP already verified"

            # Check expiry
            if datetime.utcnow() > otp_data['expires_at']:
                del _otp_store[otp_key]
                return False, "OTP has expired. Please request a new OTP."

            # Check attempts
            if otp_data['attempts'] >= OTPService.MAX_ATTEMPTS:
                del _otp_store[otp_key]
                return False, "Maximum attempts exceeded. Please request a new OTP."

            # Increment attempts
            otp_data['attempts'] += 1

            # Verify OTP
            if otp_data['otp'] == otp:
                otp_data['verified'] = True
                logger.info(f"OTP verified for {phone}, DRID: {drid}")
                return True, "OTP verified successfully"
            else:
                remaining = OTPService.MAX_ATTEMPTS - otp_data['attempts']
                return False, f"Invalid OTP. {remaining} attempts remaining."

        except Exception as e:
            logger.error(f"Error verifying OTP: {e}")
            return False, f"Verification error: {str(e)}"

    @staticmethod
    def cleanup_expired():
        """Remove expired OTPs from store"""
        now = datetime.utcnow()
        expired_keys = [
            key for key, data in _otp_store.items()
            if now > data['expires_at']
        ]
        for key in expired_keys:
            del _otp_store[key]
        return len(expired_keys)
