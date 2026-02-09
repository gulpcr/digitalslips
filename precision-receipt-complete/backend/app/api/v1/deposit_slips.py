# app/api/v1/deposit_slips.py
"""
Digital Deposit Slip (DRID) API Endpoints
Implements the pre-branch deposit initiation flow
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.config import settings
from app.middleware.auth import get_current_user, get_current_active_user
from app.models import User, DigitalDepositSlip, DepositSlipStatus, Branch, Customer, Receipt
from app.services.drid_service import DRIDService
from app.services.notification_service import NotificationService
from app.services.otp_service import OTPService
from app.schemas.deposit_slip import (
    DepositSlipCreate, DepositSlipResponse, DepositSlipCreateResponse,
    DepositSlipStatusResponse, DepositSlipRetrieveResponse,
    DepositSlipVerifyRequest, DepositSlipCompleteRequest,
    DepositSlipCompleteResponse, DepositSlipCancelRequest,
    DepositSlipListResponse
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def slip_to_response(slip: DigitalDepositSlip, db: Session = None) -> DepositSlipResponse:
    """Convert DigitalDepositSlip model to response schema"""
    now = datetime.utcnow()
    time_remaining = max(0, int((slip.expires_at - now).total_seconds())) if slip.expires_at > now else 0

    # Get branch name if available
    branch_name = None
    if db and slip.branch_id:
        branch = db.query(Branch).filter(Branch.id == slip.branch_id).first()
        if branch:
            branch_name = branch.branch_name

    # Get transaction reference if completed
    transaction_reference = None
    if slip.transaction:
        transaction_reference = slip.transaction.reference_number

    return DepositSlipResponse(
        id=str(slip.id),
        drid=slip.drid,
        status=slip.status.value,
        expires_at=slip.expires_at,
        validity_minutes=slip.validity_minutes,
        time_remaining_seconds=time_remaining,
        transaction_type=slip.transaction_type.value,
        customer_cnic=slip.customer_cnic,
        customer_account=slip.customer_account,
        customer_name=slip.customer_name,
        amount=slip.amount,
        currency=slip.currency,
        narration=slip.narration,
        depositor_name=slip.depositor_name,
        depositor_cnic=slip.depositor_cnic,
        depositor_phone=slip.depositor_phone,
        depositor_relationship=slip.depositor_relationship,
        channel=slip.channel.value,
        branch_id=str(slip.branch_id) if slip.branch_id else None,
        branch_name=branch_name,
        additional_data=slip.extra_data,
        created_at=slip.created_at,
        retrieved_at=slip.retrieved_at,
        verified_at=slip.verified_at,
        completed_at=slip.completed_at,
        transaction_id=str(slip.transaction_id) if slip.transaction_id else None,
        transaction_reference=transaction_reference,
        qr_code_data=slip.qr_code_data
    )


# ============================================
# CUSTOMER-FACING ENDPOINTS (Public/Semi-Public)
# ============================================

@router.post("/initiate", response_model=DepositSlipCreateResponse, status_code=status.HTTP_201_CREATED)
async def initiate_deposit_slip(
    slip_data: DepositSlipCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Customer initiates a Digital Deposit Slip (Pre-Branch)

    This is the entry point for customers to create a deposit slip
    before visiting the branch. No authentication required.

    Returns a DRID (Digital Reference ID) valid for 60 minutes.
    """
    # Get client IP
    client_ip = request.client.host if request.client else None

    # Get device info from headers
    device_info = {
        "user_agent": request.headers.get("user-agent"),
        "accept_language": request.headers.get("accept-language"),
    }

    # Create deposit slip
    slip, error = DRIDService.create_deposit_slip(
        db=db,
        transaction_type=slip_data.transaction_type,
        customer_cnic=slip_data.customer_cnic,
        customer_account=slip_data.customer_account,
        amount=slip_data.amount,
        currency=slip_data.currency,
        narration=slip_data.narration,
        depositor_name=slip_data.depositor_name,
        depositor_cnic=slip_data.depositor_cnic,
        depositor_phone=slip_data.depositor_phone,
        depositor_relationship=slip_data.depositor_relationship,
        channel=slip_data.channel,
        device_info=device_info,
        ip_address=client_ip,
        additional_data=slip_data.additional_data
    )

    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )

    return DepositSlipCreateResponse(
        success=True,
        message="Digital Deposit Slip created successfully",
        drid=slip.drid,
        expires_at=slip.expires_at,
        validity_minutes=slip.validity_minutes,
        qr_code_data=slip.qr_code_data,
        instructions=(
            f"Your Digital Reference ID (DRID) is: {slip.drid}\n"
            f"Valid for {slip.validity_minutes} minutes until {slip.expires_at.strftime('%H:%M')}.\n"
            "Please visit any Meezan Bank branch with this DRID to complete your transaction.\n"
            "The teller will retrieve your details using this reference."
        )
    )


