# app/api/v1/cheque_ocr.py
"""
Cheque OCR API Endpoint
Handles cheque image upload and OCR extraction
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.services.cheque_ocr_service import ChequeOCRService, ChequeData

router = APIRouter()


class ChequeOCRResponse(BaseModel):
    """Response model for cheque OCR"""
    success: bool
    message: str
    data: Optional[ChequeData] = None


@router.post("/scan", response_model=ChequeOCRResponse)
async def scan_cheque(
    file: UploadFile = File(..., description="Cheque image (JPEG, PNG, WebP)")
):
    """
    Scan a cheque image and extract data using OpenAI Vision

    Supports:
    - Handwritten cheques
    - English and Urdu text
    - Various date formats

    Returns extracted cheque details including:
    - Cheque number
    - Date
    - Bank name
    - Amount (in words and figures)
    - Payee name
    - Account number (if visible)
    """
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: JPEG, PNG, WebP. Got: {file.content_type}"
        )

    # Validate file size (max 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB"
        )

    # Process the cheque
    cheque_data, error = await ChequeOCRService.extract_cheque_data(
        image_bytes=contents,
        image_filename=file.filename
    )

    if error:
        return ChequeOCRResponse(
            success=False,
            message=error,
            data=None
        )

    return ChequeOCRResponse(
        success=True,
        message="Cheque scanned successfully",
        data=cheque_data
    )


@router.post("/scan-base64", response_model=ChequeOCRResponse)
async def scan_cheque_base64(
    image_data: str,
    filename: Optional[str] = None
):
    """
    Scan a cheque image from base64 encoded string

    Useful for camera captures from frontend

    Args:
        image_data: Base64 encoded image (with or without data URI prefix)
        filename: Optional filename for logging
    """
    import base64

    try:
        # Remove data URI prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        # Decode base64
        image_bytes = base64.b64decode(image_data)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image data: {str(e)}"
        )

    # Validate size
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image too large. Maximum size is 10MB"
        )

    # Process the cheque
    cheque_data, error = await ChequeOCRService.extract_cheque_data(
        image_bytes=image_bytes,
        image_filename=filename
    )

    if error:
        return ChequeOCRResponse(
            success=False,
            message=error,
            data=None
        )

    return ChequeOCRResponse(
        success=True,
        message="Cheque scanned successfully",
        data=cheque_data
    )
