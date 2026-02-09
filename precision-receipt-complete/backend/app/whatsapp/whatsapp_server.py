# app/whatsapp/whatsapp_server.py
"""
WhatsApp Webhook Server for Precision Receipt System
Handles incoming Twilio WhatsApp webhooks
Runs on separate port to not interfere with main web server
"""

import logging
import os
import sys
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Request, Form, HTTPException, Depends
from fastapi.responses import Response, PlainTextResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.whatsapp.whatsapp_adapter import WhatsAppAdapter, SessionManager

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app for WhatsApp webhook
app = FastAPI(
    title="Precision Receipt - WhatsApp Server",
    description="WhatsApp webhook server for Meezan Bank Digital Deposit Slip",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global session manager (shared across requests)
session_manager = SessionManager()


def get_db():
    """Database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    logger.info("=" * 60)
    logger.info("Starting Precision Receipt WhatsApp Server")
    logger.info("=" * 60)

    # Initialize database tables if needed
    try:
        init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.warning(f"Database init warning: {e}")

    # Log configuration
    logger.info(f"Twilio Account SID: {settings.TWILIO_ACCOUNT_SID[:10]}..." if settings.TWILIO_ACCOUNT_SID else "Twilio not configured")
    logger.info(f"Twilio Phone: {settings.TWILIO_PHONE_NUMBER}")
    logger.info(f"WhatsApp Enabled: {settings.WHATSAPP_ENABLED}")
    logger.info("=" * 60)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Precision Receipt WhatsApp Server",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "whatsapp-server",
        "timestamp": datetime.utcnow().isoformat()
    }


# ============================================
# VERIFY ENDPOINT - Receipt/Deposit Slip Verification
# ============================================

@app.get("/verify/{receipt_number}")
async def verify_receipt(
    receipt_number: str,
    request: Request,
    h: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Verify a receipt or deposit slip by its number.
    Returns an HTML page showing the verification result.
    """
    from app.models import Receipt, DigitalDepositSlip, Transaction
    from app.services.qr_service import QRService

    logger.info(f"Verification request for: {receipt_number}, hash: {h}")

    try:
        # Determine if this is a receipt or deposit slip
        is_drid = receipt_number.startswith("DRID-")
        is_receipt = receipt_number.startswith("RCP-")

        verified = False
        details = {}

        if is_drid:
            # Look up deposit slip
            slip = db.query(DigitalDepositSlip).filter(
                DigitalDepositSlip.drid == receipt_number
            ).first()

            if slip:
                verified = True
                details = {
                    "type": "Digital Deposit Slip",
                    "reference": slip.drid,
                    "amount": f"PKR {slip.amount:,.2f}",
                    "customer": slip.customer_name or "N/A",
                    "account": f"****{slip.customer_account[-4:]}" if slip.customer_account else "N/A",
                    "status": slip.status.value if slip.status else "pending",
                    "created": slip.created_at.strftime("%Y-%m-%d %H:%M") if slip.created_at else "N/A",
                    "deposit_type": slip.deposit_type.value if slip.deposit_type else "N/A"
                }

        elif is_receipt:
            # Look up receipt
            receipt = db.query(Receipt).filter(
                Receipt.receipt_number == receipt_number
            ).first()

            if receipt:
                # Verify hash if provided
                if h:
                    # Get associated transaction for hash verification
                    transaction = db.query(Transaction).filter(
                        Transaction.id == receipt.transaction_id
                    ).first()

                    if transaction:
                        verified = QRService.verify_receipt_hash(
                            receipt_number=receipt_number,
                            reference_number=transaction.reference_number,
                            amount=transaction.amount,
                            customer_name=transaction.customer_name or "",
                            transaction_date=transaction.created_at,
                            provided_hash=h
                        )
                else:
                    verified = True

                if verified or not h:
                    # Get transaction details
                    transaction = db.query(Transaction).filter(
                        Transaction.id == receipt.transaction_id
                    ).first()

                    details = {
                        "type": "Transaction Receipt",
                        "reference": receipt.receipt_number,
                        "amount": f"PKR {transaction.amount:,.2f}" if transaction else "N/A",
                        "customer": transaction.customer_name if transaction else "N/A",
                        "account": f"****{transaction.customer_account[-4:]}" if transaction and transaction.customer_account else "N/A",
                        "status": transaction.status.value if transaction else "N/A",
                        "created": receipt.created_at.strftime("%Y-%m-%d %H:%M") if receipt.created_at else "N/A",
                        "transaction_type": transaction.transaction_type.value if transaction else "N/A"
                    }
        else:
            # Try both
            slip = db.query(DigitalDepositSlip).filter(
                DigitalDepositSlip.drid == receipt_number
            ).first()

            if slip:
                verified = True
                details = {
                    "type": "Digital Deposit Slip",
                    "reference": slip.drid,
                    "amount": f"PKR {slip.amount:,.2f}",
                    "customer": slip.customer_name or "N/A",
                    "status": slip.status.value if slip.status else "pending"
                }

        # Generate HTML response
        html_content = generate_verification_html(verified, receipt_number, details)
        return HTMLResponse(content=html_content)

    except Exception as e:
        logger.error(f"Verification error: {e}", exc_info=True)
        html_content = generate_verification_html(False, receipt_number, {}, str(e))
        return HTMLResponse(content=html_content, status_code=500)


def generate_verification_html(verified: bool, reference: str, details: dict, error: str = None) -> str:
    """Generate HTML page for verification result"""
    status_color = "#28a745" if verified else "#dc3545"
    status_icon = "✓" if verified else "✗"
    status_text = "Verified" if verified else "Not Found"

    details_html = ""
    if details:
        for key, value in details.items():
            label = key.replace("_", " ").title()
            details_html += f'<tr><td style="padding:8px;font-weight:bold;color:#666;">{label}:</td><td style="padding:8px;">{value}</td></tr>'

    error_html = f'<p style="color:#dc3545;margin-top:20px;">{error}</p>' if error else ""

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meezan Bank - Receipt Verification</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #1a5f3c 0%, #0d3320 100%);
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
            }}
            .card {{
                background: white;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                max-width: 450px;
                width: 100%;
                overflow: hidden;
            }}
            .header {{
                background: #1a5f3c;
                color: white;
                padding: 20px;
                text-align: center;
            }}
            .header img {{
                height: 50px;
                margin-bottom: 10px;
            }}
            .header h1 {{
                margin: 0;
                font-size: 20px;
            }}
            .status {{
                text-align: center;
                padding: 30px;
                border-bottom: 1px solid #eee;
            }}
            .status-icon {{
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: {status_color};
                color: white;
                font-size: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 15px;
            }}
            .status-text {{
                font-size: 24px;
                font-weight: bold;
                color: {status_color};
            }}
            .reference {{
                color: #666;
                font-size: 14px;
                margin-top: 5px;
                font-family: monospace;
            }}
            .details {{
                padding: 20px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
            }}
            .footer {{
                background: #f8f9fa;
                padding: 15px;
                text-align: center;
                font-size: 12px;
                color: #666;
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h1>Meezan Bank</h1>
                <p style="margin:5px 0 0;font-size:14px;">Receipt Verification</p>
            </div>
            <div class="status">
                <div class="status-icon">{status_icon}</div>
                <div class="status-text">{status_text}</div>
                <div class="reference">{reference}</div>
            </div>
            <div class="details">
                <table>
                    {details_html if details_html else '<tr><td colspan="2" style="text-align:center;color:#666;padding:20px;">No details available</td></tr>'}
                </table>
                {error_html}
            </div>
            <div class="footer">
                <p>This is an official verification from Meezan Bank Pakistan</p>
                <p>For queries, contact our helpline: 111-331-331</p>
            </div>
        </div>
    </body>
    </html>
    """


@app.get("/whatsapp/webhook")
async def webhook_verify(request: Request):
    """
    Twilio webhook verification (GET request)
    Used for initial webhook setup verification
    """
    # Twilio doesn't use GET verification like Meta's WhatsApp Business API
    # But we include this for completeness
    return PlainTextResponse("OK")


@app.post("/whatsapp/webhook")
async def webhook_receive(
    request: Request,
    db: Session = Depends(get_db),
    Body: Optional[str] = Form(None),
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    MessageSid: Optional[str] = Form(None),
    NumMedia: Optional[str] = Form("0"),
    MediaUrl0: Optional[str] = Form(None),
    MediaContentType0: Optional[str] = Form(None),
):
    """
    Receive incoming WhatsApp messages from Twilio

    Twilio sends:
    - Body: Message text
    - From: Sender phone (whatsapp:+923001234567)
    - To: Your Twilio number (whatsapp:+14155238886)
    - MessageSid: Unique message ID
    - NumMedia: Number of media attachments
    - MediaUrl0, MediaUrl1, etc.: URLs of media attachments
    """
    try:
        # Log incoming message
        logger.info(f"Incoming WhatsApp message from {From}: {Body[:50] if Body else '[media]'}...")

        # Validate required fields
        if not From:
            logger.error("Missing 'From' field in webhook")
            raise HTTPException(status_code=400, detail="Missing sender phone number")

        # Extract media URL if present
        media_url = None
        if NumMedia and int(NumMedia) > 0 and MediaUrl0:
            media_url = MediaUrl0
            logger.info(f"Media attachment detected: {MediaContentType0}")

        # Create adapter with database session
        adapter = WhatsAppAdapter(db=db, session_manager=session_manager)

        # Process message
        response_text = await adapter.process_message(
            phone_number=From,
            message_text=Body or "",
            media_url=media_url
        )

        # Build TwiML response
        twiml_response = build_twiml_response(response_text)

        logger.info(f"Sending response to {From}: {response_text[:50]}...")

        return Response(
            content=twiml_response,
            media_type="application/xml"
        )

    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)

        # Return error response in TwiML format
        error_twiml = build_twiml_response(
            "We encountered an error. Please try again later or send 'Hi' to restart."
        )
        return Response(
            content=error_twiml,
            media_type="application/xml"
        )


def build_twiml_response(message: str) -> str:
    """
    Build TwiML response for Twilio

    TwiML (Twilio Markup Language) format:
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Message>Your message here</Message>
    </Response>
    """
    # Escape XML special characters
    message = (
        message
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{message}</Message>
</Response>"""


@app.post("/whatsapp/status")
async def webhook_status(
    request: Request,
    MessageSid: Optional[str] = Form(None),
    MessageStatus: Optional[str] = Form(None),
    From: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    ErrorCode: Optional[str] = Form(None),
    ErrorMessage: Optional[str] = Form(None),
):
    """
    Receive message status updates from Twilio

    Status values: queued, sent, delivered, read, failed, undelivered
    """
    logger.info(f"Status update - SID: {MessageSid}, Status: {MessageStatus}")

    if ErrorCode:
        logger.error(f"Message error - Code: {ErrorCode}, Message: {ErrorMessage}")

    return PlainTextResponse("OK")


@app.get("/whatsapp/sessions")
async def get_sessions():
    """Get active session count (for monitoring)"""
    # Cleanup expired sessions first
    cleaned = session_manager.cleanup_expired_sessions()

    return {
        "active_sessions": len(session_manager._sessions),
        "cleaned_sessions": cleaned,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.delete("/whatsapp/sessions/{phone}")
async def clear_session(phone: str):
    """Clear a specific session (for testing)"""
    session_manager.clear_session(phone)
    return {"status": "cleared", "phone": phone}


# ============================================
# NOTIFICATION CALLBACK (for transaction completion)
# ============================================

@app.post("/whatsapp/notify/transaction-complete")
async def notify_transaction_complete(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Endpoint to send transaction completion notification
    Called by the main backend when teller completes a transaction

    Expected JSON body:
    {
        "drid": "DRID-20260205-ABC123",
        "transaction_id": "TXN-...",
        "phone_number": "+923001234567"
    }
    """
    try:
        data = await request.json()

        drid = data.get('drid')
        transaction_id = data.get('transaction_id')
        phone_number = data.get('phone_number')

        if not all([drid, phone_number]):
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Import here to avoid circular imports
        from app.models import DigitalDepositSlip, Transaction, Branch
        from app.whatsapp.whatsapp_messages import WhatsAppMessages

        # Get deposit slip and transaction
        slip = db.query(DigitalDepositSlip).filter(
            DigitalDepositSlip.drid == drid
        ).first()

        if not slip:
            raise HTTPException(status_code=404, detail="DRID not found")

        transaction = None
        if slip.transaction_id:
            transaction = db.query(Transaction).filter(
                Transaction.id == slip.transaction_id
            ).first()

        # Get branch name
        branch_name = "Meezan Bank"
        if slip.branch_id:
            branch = db.query(Branch).filter(Branch.id == slip.branch_id).first()
            if branch:
                branch_name = branch.branch_name

        # Build completion message
        message = WhatsAppMessages.transaction_complete(
            account_number=slip.customer_account,
            amount=slip.amount,
            transaction_id=transaction.reference_number if transaction else drid,
            branch_name=branch_name,
            transaction_date=slip.completed_at or datetime.utcnow(),
            customer_name=slip.customer_name
        )

        # Send via Twilio
        success = await send_whatsapp_message(phone_number, message)

        return {
            "status": "sent" if success else "failed",
            "drid": drid,
            "phone": phone_number
        }

    except Exception as e:
        logger.error(f"Error sending completion notification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def send_whatsapp_message(phone_number: str, message: str) -> bool:
    """Send a WhatsApp message via Twilio"""
    try:
        if not settings.TWILIO_ACCOUNT_SID or settings.TWILIO_ACCOUNT_SID.startswith("your-"):
            logger.info(f"[SIMULATED] WhatsApp to {phone_number}: {message[:50]}...")
            return True

        from twilio.rest import Client

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        # Format phone number
        phone = phone_number
        if not phone.startswith('+'):
            phone = f"+{phone}"
        if phone.startswith('whatsapp:'):
            to_whatsapp = phone
        else:
            to_whatsapp = f"whatsapp:{phone}"

        from_whatsapp = f"whatsapp:{settings.TWILIO_PHONE_NUMBER}"

        msg = client.messages.create(
            body=message,
            from_=from_whatsapp,
            to=to_whatsapp
        )

        logger.info(f"WhatsApp sent: {msg.sid}")
        return True

    except Exception as e:
        logger.error(f"Error sending WhatsApp: {e}")
        return False


# ============================================
# MAIN ENTRY POINT
# ============================================

def main():
    """Run the WhatsApp server"""
    port = int(os.environ.get("WHATSAPP_PORT", 8000))
    host = os.environ.get("WHATSAPP_HOST", "0.0.0.0")
    reload_enabled = os.environ.get("NODE_ENV", "development") == "development"

    logger.info(f"Starting WhatsApp server on {host}:{port}")

    uvicorn.run(
        "app.whatsapp.whatsapp_server:app",
        host=host,
        port=port,
        reload=reload_enabled,
        log_level="info"
    )


if __name__ == "__main__":
    main()
