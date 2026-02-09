# app/services/cheque_ocr_service.py
"""
Cheque OCR Service - Uses OpenAI GPT-4 Vision for cheque data extraction
Supports handwritten cheques in English and Urdu
"""
import base64
import logging
import re
from typing import Optional, Tuple
from datetime import datetime
from pydantic import BaseModel
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class ChequeData(BaseModel):
    """Extracted cheque data"""
    cheque_number: Optional[str] = None
    cheque_date: Optional[str] = None  # YYYY-MM-DD format
    bank_name: Optional[str] = None
    branch_name: Optional[str] = None
    amount_in_words: Optional[str] = None
    amount_in_figures: Optional[float] = None
    payee_name: Optional[str] = None
    account_holder_name: Optional[str] = None  # Cheque owner/drawer name (printed on cheque)
    account_number: Optional[str] = None
    micr_code: Optional[str] = None
    signature_status: Optional[str] = None  # 'present', 'missing', 'unclear'
    signature_verified: bool = False
    confidence_score: float = 0.0
    raw_extracted_text: Optional[str] = None
    language_detected: Optional[str] = None  # 'english', 'urdu', 'mixed'
    cheque_image_base64: Optional[str] = None  # Store original image for teller view


class ChequeOCRService:
    """Service for extracting data from cheque images using OpenAI Vision"""

    OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

    # Pakistani banks for validation/matching
    PAKISTANI_BANKS = [
        "Meezan Bank", "Allied Bank", "Askari Bank", "Bank Alfalah",
        "Bank Al-Habib", "Faysal Bank", "Habib Bank", "HBL",
        "JS Bank", "MCB Bank", "National Bank", "NBP",
        "Standard Chartered", "United Bank", "UBL", "Soneri Bank",
        "Bank of Punjab", "Silk Bank", "Summit Bank", "Dubai Islamic Bank"
    ]

    @staticmethod
    def _encode_image_to_base64(image_bytes: bytes) -> str:
        """Convert image bytes to base64 string"""
        return base64.b64encode(image_bytes).decode('utf-8')

    @staticmethod
    def _get_image_media_type(image_bytes: bytes) -> str:
        """Detect image type from bytes"""
        if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
            return "image/png"
        elif image_bytes[:2] == b'\xff\xd8':
            return "image/jpeg"
        elif image_bytes[:4] == b'RIFF' and image_bytes[8:12] == b'WEBP':
            return "image/webp"
        else:
            return "image/jpeg"  # Default

    @staticmethod
    def _auto_rotate_image(image_bytes: bytes) -> bytes:
        """
        Auto-rotate image to correct orientation.
        Handles EXIF rotation and detects landscape cheques that need rotation.
        Cheques are typically wider than tall (landscape orientation).
        """
        try:
            from PIL import Image
            from PIL.ExifTags import TAGS
            import io

            # Open image
            img = Image.open(io.BytesIO(image_bytes))

            # First, handle EXIF orientation (from camera metadata)
            try:
                exif = img._getexif()
                if exif:
                    for tag_id, value in exif.items():
                        tag = TAGS.get(tag_id, tag_id)
                        if tag == 'Orientation':
                            if value == 3:
                                img = img.rotate(180, expand=True)
                            elif value == 6:
                                img = img.rotate(270, expand=True)
                            elif value == 8:
                                img = img.rotate(90, expand=True)
                            break
            except (AttributeError, KeyError, IndexError):
                pass  # No EXIF data

            # Check if image needs rotation based on aspect ratio
            # Cheques are landscape (wider than tall), typically ~2.5:1 ratio
            width, height = img.size

            # If image is portrait (taller than wide), it's likely rotated
            if height > width * 1.2:  # Significantly taller than wide
                # Rotate 90 degrees clockwise to make it landscape
                img = img.rotate(-90, expand=True)
                logger.info(f"Auto-rotated portrait image to landscape: {width}x{height} -> {img.size}")

            # Convert back to bytes
            output = io.BytesIO()
            img_format = img.format or 'JPEG'
            if img_format.upper() == 'PNG':
                img.save(output, format='PNG')
            else:
                # Convert to RGB if necessary (for JPEG)
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                img.save(output, format='JPEG', quality=95)

            return output.getvalue()

        except ImportError:
            logger.warning("PIL/Pillow not installed - skipping auto-rotation")
            return image_bytes
        except Exception as e:
            logger.warning(f"Auto-rotation failed: {e} - using original image")
            return image_bytes

    @staticmethod
    async def extract_cheque_data(
        image_bytes: bytes,
        image_filename: Optional[str] = None
    ) -> Tuple[Optional[ChequeData], Optional[str]]:
        """
        Extract data from cheque image using OpenAI GPT-4 Vision

        Args:
            image_bytes: Raw image bytes
            image_filename: Optional filename for logging

        Returns:
            Tuple of (ChequeData, error_message)
        """
        if not settings.OPENAI_API_KEY:
            return None, "OpenAI API key not configured"

        try:
            # Auto-rotate image if needed (cheques should be landscape)
            image_bytes = ChequeOCRService._auto_rotate_image(image_bytes)

            # Encode image
            base64_image = ChequeOCRService._encode_image_to_base64(image_bytes)
            media_type = ChequeOCRService._get_image_media_type(image_bytes)

            # Build the prompt for cheque extraction - Enhanced for Urdu/Pakistani cheques
            extraction_prompt = """You are an expert OCR system for Pakistani bank cheques. Analyze this cheque image VERY CAREFULLY.

The cheque may be rotated - read it in the correct orientation where text is readable.

Extract and return ONLY a JSON object:
{
    "cheque_number": "6-10 digit number (top right corner or MICR line at bottom)",
    "cheque_date": "YYYY-MM-DD format",
    "bank_name": "full bank name from logo/header",
    "branch_name": "branch name if visible",
    "amount_in_words": "amount in English (translate Urdu if needed)",
    "amount_in_figures": number only (READ CAREFULLY - no extra zeros),
    "payee_name": "recipient name (after 'Pay' field)",
    "account_holder_name": "printed account holder name (drawer's name)",
    "account_number": "IBAN starting with PK or account number",
    "micr_code": "MICR code at bottom",
    "signature_status": "present" or "missing" or "unclear",
    "language_detected": "english" or "urdu" or "mixed",
    "confidence_score": 0.0 to 1.0
}

CRITICAL INSTRUCTIONS - READ VERY CAREFULLY:

1. **AMOUNT IN FIGURES BOX** (Most Important):
   - Look for the box with "PKR" or "Rs." label
   - Read the EXACT digits written - do NOT add extra zeros
   - If written "5000" → return 5000 (NOT 50000)
   - If written "50000" → return 50000
   - If written "5,000" → return 5000
   - COUNT THE DIGITS CAREFULLY
   - Urdu numbers: ۰=0, ۱=1, ۲=2, ۳=3, ۴=4, ۵=5, ۶=6, ۷=7, ۸=8, ۹=9

2. **DATE FORMAT** (CRITICAL - Read EACH box separately):
   - Location: Near "Date" label, has 8 small boxes
   - Format: [D][D] / [M][M] / [Y][Y][Y][Y]
   - Read EACH of the 8 boxes as individual digits: day(2) month(2) year(4)
   - For this cheque, the boxes show: 0,3 | 0,2 | 2,0,2,6
   - That means: Day=03, Month=02, Year=2026 → return "2026-02-03"
   - IMPORTANT: The year has 4 digits - read all 4 (like 2,0,2,6 = 2026)
   - Do NOT misread "2026" as "2022" - count all 4 year digits

3. **URDU AMOUNT WORDS** (Rupees field - MUST READ):
   - Location: The long line after "Rupees" label (handwritten area)
   - This field almost ALWAYS has handwritten text - look carefully!
   - If you see ANY Urdu script (curved/connected letters), READ IT
   - Common patterns:
     * پانچ ہزار روپے = "Five Thousand Rupees"
     * دس ہزار روپے = "Ten Thousand Rupees"
     * پچاس ہزار روپے = "Fifty Thousand Rupees"
   - Return the ENGLISH translation (e.g., "Five Thousand")
   - DO NOT return null if there is handwritten text visible

4. **PAYEE NAME** (Pay field - MUST READ):
   - Location: The line after "Pay" label (handwritten area)
   - This field almost ALWAYS has a handwritten name - look carefully!
   - Urdu names to recognize:
     * گل محمد = "Gul Mohammad"
     * تنویر = "Tanveer"
     * احمد = "Ahmed"
     * محمد علی = "Mohammad Ali"
   - If written in Urdu script, transliterate to English letters
   - If it says "خود" → return "Self"
   - DO NOT return null if there is handwritten text visible

5. **VERIFY CONSISTENCY**:
   - Amount in words should match amount in figures
   - If figures show 5000 and words show "پانچ ہزار" → both are correct (5000)

6. **ACCOUNT HOLDER** (Printed name):
   - This is the PRINTED name on the cheque (drawer's name)
   - Usually appears near the account number or signature area

7. For unclear or missing fields, use null - DO NOT guess or make up values

Return ONLY valid JSON, no other text."""

            # Call OpenAI API
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    ChequeOCRService.OPENAI_API_URL,
                    headers={
                        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": settings.OPENAI_VISION_MODEL,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an expert Urdu and English OCR system specialized in reading Pakistani bank cheques. You can read both printed text and handwritten text in Urdu (Nastaliq script) and English. You MUST read all handwritten fields - the Pay field and Rupees field always contain handwritten text that you must extract. Never return null for fields that have visible text."
                            },
                            {
                                "role": "user",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": extraction_prompt
                                    },
                                    {
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f"data:{media_type};base64,{base64_image}",
                                            "detail": "high"
                                        }
                                    }
                                ]
                            }
                        ],
                        "max_tokens": 1000,
                        "temperature": 0.1  # Low temperature for consistent extraction
                    }
                )

                if response.status_code != 200:
                    error_detail = response.json().get('error', {}).get('message', 'Unknown error')
                    logger.error(f"OpenAI API error: {response.status_code} - {error_detail}")
                    return None, f"OpenAI API error: {error_detail}"

                result = response.json()

            # Parse the response
            content = result['choices'][0]['message']['content']
            logger.info(f"OpenAI response: {content[:500]}")

            # Extract JSON from response
            cheque_data = ChequeOCRService._parse_extraction_response(content)

            if cheque_data:
                # Post-process and validate
                cheque_data = ChequeOCRService._post_process_data(cheque_data)
                cheque_data.raw_extracted_text = content
                # Store original image for teller verification
                cheque_data.cheque_image_base64 = f"data:{media_type};base64,{base64_image}"
                return cheque_data, None
            else:
                return None, "Failed to parse cheque data from image"

        except httpx.TimeoutException:
            logger.error("OpenAI API timeout")
            return None, "Request timeout - please try again"
        except Exception as e:
            logger.error(f"Cheque OCR error: {str(e)}")
            return None, f"OCR processing error: {str(e)}"

    @staticmethod
    def _parse_extraction_response(content: str) -> Optional[ChequeData]:
        """Parse the JSON response from OpenAI"""
        import json

        try:
            # Try to find JSON in the response
            # Sometimes the model adds extra text
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                json_str = json_match.group()
                data = json.loads(json_str)

                # Determine signature verified status
                sig_status = data.get('signature_status', 'unclear')
                sig_verified = sig_status == 'present'

                return ChequeData(
                    cheque_number=data.get('cheque_number'),
                    cheque_date=data.get('cheque_date'),
                    bank_name=data.get('bank_name'),
                    branch_name=data.get('branch_name'),
                    amount_in_words=data.get('amount_in_words'),
                    amount_in_figures=data.get('amount_in_figures'),
                    payee_name=data.get('payee_name'),
                    account_holder_name=data.get('account_holder_name'),
                    account_number=data.get('account_number'),
                    micr_code=data.get('micr_code'),
                    signature_status=sig_status,
                    signature_verified=sig_verified,
                    language_detected=data.get('language_detected'),
                    confidence_score=data.get('confidence_score', 0.5)
                )
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
        except Exception as e:
            logger.error(f"Parse error: {e}")

        return None

    @staticmethod
    def _post_process_data(data: ChequeData) -> ChequeData:
        """Post-process and validate extracted data"""

        # Clean cheque number - keep only digits
        if data.cheque_number:
            data.cheque_number = re.sub(r'\D', '', data.cheque_number)

        # Validate and format date
        if data.cheque_date:
            data.cheque_date = ChequeOCRService._normalize_date(data.cheque_date)

        # Match bank name to known banks
        if data.bank_name:
            data.bank_name = ChequeOCRService._match_bank_name(data.bank_name)

        # Clean amount
        if data.amount_in_figures:
            try:
                # Remove any non-numeric characters except decimal point
                amount_str = re.sub(r'[^\d.]', '', str(data.amount_in_figures))
                data.amount_in_figures = float(amount_str) if amount_str else None
            except:
                data.amount_in_figures = None

        # Clean account number
        if data.account_number:
            data.account_number = re.sub(r'[^\dA-Za-z]', '', data.account_number)

        return data

    @staticmethod
    def _normalize_date(date_str: str) -> Optional[str]:
        """Normalize date to YYYY-MM-DD format"""
        if not date_str:
            return None

        # Already in correct format
        if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            return date_str

        # Try various formats
        formats = [
            '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d',
            '%d/%m/%y', '%d-%m-%y',
            '%B %d, %Y', '%d %B %Y',
            '%d %b %Y', '%b %d, %Y'
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                return dt.strftime('%Y-%m-%d')
            except:
                continue

        return date_str  # Return as-is if no format matched

    @staticmethod
    def _match_bank_name(bank_name: str) -> str:
        """Match extracted bank name to known Pakistani banks"""
        if not bank_name:
            return bank_name

        bank_lower = bank_name.lower()

        for known_bank in ChequeOCRService.PAKISTANI_BANKS:
            if known_bank.lower() in bank_lower or bank_lower in known_bank.lower():
                return known_bank

        # Check common abbreviations
        abbreviations = {
            'hbl': 'Habib Bank Limited',
            'ubl': 'United Bank Limited',
            'nbp': 'National Bank of Pakistan',
            'mcb': 'MCB Bank',
            'scb': 'Standard Chartered Bank',
            'bop': 'Bank of Punjab',
            'dib': 'Dubai Islamic Bank'
        }

        for abbr, full_name in abbreviations.items():
            if abbr in bank_lower:
                return full_name

        return bank_name  # Return original if no match