@router.get("/status/{drid}", response_model=DepositSlipStatusResponse)
async def check_deposit_slip_status(
    drid: str,
    db: Session = Depends(get_db)
):
    """
    Check status of a DRID (Public endpoint for customers)

    Customers can check if their DRID is still valid, expired, or completed.
    """
    validation = DRIDService.validate_drid(db, drid)

    return DepositSlipStatusResponse(
        success=True,
        drid=drid,
        status=validation.status,
        is_valid=validation.is_valid,
        is_expired=validation.is_expired,
        message=validation.message,
        time_remaining_seconds=validation.time_remaining_seconds,
        can_be_used=validation.is_valid and not validation.is_expired and not validation.is_used
    )


@router.post("/{drid}/cancel", response_model=DepositSlipResponse)
async def cancel_deposit_slip_customer(
    drid: str,
    cancel_request: DepositSlipCancelRequest,
    db: Session = Depends(get_db)
):
    """
    Customer cancels their deposit slip

    Allows customers to cancel their DRID if they no longer wish to proceed.
    """
    slip, error = DRIDService.cancel_deposit_slip(
        db=db,
        drid=drid,
        cancelled_by="CUSTOMER",
        reason=cancel_request.reason
    )

    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )

    return slip_to_response(slip, db)


# ============================================
# TELLER-FACING ENDPOINTS (Authenticated)
# ============================================

@router.get("/retrieve/{drid}", response_model=DepositSlipRetrieveResponse)
async def teller_retrieve_deposit_slip(
    drid: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Teller retrieves deposit slip by DRID

    When depositor arrives at branch with DRID, teller uses this endpoint
    to retrieve all pre-filled transaction details. No re-keying required.
    """
    # First validate DRID
    validation = DRIDService.validate_drid(db, drid)

    if not validation.is_valid:
        return DepositSlipRetrieveResponse(
            success=False,
            message=validation.message,
            deposit_slip=None,
            validation_result=validation.model_dump()
        )

    # Retrieve and mark as retrieved
    slip, error = DRIDService.retrieve_deposit_slip(
        db=db,
        drid=drid,
        teller_id=str(current_user.id)
    )

    if error:
        return DepositSlipRetrieveResponse(
            success=False,
            message=error,
            deposit_slip=None,
            validation_result=validation.model_dump()
        )

    return DepositSlipRetrieveResponse(
        success=True,
        message="Deposit slip retrieved successfully. Please verify details with depositor.",
        deposit_slip=slip_to_response(slip, db),
        validation_result=validation.model_dump()
    )


@router.post("/{drid}/verify", response_model=DepositSlipResponse)
async def teller_verify_deposit_slip(
    drid: str,
    verify_request: DepositSlipVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Teller verifies deposit slip details

    After retrieving the slip, teller confirms:
    - Amount matches cash/instrument
    - Depositor identity verified
    - Instrument verified (for cheque/pay order)
    """
    slip, error = DRIDService.verify_deposit_slip(
        db=db,
        drid=drid,
        teller_id=str(current_user.id),
        amount_confirmed=verify_request.amount_confirmed,
        depositor_verified=verify_request.depositor_identity_verified,
        instrument_verified=verify_request.instrument_verified,
        notes=verify_request.notes
    )

    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )

    return slip_to_response(slip, db)


