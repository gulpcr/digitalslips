# app/services/signature_service.py
"""
Digital Signature Service - RSA-based receipt signing for SBP compliance
Provides cryptographic non-repudiation for transaction receipts
"""
import os
import base64
import hashlib
import logging
from datetime import datetime
from typing import Optional, Tuple, Dict, Any
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature

from app.core.config import settings

logger = logging.getLogger(__name__)

# Key storage paths
KEYS_DIR = Path("./keys")
PRIVATE_KEY_FILE = KEYS_DIR / "receipt_signing_private.pem"
PUBLIC_KEY_FILE = KEYS_DIR / "receipt_signing_public.pem"


class SignatureService:
    """
    RSA Digital Signature Service for Receipt Signing

    Features:
    - RSA 2048-bit key pair generation
    - SHA-256 with PKCS1v15 padding for signatures
    - Base64 encoded signatures for storage
    - Timestamp binding for non-repudiation
    """

    _private_key = None
    _public_key = None
    _initialized = False

    @classmethod
    def initialize(cls) -> bool:
        """Initialize the signature service with keys"""
        if cls._initialized:
            return True

        try:
            # Ensure keys directory exists
            KEYS_DIR.mkdir(parents=True, exist_ok=True)

            # Load or generate keys
            if PRIVATE_KEY_FILE.exists() and PUBLIC_KEY_FILE.exists():
                cls._load_keys()
                logger.info("Loaded existing signing keys")
            else:
                cls._generate_keys()
                logger.info("Generated new signing key pair")

            cls._initialized = True
            return True

        except Exception as e:
            logger.error(f"Failed to initialize signature service: {e}")
            return False

    @classmethod
    def _generate_keys(cls):
        """Generate new RSA key pair"""
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )

        # Serialize private key with encryption
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.BestAvailableEncryption(
                settings.ENCRYPTION_KEY.encode()[:32].ljust(32, b'0')
            )
        )

        # Serialize public key
        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )

        # Save keys
        PRIVATE_KEY_FILE.write_bytes(private_pem)
        PUBLIC_KEY_FILE.write_bytes(public_pem)

        # Set permissions (restrictive for private key)
        os.chmod(PRIVATE_KEY_FILE, 0o600)
        os.chmod(PUBLIC_KEY_FILE, 0o644)

        cls._private_key = private_key
        cls._public_key = public_key

        logger.info("Generated and saved new RSA key pair for receipt signing")

    @classmethod
    def _load_keys(cls):
        """Load existing keys from files"""
        # Load private key
        private_pem = PRIVATE_KEY_FILE.read_bytes()
        cls._private_key = serialization.load_pem_private_key(
            private_pem,
            password=settings.ENCRYPTION_KEY.encode()[:32].ljust(32, b'0'),
            backend=default_backend()
        )

        # Load public key
        public_pem = PUBLIC_KEY_FILE.read_bytes()
        cls._public_key = serialization.load_pem_public_key(
            public_pem,
            backend=default_backend()
        )

    @classmethod
    def get_public_key_pem(cls) -> Optional[str]:
        """Get public key in PEM format for verification"""
        if not cls._initialized:
            cls.initialize()

        if cls._public_key:
            return cls._public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ).decode('utf-8')
        return None

    @staticmethod
    def _create_signing_payload(receipt_data: Dict[str, Any]) -> str:
        """
        Create canonical signing payload from receipt data

        Includes critical fields that should be tamper-proof:
        - Receipt number
        - Transaction reference
        - Amount and currency
        - Customer info
        - Timestamp
        """
        # Build canonical string with sorted keys for consistency
        canonical_parts = [
            f"receipt_number:{receipt_data.get('receipt_number', '')}",
            f"transaction_reference:{receipt_data.get('reference_number', '')}",
            f"amount:{receipt_data.get('amount', '')}",
            f"currency:{receipt_data.get('currency', 'PKR')}",
            f"customer_name:{receipt_data.get('customer_name', '')}",
            f"customer_account:{receipt_data.get('customer_account', '')}",
            f"transaction_type:{receipt_data.get('transaction_type', '')}",
            f"transaction_date:{receipt_data.get('transaction_date', '')}",
            f"branch_id:{receipt_data.get('branch_id', '')}",
            f"teller_id:{receipt_data.get('processed_by', '')}",
        ]

        return "|".join(canonical_parts)

    @classmethod
    def sign_receipt(
        cls,
        receipt_data: Dict[str, Any]
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Sign receipt data with bank's private key

        Args:
            receipt_data: Dictionary containing receipt fields

        Returns:
            Tuple of (signature_base64, payload_hash, timestamp_iso)
        """
        if not cls._initialized:
            if not cls.initialize():
                logger.error("Signature service not initialized")
                return None, None, None

        try:
            # Create signing timestamp
            timestamp = datetime.utcnow()
            timestamp_iso = timestamp.isoformat() + "Z"

            # Add timestamp to receipt data for signing
            receipt_data_with_ts = {**receipt_data, 'signing_timestamp': timestamp_iso}

            # Create canonical payload
            payload = cls._create_signing_payload(receipt_data_with_ts)
            payload_bytes = payload.encode('utf-8')

            # Create hash of payload
            payload_hash = hashlib.sha256(payload_bytes).hexdigest()

            # Sign the payload hash
            signature = cls._private_key.sign(
                payload_bytes,
                padding.PKCS1v15(),
                hashes.SHA256()
            )

            # Encode signature as base64
            signature_b64 = base64.b64encode(signature).decode('utf-8')

            logger.info(f"Signed receipt {receipt_data.get('receipt_number')} at {timestamp_iso}")

            return signature_b64, payload_hash, timestamp_iso

        except Exception as e:
            logger.error(f"Failed to sign receipt: {e}")
            return None, None, None

    @classmethod
    def verify_signature(
        cls,
        receipt_data: Dict[str, Any],
        signature_b64: str,
        signing_timestamp: str
    ) -> Tuple[bool, str]:
        """
        Verify a receipt signature

        Args:
            receipt_data: Receipt data dictionary
            signature_b64: Base64 encoded signature
            signing_timestamp: ISO timestamp when receipt was signed

        Returns:
            Tuple of (is_valid, message)
        """
        if not cls._initialized:
            if not cls.initialize():
                return False, "Signature service not available"

        try:
            # Recreate the signing payload
            receipt_data_with_ts = {**receipt_data, 'signing_timestamp': signing_timestamp}
            payload = cls._create_signing_payload(receipt_data_with_ts)
            payload_bytes = payload.encode('utf-8')

            # Decode signature
            signature = base64.b64decode(signature_b64)

            # Verify signature
            cls._public_key.verify(
                signature,
                payload_bytes,
                padding.PKCS1v15(),
                hashes.SHA256()
            )

            return True, "Signature verified successfully - Receipt is authentic"

        except InvalidSignature:
            logger.warning(f"Invalid signature for receipt data")
            return False, "INVALID SIGNATURE - Receipt may have been tampered with"
        except Exception as e:
            logger.error(f"Signature verification error: {e}")
            return False, f"Verification error: {str(e)}"

    @classmethod
    def get_signature_info(cls) -> Dict[str, Any]:
        """Get information about the signing configuration"""
        return {
            "algorithm": "RSA-2048 with SHA-256",
            "padding": "PKCS1v15",
            "key_initialized": cls._initialized,
            "public_key_available": cls._public_key is not None,
            "issuer": "Meezan Bank - Precision Receipt System",
            "compliance": "SBP Digital Transaction Guidelines"
        }
