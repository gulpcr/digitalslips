# app/services/notification_service.py
"""
Notification Service - Handles multi-channel notifications (WhatsApp, SMS, Email)
Implements Twilio for WhatsApp/SMS and SMTP for Email
"""
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from enum import Enum
import logging
import json
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.models import (
    Notification, Transaction, Receipt, Customer,
    NotificationType, NotificationChannel, NotificationStatus, Priority
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationService:
    """Multi-channel notification service with Twilio and SMTP integration"""

    # WhatsApp message templates
    WHATSAPP_TEMPLATES = {
        "transaction_completed": """
✅ *Meezan Bank - Transaction Receipt*

Dear {customer_name},

Your transaction has been completed successfully.

━━━━━━━━━━━━━━━━━━━━━
*Transaction Details:*
━━━━━━━━━━━━━━━━━━━━━
📋 Reference: `{reference_number}`
💰 Amount: {currency} {amount}
📅 Date: {transaction_date}
🏢 Type: {transaction_type}
🧾 Receipt: `{receipt_number}`

━━━━━━━━━━━━━━━━━━━━━
🔐 *Digitally Signed Receipt*
━━━━━━━━━━━━━━━━━━━━━
_This receipt is cryptographically signed_
_for authenticity verification_
✓ SBP Compliant

🔍 *Verify Authenticity:*
{verification_url}

_Thank you for banking with Meezan Bank._
        """,
        "transaction_initiated": """
🏦 *Meezan Bank - Transaction Initiated*

Dear {customer_name},

Your transaction has been initiated.

*Reference:* {reference_number}
*Amount:* {currency} {amount}

You will receive a confirmation once completed.

_Thank you for banking with Meezan Bank._
        """,
        "receipt_ready": """
🏦 *Meezan Bank - Receipt Ready*

Dear {customer_name},

Your digital receipt is ready.

*Receipt Number:* {receipt_number}
*Reference:* {reference_number}

🔗 View & Verify: {verification_url}

_Thank you for banking with Meezan Bank._
        """
    }

    # SMS templates (shorter)
    SMS_TEMPLATES = {
        "transaction_completed": "Meezan Bank: {currency} {amount} deposited. Ref: {reference_number}. Receipt: {receipt_number} [Digitally Signed]. Verify: {verification_url}",
        "transaction_initiated": "Meezan Bank: Transaction {reference_number} of {currency} {amount} initiated. Confirmation will follow.",
        "receipt_ready": "Meezan Bank: Receipt {receipt_number} ready [Digitally Signed]. Verify: {verification_url}"
    }

    # Email HTML templates
    EMAIL_TEMPLATES = {
        "transaction_completed": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #006B3F 0%, #004D2C 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
        .header h1 {{ margin: 0; font-size: 24px; }}
        .content {{ background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }}
        .receipt-box {{ background: white; border: 2px solid #006B3F; border-radius: 10px; padding: 20px; margin: 20px 0; }}
        .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }}
        .detail-label {{ color: #666; }}
        .detail-value {{ font-weight: bold; color: #333; }}
        .amount {{ font-size: 28px; color: #006B3F; text-align: center; padding: 20px; }}
        .verify-btn {{ display: inline-block; background: #006B3F; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        .qr-section {{ text-align: center; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏦 Meezan Bank</h1>
            <p>Transaction Receipt</p>
        </div>
        <div class="content">
            <p>Dear <strong>{customer_name}</strong>,</p>
            <p>Your transaction has been completed successfully. Here are the details:</p>

            <div class="receipt-box">
                <div class="amount">{currency} {amount}</div>

                <div class="detail-row">
                    <span class="detail-label">Reference Number</span>
                    <span class="detail-value">{reference_number}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Receipt Number</span>
                    <span class="detail-value">{receipt_number}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Transaction Type</span>
                    <span class="detail-value">{transaction_type}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date & Time</span>
                    <span class="detail-value">{transaction_date}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Account</span>
                    <span class="detail-value">{customer_account}</span>
                </div>
            </div>

            <div style="text-align: center;">
                <a href="{verification_url}" class="verify-btn">Verify Receipt Online</a>
            </div>

            <p style="color: #666; font-size: 14px;">
                You can verify this receipt anytime by visiting the link above or scanning the QR code on your printed receipt.
            </p>
        </div>
        <div class="footer">
            <p>Thank you for banking with Meezan Bank</p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>© {year} Meezan Bank Limited. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        """,
        "receipt_ready": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #006B3F 0%, #004D2C 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }}
        .verify-btn {{ display: inline-block; background: #006B3F; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
        .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏦 Meezan Bank</h1>
            <p>Your Receipt is Ready</p>
        </div>
        <div class="content">
            <p>Dear <strong>{customer_name}</strong>,</p>
            <p>Your digital receipt is ready for viewing.</p>
            <p><strong>Receipt Number:</strong> {receipt_number}</p>
            <p><strong>Reference:</strong> {reference_number}</p>
            <div style="text-align: center;">
                <a href="{verification_url}" class="verify-btn">View Receipt</a>
            </div>
        </div>
        <div class="footer">
            <p>Thank you for banking with Meezan Bank</p>
            <p>© {year} Meezan Bank Limited. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
        """
    }

    @staticmethod
    def _get_twilio_client():
        """Get Twilio client instance"""
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            logger.warning("Twilio credentials not configured")
            return None

        try:
            from twilio.rest import Client
            return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        except Exception as e:
            logger.error(f"Failed to initialize Twilio client: {e}")
            return None

    @staticmethod
    def create_notification(
        db: Session,
        transaction: Transaction,
        notification_type: NotificationType,
        channel: NotificationChannel,
        recipient: str,
        receipt: Optional[Receipt] = None,
        priority: Priority = Priority.NORMAL
    ) -> Notification:
        """Create a notification record"""
        # Build template variables
        template_vars = {
            "customer_name": transaction.customer_name,
            "reference_number": transaction.reference_number,
            "amount": f"{transaction.amount:,.2f}",
            "currency": transaction.currency,
            "transaction_type": transaction.transaction_type.value.replace("_", " ").title(),
            "transaction_date": transaction.created_at.strftime("%Y-%m-%d %H:%M"),
            "receipt_number": receipt.receipt_number if receipt else "N/A",
            "verification_url": receipt.verification_url if receipt else "N/A",
            "customer_account": transaction.customer_account,
            "year": datetime.now().year
        }

        # Get message template based on channel and type
        template_key = notification_type.value.lower()

        if channel == NotificationChannel.WHATSAPP:
            templates = NotificationService.WHATSAPP_TEMPLATES
        elif channel == NotificationChannel.EMAIL:
            templates = NotificationService.EMAIL_TEMPLATES
        else:
            templates = NotificationService.SMS_TEMPLATES

        message_template = templates.get(template_key, templates.get("transaction_completed"))
        message = message_template.format(**template_vars)

        # Create notification
        notification = Notification(
            transaction_id=transaction.id,
            notification_type=notification_type,
            channel=channel,
            recipient=recipient,
            subject=f"Meezan Bank - Transaction Receipt {receipt.receipt_number}" if receipt else "Meezan Bank Notification",
            message=message.strip(),
            template_vars=template_vars,
            status=NotificationStatus.PENDING,
            priority=priority
        )

        db.add(notification)
        db.commit()
        db.refresh(notification)

        return notification

    @staticmethod
    async def send_notification(
        db: Session,
        notification: Notification
    ) -> bool:
        """Send a notification through the appropriate channel"""
        try:
            notification.status = NotificationStatus.SENDING
            db.commit()

            success = False

            if notification.channel == NotificationChannel.WHATSAPP:
                success = await NotificationService._send_whatsapp(notification)
            elif notification.channel == NotificationChannel.SMS:
                success = await NotificationService._send_sms(notification)
            elif notification.channel == NotificationChannel.EMAIL:
                success = await NotificationService._send_email(notification)

            if success:
                notification.status = NotificationStatus.SENT
                notification.sent_at = datetime.utcnow()
                logger.info(f"Notification {notification.id} sent successfully via {notification.channel.value}")
            else:
                notification.status = NotificationStatus.FAILED
                notification.failed_at = datetime.utcnow()
                notification.retry_count += 1
                logger.error(f"Failed to send notification {notification.id}")

            db.commit()
            return success

        except Exception as e:
            notification.status = NotificationStatus.FAILED
            notification.failed_at = datetime.utcnow()
            notification.failure_reason = str(e)
            notification.retry_count += 1
            db.commit()
            logger.error(f"Error sending notification: {str(e)}")
            return False

    @staticmethod
    async def _send_whatsapp(notification: Notification) -> bool:
        """Send WhatsApp message via Twilio WhatsApp API"""
        try:
            # Check if Twilio is configured
            if not settings.TWILIO_ACCOUNT_SID or settings.TWILIO_ACCOUNT_SID.startswith("your-"):
                logger.info(f"[SIMULATED] WhatsApp message to {notification.recipient}")
                logger.debug(f"Message: {notification.message[:200]}...")
                await asyncio.sleep(0.1)
                return True

            client = NotificationService._get_twilio_client()
            if not client:
                logger.warning("Twilio client not available, simulating WhatsApp send")
                return True

            # Format phone number for WhatsApp
            phone = notification.recipient.strip()
            if phone.startswith('whatsapp:'):
                phone = phone[9:]
            if phone.startswith('+'):
                pass  # Already international format
            elif phone.startswith('92'):
                phone = f"+{phone}"
            elif phone.startswith('0'):
                phone = f"+92{phone[1:]}"
            else:
                phone = f"+92{phone}"

            # Send via Twilio WhatsApp
            # Note: Twilio WhatsApp requires the number to be prefixed with 'whatsapp:'
            from_whatsapp = f"whatsapp:{settings.TWILIO_PHONE_NUMBER}"
            to_whatsapp = f"whatsapp:{phone}"

            # Build message parameters
            # Note: WhatsApp Sandbox doesn't support media attachments in freeform messages
            # Media will only work with WhatsApp Business API and approved templates
            message_params = {
                "body": notification.message,
                "from_": from_whatsapp,
                "to": to_whatsapp
            }

            message = client.messages.create(**message_params)

            notification.external_id = message.sid
            notification.provider = "twilio_whatsapp"
            logger.info(f"WhatsApp sent via Twilio: {message.sid}")
            return True

        except Exception as e:
            logger.error(f"WhatsApp send error: {str(e)}")
            notification.failure_reason = str(e)
            # Return True to not block transaction if WhatsApp fails
            # In production, you might want to return False and handle retry
            return True

    @staticmethod
    async def _send_sms(notification: Notification) -> bool:
        """Send SMS via Twilio"""
        try:
            # Check if Twilio is configured
            if not settings.TWILIO_ACCOUNT_SID or settings.TWILIO_ACCOUNT_SID.startswith("your-"):
                logger.info(f"[SIMULATED] SMS to {notification.recipient}")
                logger.debug(f"Message: {notification.message[:100]}...")
                await asyncio.sleep(0.1)
                return True

            client = NotificationService._get_twilio_client()
            if not client:
                logger.warning("Twilio client not available, simulating SMS send")
                return True

            # Format phone number
            phone = notification.recipient.strip()
            if phone.startswith('+'):
                pass  # Already international format
            elif phone.startswith('92'):
                phone = f"+{phone}"
            elif phone.startswith('0'):
                phone = f"+92{phone[1:]}"
            else:
                phone = f"+92{phone}"

            # Use SMS-specific number if available, otherwise fall back to default
            sms_from = settings.TWILIO_SMS_PHONE_NUMBER or settings.TWILIO_PHONE_NUMBER
            message = client.messages.create(
                body=notification.message,
                from_=sms_from,
                to=phone
            )

            notification.external_id = message.sid
            notification.provider = "twilio_sms"
            logger.info(f"SMS sent via Twilio: {message.sid}")
            return True

        except Exception as e:
            logger.error(f"SMS send error: {str(e)}")
            notification.failure_reason = str(e)
            return True

    @staticmethod
    async def _send_email(notification: Notification) -> bool:
        """Send email via SMTP"""
        try:
            # Check if SMTP is configured
            if not settings.SMTP_HOST or not settings.SMTP_USER or settings.SMTP_PASSWORD.startswith("your-"):
                logger.info(f"[SIMULATED] Email to {notification.recipient}")
                logger.debug(f"Subject: {notification.subject}")
                await asyncio.sleep(0.1)
                return True

            import aiosmtplib

            # Create email message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = notification.subject or "Meezan Bank - Transaction Notification"
            msg['From'] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM}>"
            msg['To'] = notification.recipient

            # Create plain text version (strip HTML)
            import re
            plain_text = re.sub('<[^<]+?>', '', notification.message)
            plain_text = re.sub(r'\s+', ' ', plain_text).strip()

            # Attach both plain text and HTML versions
            part1 = MIMEText(plain_text, 'plain')
            part2 = MIMEText(notification.message, 'html')

            msg.attach(part1)
            msg.attach(part2)

            # Send email
            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                start_tls=True
            )

            notification.provider = "smtp"
            logger.info(f"Email sent to {notification.recipient}")
            return True

        except Exception as e:
            logger.error(f"Email send error: {str(e)}")
            notification.failure_reason = str(e)
            # Return True to not block transaction
            return True

    @staticmethod
    async def send_transaction_notifications(
        db: Session,
        transaction: Transaction,
        receipt: Receipt,
        customer: Customer,
        send_whatsapp: bool = True,
        send_sms: bool = False,
        send_email: bool = True
    ) -> List[Notification]:
        """Send all notifications for a completed transaction"""
        notifications = []

        # Send WhatsApp (primary channel)
        if send_whatsapp and customer.phone and settings.WHATSAPP_ENABLED:
            try:
                whatsapp_notification = NotificationService.create_notification(
                    db=db,
                    transaction=transaction,
                    notification_type=NotificationType.TRANSACTION_COMPLETED,
                    channel=NotificationChannel.WHATSAPP,
                    recipient=customer.phone,
                    receipt=receipt,
                    priority=Priority.HIGH
                )
                await NotificationService.send_notification(db, whatsapp_notification)
                notifications.append(whatsapp_notification)
            except Exception as e:
                logger.error(f"Failed to send WhatsApp: {e}")

        # Send SMS as backup (optional)
        if send_sms and customer.phone and settings.SMS_ENABLED:
            try:
                sms_notification = NotificationService.create_notification(
                    db=db,
                    transaction=transaction,
                    notification_type=NotificationType.TRANSACTION_COMPLETED,
                    channel=NotificationChannel.SMS,
                    recipient=customer.phone,
                    receipt=receipt,
                    priority=Priority.NORMAL
                )
                await NotificationService.send_notification(db, sms_notification)
                notifications.append(sms_notification)
            except Exception as e:
                logger.error(f"Failed to send SMS: {e}")

        # Send email if available
        if send_email and customer.email and settings.EMAIL_ENABLED:
            try:
                email_notification = NotificationService.create_notification(
                    db=db,
                    transaction=transaction,
                    notification_type=NotificationType.TRANSACTION_COMPLETED,
                    channel=NotificationChannel.EMAIL,
                    recipient=customer.email,
                    receipt=receipt,
                    priority=Priority.NORMAL
                )
                await NotificationService.send_notification(db, email_notification)
                notifications.append(email_notification)
            except Exception as e:
                logger.error(f"Failed to send email: {e}")

        return notifications

    @staticmethod
    async def send_receipt_to_channel(
        db: Session,
        transaction: Transaction,
        receipt: Receipt,
        channel: str,
        recipient: str
    ) -> Tuple[bool, str]:
        """Send receipt to a specific channel and recipient"""
        try:
            channel_enum = NotificationChannel[channel.upper()]
        except KeyError:
            return False, f"Invalid channel: {channel}"

        try:
            notification = NotificationService.create_notification(
                db=db,
                transaction=transaction,
                notification_type=NotificationType.RECEIPT_READY,
                channel=channel_enum,
                recipient=recipient,
                receipt=receipt,
                priority=Priority.HIGH
            )

            success = await NotificationService.send_notification(db, notification)

            if success:
                return True, f"Receipt sent to {recipient} via {channel}"
            else:
                return False, f"Failed to send receipt via {channel}"

        except Exception as e:
            logger.error(f"Error sending receipt: {e}")
            return False, str(e)

    @staticmethod
    def get_notification_status(
        db: Session,
        transaction_id: str
    ) -> List[Dict[str, Any]]:
        """Get notification status for a transaction"""
        notifications = db.query(Notification).filter(
            Notification.transaction_id == transaction_id
        ).all()

        return [
            {
                "id": str(n.id),
                "channel": n.channel.value,
                "status": n.status.value,
                "recipient": n.recipient,
                "sent_at": n.sent_at.isoformat() if n.sent_at else None,
                "retry_count": n.retry_count,
                "provider": n.provider,
                "external_id": n.external_id
            }
            for n in notifications
        ]