# ============================================
# OTP ENDPOINTS
# ============================================

@router.post("/{drid}/send-otp")
async def send_otp(
    drid: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Send OTP to customer's registered phone number

    Called by teller after verification to initiate OTP-based authorization.
    """
    # Get deposit slip
    slip = DRIDService.get_deposit_slip_by_drid(db, drid)

    if not slip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DRID not found"
        )

    # Must be in VERIFIED status
    if slip.status != DepositSlipStatus.VERIFIED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot send OTP: deposit slip status is {slip.status.value}. Must be VERIFIED first."
        )

    # OTP goes to depositor (person physically at the bank) for authorization
    depositor_phone = slip.depositor_phone or slip.customer_phone
    if not depositor_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No phone number found for depositor"
        )

    # Send OTP to depositor
    success, message = OTPService.send_otp(depositor_phone, drid)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message
        )

    # Mask phone number for response
    masked_phone = depositor_phone[-4:].rjust(len(depositor_phone), '*')

    return {
        "success": True,
        "message": f"OTP sent to depositor at {masked_phone}",
        "drid": drid,
        "phone_masked": masked_phone
    }


@router.post("/{drid}/verify-otp")
async def verify_otp(
    drid: str,
    otp: str = Query(..., min_length=5, max_length=5, description="5-digit OTP"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Verify OTP entered by depositor

    Called by teller after depositor provides the OTP received via SMS.
    """
    # Get deposit slip
    slip = DRIDService.get_deposit_slip_by_drid(db, drid)

    if not slip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DRID not found"
        )

    # OTP was sent to depositor's phone
    depositor_phone = slip.depositor_phone or slip.customer_phone
    if not depositor_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No phone number found for depositor"
        )

    # Verify OTP (sent to depositor's phone)
    success, message = OTPService.verify_otp(depositor_phone, drid, otp)

    return {
        "success": success,
        "message": message,
        "drid": drid,
        "verified": success
    }


@router.post("/{drid}/complete", response_model=DepositSlipCompleteResponse)
async def teller_complete_deposit_slip(
    drid: str,
    complete_request: DepositSlipCompleteRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Teller completes deposit slip and creates transaction

    This is the final step that:
    - Creates the actual Transaction record
    - Posts to Core Banking (T24)
    - Generates Receipt
    - Sends customer notification (WhatsApp & Email)
    """
    slip, transaction, error = DRIDService.complete_deposit_slip(
        db=db,
        drid=drid,
        teller_id=str(current_user.id),
        authorization_captured=complete_request.authorization_captured,
        teller_notes=complete_request.teller_notes
    )

    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )

    # Get receipt
    receipt_number = None
    receipt = None
    if transaction and transaction.receipts:
        receipt = transaction.receipts[0]
        receipt_number = receipt.receipt_number

    # Send notifications to BOTH account holder and depositor
    if transaction and receipt:
        # Get the deposit slip for depositor info
        slip_obj = DRIDService.get_deposit_slip_by_drid(db, drid)

        # 1. Send to account holder (depositee)
        try:
            customer = db.query(Customer).filter(Customer.id == transaction.customer_id).first()
            if customer:
                logger.info(f"Sending notifications to account holder: {customer.phone} / {customer.email}")
                await NotificationService.send_transaction_notifications(
                    db=db,
                    transaction=transaction,
                    receipt=receipt,
                    customer=customer,
                    send_whatsapp=True,
                    send_email=True,
                    send_sms=True
                )
        except Exception as e:
            logger.error(f"Failed to send account holder notifications: {str(e)}")

        # 2. Send to depositor (if different from account holder)
        if slip_obj:
            depositor_phone = slip_obj.depositor_phone
            customer_phone = slip_obj.customer_phone
            # Only send to depositor if they have a phone and it's different from account holder
            if depositor_phone and depositor_phone != customer_phone:
                try:
                    logger.info(f"Sending notifications to depositor: {depositor_phone}")
                    # WhatsApp to depositor
                    if settings.WHATSAPP_ENABLED:
                        await NotificationService.send_receipt_to_channel(
                            db=db,
                            transaction=transaction,
                            receipt=receipt,
                            channel="WHATSAPP",
                            recipient=depositor_phone
                        )
                    # SMS to depositor
                    if settings.SMS_ENABLED:
                        await NotificationService.send_receipt_to_channel(
                            db=db,
                            transaction=transaction,
                            receipt=receipt,
                            channel="SMS",
                            recipient=depositor_phone
                        )
                except Exception as e:
                    logger.error(f"Failed to send depositor notifications: {str(e)}")

    return DepositSlipCompleteResponse(
        success=True,
        message="Transaction completed successfully",
        drid=drid,
        transaction_id=str(transaction.id),
        transaction_reference=transaction.reference_number,
        receipt_number=receipt_number
    )


@router.post("/{drid}/reject")
async def teller_reject_deposit_slip(
    drid: str,
    reason: str = Query(..., description="Reason for rejection"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Teller rejects a deposit slip

    Use when verification fails or transaction cannot proceed.
    """
    slip = DRIDService.get_deposit_slip_by_drid(db, drid)

    if not slip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DRID not found"
        )

    if slip.status in [DepositSlipStatus.COMPLETED, DepositSlipStatus.EXPIRED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject: current status is {slip.status.value}"
        )

    slip.status = DepositSlipStatus.REJECTED
    slip.rejection_reason = reason
    slip.cancelled_at = datetime.utcnow()
    slip.cancelled_by = current_user.id

    db.commit()
    db.refresh(slip)

    return {
        "success": True,
        "message": "Deposit slip rejected",
        "drid": drid,
        "reason": reason
    }


# ============================================
# LISTING & SEARCH ENDPOINTS
# ============================================

@router.get("/", response_model=DepositSlipListResponse)
async def list_deposit_slips(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    customer_cnic: Optional[str] = None,
    drid: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List deposit slips (Teller/Admin)

    Filter by status, customer CNIC, or search by DRID.
    """
    query = db.query(DigitalDepositSlip)

    # Apply filters
    if status:
        query = query.filter(DigitalDepositSlip.status == DepositSlipStatus[status])

    if customer_cnic:
        query = query.filter(DigitalDepositSlip.customer_cnic == customer_cnic)

    if drid:
        query = query.filter(DigitalDepositSlip.drid.ilike(f"%{drid}%"))

    # Get total count
    total = query.count()

    # Calculate pagination
    skip = (page - 1) * page_size
    total_pages = (total + page_size - 1) // page_size

    # Get paginated results
    slips = query.order_by(DigitalDepositSlip.created_at.desc()).offset(skip).limit(page_size).all()

    return DepositSlipListResponse(
        success=True,
        data=[slip_to_response(s, db) for s in slips],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/pending")
async def get_pending_deposit_slips(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all pending (INITIATED) deposit slips that are still valid

    Useful for tellers to see incoming customers.
    """
    slips = db.query(DigitalDepositSlip).filter(
        DigitalDepositSlip.status == DepositSlipStatus.INITIATED,
        DigitalDepositSlip.expires_at > datetime.utcnow()
    ).order_by(DigitalDepositSlip.created_at.asc()).all()

    return {
        "success": True,
        "count": len(slips),
        "deposit_slips": [slip_to_response(s, db) for s in slips]
    }


@router.get("/{drid}", response_model=DepositSlipResponse)
async def get_deposit_slip(
    drid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get deposit slip details by DRID

    Available for both authenticated users and customers (limited info).
    """
    slip = DRIDService.get_deposit_slip_by_drid(db, drid)

    if not slip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DRID not found"
        )

    return slip_to_response(slip, db)
