# app/whatsapp/whatsapp_adapter.py
"""
WhatsApp Adapter for Precision Receipt System
Maps WhatsApp input to existing DRID flow services
"""

import logging
import os
import base64
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field
from sqlalchemy.orm import Session

from app.models import (
    Customer, Account, DigitalDepositSlip,
    TransactionType, Channel, DepositSlipStatus, AccountStatus
)
from app.services.drid_service import DRIDService
from app.services.cheque_ocr_service import ChequeOCRService
from app.whatsapp.whatsapp_messages import WhatsAppMessages
from app.core.config import settings

logger = logging.getLogger(__name__)


class SessionState(str, Enum):
    """Conversation states for WhatsApp flow"""
    # Main menu states
    MAIN_MENU = "MAIN_MENU"
    BRANCH_SERVICES = "BRANCH_SERVICES"

    # Deposit flow states
    DEPOSIT_TYPE = "DEPOSIT_TYPE"
    CUSTOMER_TYPE = "CUSTOMER_TYPE"
    ACCOUNT_SELECTION = "ACCOUNT_SELECTION"
    AMOUNT_INPUT = "AMOUNT_INPUT"
    CONFIRMATION = "CONFIRMATION"

    # Walk-in flow states
    WALKIN_CNIC = "WALKIN_CNIC"
    WALKIN_NAME = "WALKIN_NAME"
    WALKIN_PHONE = "WALKIN_PHONE"
    WALKIN_TARGET_ACCOUNT = "WALKIN_TARGET_ACCOUNT"

    # Business/Merchant flow states
    BUSINESS_NAME = "BUSINESS_NAME"
    BUSINESS_REGISTRATION = "BUSINESS_REGISTRATION"
    BUSINESS_TAX_ID = "BUSINESS_TAX_ID"
    BUSINESS_CONTACT_PERSON = "BUSINESS_CONTACT_PERSON"
    BUSINESS_PHONE = "BUSINESS_PHONE"
    BUSINESS_TARGET_ACCOUNT = "BUSINESS_TARGET_ACCOUNT"

    # Cheque flow states
    CHEQUE_IMAGE = "CHEQUE_IMAGE"
    CHEQUE_CLEARING_TYPE = "CHEQUE_CLEARING_TYPE"
    CHEQUE_CONFIRMATION = "CHEQUE_CONFIRMATION"
    CHEQUE_ACCOUNT_SELECTION = "CHEQUE_ACCOUNT_SELECTION"
    CHEQUE_EDIT_MENU = "CHEQUE_EDIT_MENU"
    CHEQUE_EDIT_AMOUNT = "CHEQUE_EDIT_AMOUNT"
    CHEQUE_EDIT_PAYEE = "CHEQUE_EDIT_PAYEE"
    CHEQUE_EDIT_DATE = "CHEQUE_EDIT_DATE"
    CHEQUE_EDIT_CHEQUE_NUMBER = "CHEQUE_EDIT_CHEQUE_NUMBER"
    CHEQUE_EDIT_CLEARING_TYPE = "CHEQUE_EDIT_CLEARING_TYPE"

    # Pay Order flow states
    PAYORDER_PAYEE_NAME = "PAYORDER_PAYEE_NAME"
    PAYORDER_PAYEE_CNIC = "PAYORDER_PAYEE_CNIC"
    PAYORDER_PAYEE_PHONE = "PAYORDER_PAYEE_PHONE"

    # Other states
    ACTIVE_SLIP_OPTIONS = "ACTIVE_SLIP_OPTIONS"
    CUSTOMER_NOT_FOUND_OPTIONS = "CUSTOMER_NOT_FOUND_OPTIONS"
    CONFIRM_OVERWRITE = "CONFIRM_OVERWRITE"
    CUSTOMER_SELECTION = "CUSTOMER_SELECTION"


@dataclass
class UserSession:
    """Session data for a WhatsApp user"""
    phone_number: str
    state: SessionState = SessionState.MAIN_MENU
    data: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    # Session timeout in minutes
    TIMEOUT_MINUTES: int = 30

    def is_expired(self) -> bool:
        """Check if session has expired"""
        return datetime.utcnow() > self.updated_at + timedelta(minutes=self.TIMEOUT_MINUTES)

    def touch(self) -> None:
        """Update last activity time"""
        self.updated_at = datetime.utcnow()

    def reset(self) -> None:
        """Reset session to initial state"""
        self.state = SessionState.MAIN_MENU
        self.data = {}
        self.touch()


class SessionManager:
    """Manages user sessions in memory"""

    def __init__(self):
        self._sessions: Dict[str, UserSession] = {}

    def get_session(self, phone_number: str) -> UserSession:
        """Get or create session for phone number"""
        # Normalize phone number
        phone = self._normalize_phone(phone_number)

        if phone in self._sessions:
            session = self._sessions[phone]
            if session.is_expired():
                # Reset expired session
                session.reset()
            session.touch()
            return session

        # Create new session
        session = UserSession(phone_number=phone)
        self._sessions[phone] = session
        return session

    def clear_session(self, phone_number: str) -> None:
        """Clear session for phone number"""
        phone = self._normalize_phone(phone_number)
        if phone in self._sessions:
            del self._sessions[phone]

    def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions, return count of removed"""
        expired = [
            phone for phone, session in self._sessions.items()
            if session.is_expired()
        ]
        for phone in expired:
            del self._sessions[phone]
        return len(expired)

    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone number for consistent lookup"""
        # Remove 'whatsapp:' prefix if present
        if phone.startswith('whatsapp:'):
            phone = phone[9:]
        # Strip whitespace
        phone = phone.strip()
        # Remove + prefix
        if phone.startswith('+'):
            phone = phone[1:]
        return phone


class WhatsAppAdapter:
    """
    Adapter that connects WhatsApp messages to existing DRID services
    All business logic is delegated to existing services
    """

    def __init__(self, db: Session, session_manager: Optional[SessionManager] = None):
        self.db = db
        self.session_manager = session_manager or SessionManager()
        self.messages = WhatsAppMessages

    def save_qr_code_image(self, qr_code_base64: str, drid: str) -> Optional[str]:
        """
        Save QR code as PNG file and return public URL

        Args:
            qr_code_base64: Base64 encoded QR code (format: data:image/png;base64,...)
            drid: DRID to use in filename

        Returns:
            Public URL to the QR code image, or None if failed
        """
        try:
            # Extract base64 data (remove data:image/png;base64, prefix)
            if qr_code_base64.startswith('data:image/png;base64,'):
                base64_data = qr_code_base64.split(',')[1]
            else:
                base64_data = qr_code_base64

            # Decode base64 to bytes
            image_bytes = base64.b64decode(base64_data)

            # Create uploads/qrcodes directory if it doesn't exist
            qr_dir = os.path.join('uploads', 'qrcodes')
            os.makedirs(qr_dir, exist_ok=True)

            # Save image with DRID as filename
            filename = f"{drid}.png"
            filepath = os.path.join(qr_dir, filename)

            with open(filepath, 'wb') as f:
                f.write(image_bytes)

            # Generate public URL
            # Use PUBLIC_URL if set (should be ngrok URL for WhatsApp), otherwise use localhost:9001
            base_url = settings.PUBLIC_URL if settings.PUBLIC_URL else 'http://localhost:9001'
            public_url = f"{base_url}/uploads/qrcodes/{filename}"

            logger.info(f"QR code saved: {filepath}, URL: {public_url}")
            return public_url

        except Exception as e:
            logger.error(f"Error saving QR code: {e}", exc_info=True)
            return None

    async def _send_qr_code_to_customer(self, phone_number: str, drid: str, qr_url: str) -> bool:
        """
        Send QR code image to customer via WhatsApp.
        Tries media attachment first, falls back to text with link if media fails
        (e.g. Twilio WhatsApp Sandbox does not support media).

        Args:
            phone_number: Customer's phone number (may have whatsapp: prefix)
            drid: The DRID reference
            qr_url: Public URL to the QR code image

        Returns:
            True if sent successfully, False otherwise
        """
        try:
            # Check if Twilio is configured
            if not settings.TWILIO_ACCOUNT_SID or settings.TWILIO_ACCOUNT_SID.startswith("your-"):
                logger.info(f"[SIMULATED] Would send QR code to {phone_number}: {qr_url}")
                return True

            from twilio.rest import Client

            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

            # Format phone numbers
            phone = phone_number
            if phone.startswith('whatsapp:'):
                to_whatsapp = phone
            else:
                # Normalize phone
                if not phone.startswith('+'):
                    phone = f"+{phone}"
                to_whatsapp = f"whatsapp:{phone}"

            from_whatsapp = f"whatsapp:{settings.TWILIO_PHONE_NUMBER}"

            # Build verification page URL
            base_url = settings.PUBLIC_URL if settings.PUBLIC_URL else 'http://localhost:9001'
            verify_url = f"{base_url}/verify/{drid}"

            # Twilio sandbox (+14155238886) does not support media - send text with links
            # For production WhatsApp Business API, media_url can be used
            is_sandbox = settings.TWILIO_PHONE_NUMBER == "+14155238886"

            if not is_sandbox:
                try:
                    msg = client.messages.create(
                        body=f"📱 *Show this QR code at the branch*\n\nThe teller can scan this QR code to retrieve your deposit slip instantly.\n\n*DRID:* `{drid}`",
                        from_=from_whatsapp,
                        to=to_whatsapp,
                        media_url=[qr_url]
                    )
                    logger.info(f"QR code sent with media to {phone_number}, Message SID: {msg.sid}")
                    return True
                except Exception as media_err:
                    logger.warning(f"Media message failed ({media_err}), falling back to text")

            # Send QR code as clickable links (works on sandbox and production)
            message_body = (
                f"📱 *Your Digital Deposit Slip QR Code*\n\n"
                f"Show this to the teller or let them scan it:\n\n"
                f"🔗 *QR Code:* {qr_url}\n\n"
                f"🔗 *Verify:* {verify_url}\n\n"
                f"*DRID:* `{drid}`\n\n"
                f"_The teller can use this link to retrieve your deposit slip instantly._"
            )

            msg = client.messages.create(
                body=message_body,
                from_=from_whatsapp,
                to=to_whatsapp
            )

            logger.info(f"QR code link sent to {phone_number}, Message SID: {msg.sid}")
            return True

        except Exception as e:
            logger.error(f"Error sending QR code via WhatsApp: {e}", exc_info=True)
            return False

    async def process_message(
        self,
        phone_number: str,
        message_text: str,
        media_url: Optional[str] = None
    ) -> str:
        """
        Process incoming WhatsApp message and return response

        Args:
            phone_number: WhatsApp phone number (with or without whatsapp: prefix)
            message_text: The text message content
            media_url: URL of media attachment (if any)

        Returns:
            Response message to send back
        """
        try:
            # Get or create session
            session = self.session_manager.get_session(phone_number)

            # Clean message text
            message = message_text.strip().lower() if message_text else ""
            original_message = message_text.strip() if message_text else ""

            # Check for greeting/restart
            if self._is_greeting(message):
                session.reset()
                return self.messages.GREETING

            # Check for session expiry
            if session.is_expired():
                session.reset()
                return self.messages.SESSION_EXPIRED

            # Route based on current state
            return await self._handle_state(session, message, original_message, media_url)

        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            return self.messages.ERROR_OCCURRED

    def _is_greeting(self, message: str) -> bool:
        """Check if message is a greeting/restart command"""
        greetings = [
            'hi', 'hello', 'hey', 'start', 'menu', 'home',
            'assalam', 'salam', 'aoa', 'main menu', 'back'
        ]
        return any(g in message for g in greetings)

    async def _handle_state(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Route to appropriate handler based on session state"""

        state_handlers = {
            SessionState.MAIN_MENU: self._handle_main_menu,
            SessionState.BRANCH_SERVICES: self._handle_branch_services,
            SessionState.DEPOSIT_TYPE: self._handle_deposit_type,
            SessionState.CUSTOMER_TYPE: self._handle_customer_type,
            SessionState.ACCOUNT_SELECTION: self._handle_account_selection,
            SessionState.AMOUNT_INPUT: self._handle_amount_input,
            SessionState.CONFIRMATION: self._handle_confirmation,
            SessionState.WALKIN_CNIC: self._handle_walkin_cnic,
            SessionState.WALKIN_NAME: self._handle_walkin_name,
            SessionState.WALKIN_PHONE: self._handle_walkin_phone,
            SessionState.WALKIN_TARGET_ACCOUNT: self._handle_walkin_target_account,
            SessionState.BUSINESS_NAME: self._handle_business_name,
            SessionState.BUSINESS_REGISTRATION: self._handle_business_registration,
            SessionState.BUSINESS_TAX_ID: self._handle_business_tax_id,
            SessionState.BUSINESS_CONTACT_PERSON: self._handle_business_contact_person,
            SessionState.BUSINESS_PHONE: self._handle_business_phone,
            SessionState.BUSINESS_TARGET_ACCOUNT: self._handle_business_target_account,
            SessionState.CHEQUE_IMAGE: self._handle_cheque_image,
            SessionState.CHEQUE_CLEARING_TYPE: self._handle_cheque_clearing_type,
            SessionState.CHEQUE_CONFIRMATION: self._handle_cheque_confirmation,
            SessionState.CHEQUE_ACCOUNT_SELECTION: self._handle_cheque_account_selection,
            SessionState.CHEQUE_EDIT_MENU: self._handle_cheque_edit_menu,
            SessionState.CHEQUE_EDIT_AMOUNT: self._handle_cheque_edit_amount,
            SessionState.CHEQUE_EDIT_PAYEE: self._handle_cheque_edit_payee,
            SessionState.CHEQUE_EDIT_DATE: self._handle_cheque_edit_date,
            SessionState.CHEQUE_EDIT_CHEQUE_NUMBER: self._handle_cheque_edit_cheque_number,
            SessionState.CHEQUE_EDIT_CLEARING_TYPE: self._handle_cheque_edit_clearing_type,
            SessionState.PAYORDER_PAYEE_NAME: self._handle_payorder_payee_name,
            SessionState.PAYORDER_PAYEE_CNIC: self._handle_payorder_payee_cnic,
            SessionState.PAYORDER_PAYEE_PHONE: self._handle_payorder_payee_phone,
            SessionState.ACTIVE_SLIP_OPTIONS: self._handle_active_slip_options,
            SessionState.CUSTOMER_NOT_FOUND_OPTIONS: self._handle_customer_not_found_options,
            SessionState.CONFIRM_OVERWRITE: self._handle_confirm_overwrite,
            SessionState.CUSTOMER_SELECTION: self._handle_customer_selection,
        }

        handler = state_handlers.get(session.state)
        if handler:
            return await handler(session, message, original_message, media_url)

        # Unknown state, reset to main menu
        session.reset()
        return self.messages.GREETING

    # ============================================
    # MAIN MENU HANDLERS
    # ============================================

    async def _handle_main_menu(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle main menu selection"""
        if message == '1':
            # Account Services - placeholder
            return self.messages.ACCOUNT_SERVICES_PLACEHOLDER
        elif message == '2':
            # Card Services - placeholder
            return self.messages.CARD_SERVICES_PLACEHOLDER
        elif message == '3':
            # Branch Services
            session.state = SessionState.BRANCH_SERVICES
            return self.messages.BRANCH_SERVICES_MENU
        elif message == '4':
            # Complaints & Support - placeholder
            return self.messages.COMPLAINTS_PLACEHOLDER
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.GREETING

    async def _handle_branch_services(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle branch services menu selection"""
        if message == '1':
            # Digital Deposit Slip
            session.state = SessionState.DEPOSIT_TYPE
            return self.messages.DEPOSIT_TYPE_MENU
        elif message == '2':
            # Appointment Booking - placeholder
            return self.messages.APPOINTMENT_PLACEHOLDER
        elif message == '3':
            # Branch Locator - placeholder
            return self.messages.BRANCH_LOCATOR_PLACEHOLDER
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.BRANCH_SERVICES_MENU

    async def _handle_deposit_type(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle deposit type selection"""
        if message == '1':
            # Cash Deposit
            session.data['transaction_type'] = 'CASH_DEPOSIT'
            session.state = SessionState.CUSTOMER_TYPE
            return self.messages.CUSTOMER_TYPE_MENU
        elif message == '2':
            # Cheque Deposit
            session.data['transaction_type'] = 'CHEQUE_DEPOSIT'
            session.state = SessionState.CHEQUE_IMAGE
            return self.messages.CHEQUE_IMAGE_REQUEST
        elif message == '3':
            # Pay Order
            session.data['transaction_type'] = 'PAY_ORDER'
            session.state = SessionState.CUSTOMER_TYPE
            return self.messages.CUSTOMER_TYPE_MENU
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.DEPOSIT_TYPE_MENU

    # ============================================
    # CUSTOMER TYPE HANDLERS
    # ============================================

    async def _handle_customer_type(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle customer type selection (Meezan customer, walk-in, or business)"""
        if message == '1':
            # Meezan Customer - lookup by phone
            session.data['is_meezan_customer'] = True
            return await self._lookup_customer_accounts(session)
        elif message == '2':
            # Walk-in customer
            session.data['is_meezan_customer'] = False
            session.state = SessionState.WALKIN_CNIC
            return self.messages.WALKIN_CNIC_REQUEST
        elif message == '3':
            # Business/Merchant
            session.data['is_business'] = True
            session.state = SessionState.BUSINESS_NAME
            return self.messages.BUSINESS_NAME_REQUEST
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.CUSTOMER_TYPE_MENU

    async def _lookup_customer_accounts(self, session: UserSession) -> str:
        """Lookup customer and their accounts by phone number"""
        phone = session.phone_number

        # Try different phone formats
        phone_variants = self._get_phone_variants(phone)

        logger.info(f"Looking up customer with phone: {phone}")
        logger.info(f"Phone variants to search: {phone_variants}")

        # Find ALL customers with matching phone
        customers = []
        for variant in phone_variants:
            logger.info(f"Trying variant: '{variant}'")
            found = self.db.query(Customer).filter(
                Customer.phone == variant
            ).all()
            if found:
                customers.extend(found)
                break

        if not customers:
            logger.info("Customer NOT FOUND in database")
            session.state = SessionState.CUSTOMER_NOT_FOUND_OPTIONS
            return self.messages.CUSTOMER_NOT_FOUND

        # If multiple customers found, show selection
        if len(customers) > 1:
            logger.info(f"Found {len(customers)} customers with same phone")
            session.data['customers_list'] = [
                {
                    'id': str(c.id),
                    'full_name': c.full_name,
                    'cnic': c.cnic,
                    'phone': c.phone
                }
                for c in customers
            ]
            session.state = SessionState.CUSTOMER_SELECTION

            # Build selection message
            msg = "*Multiple Profiles Found*\n\nPlease select your profile:\n\n"
            for i, c in enumerate(customers, 1):
                masked_cnic = f"*****{c.cnic[-6:]}" if c.cnic else "N/A"
                msg += f"{self.messages.get_number_emoji(i)} {c.full_name} ({masked_cnic})\n"
            msg += "\n_Reply with the option number_"
            return msg

        # Single customer found
        customer = customers[0]
        logger.info(f"Found customer: {customer.full_name}")

        # Store customer info
        session.data['customer_id'] = str(customer.id)
        session.data['customer_cnic'] = customer.cnic
        session.data['customer_name'] = customer.full_name
        session.data['customer_phone'] = customer.phone

        # Get customer accounts
        accounts = self.db.query(Account).filter(
            Account.customer_id == customer.id,
            Account.account_status == AccountStatus.ACTIVE
        ).all()

        if not accounts:
            # No active accounts
            session.state = SessionState.CUSTOMER_NOT_FOUND_OPTIONS
            return self.messages.CUSTOMER_NOT_FOUND

        # Store accounts for selection
        session.data['accounts'] = [
            {
                'id': str(acc.id),
                'account_number': acc.account_number,
                'account_type': acc.account_type.value
            }
            for acc in accounts
        ]

        session.state = SessionState.ACCOUNT_SELECTION
        return self.messages.account_selection(session.data['accounts'])

    def _get_phone_variants(self, phone: str) -> List[str]:
        """Generate phone number variants for lookup"""
        # Normalize: remove whatsapp prefix and +
        if phone.startswith('whatsapp:'):
            phone = phone[9:]
        phone = phone.strip()  # Remove any whitespace
        phone = phone.lstrip('+')

        variants = [phone]

        # If starts with country code
        if phone.startswith('92'):
            local = '0' + phone[2:]
            variants.append(local)
            variants.append('+' + phone)
        # If starts with 0
        elif phone.startswith('0'):
            international = '92' + phone[1:]
            variants.append(international)
            variants.append('+' + international)

        return variants

    async def _handle_customer_not_found_options(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle customer not found options"""
        if message == '1':
            # Continue as walk-in
            session.data['is_meezan_customer'] = False
            session.state = SessionState.WALKIN_CNIC
            return self.messages.WALKIN_CNIC_REQUEST
        elif message == '2':
            # Cancel
            session.reset()
            return self.messages.CANCELLED
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.CUSTOMER_NOT_FOUND

    async def _handle_customer_selection(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle customer selection when multiple customers have same phone"""
        try:
            choice = int(message)
            customers_list = session.data.get('customers_list', [])

            if 1 <= choice <= len(customers_list):
                selected = customers_list[choice - 1]

                # Store selected customer info
                session.data['customer_id'] = selected['id']
                session.data['customer_cnic'] = selected['cnic']
                session.data['customer_name'] = selected['full_name']
                session.data['customer_phone'] = selected['phone']

                # Get customer accounts
                accounts = self.db.query(Account).filter(
                    Account.customer_id == selected['id'],
                    Account.account_status == AccountStatus.ACTIVE
                ).all()

                if not accounts:
                    session.state = SessionState.CUSTOMER_NOT_FOUND_OPTIONS
                    return f"No active accounts found for {selected['full_name']}.\n\n" + self.messages.CUSTOMER_NOT_FOUND

                # Store accounts for selection
                session.data['accounts'] = [
                    {
                        'id': str(acc.id),
                        'account_number': acc.account_number,
                        'account_type': acc.account_type.value
                    }
                    for acc in accounts
                ]

                session.state = SessionState.ACCOUNT_SELECTION
                return f"*Welcome {selected['full_name']}!*\n\n" + self.messages.account_selection(session.data['accounts'])
            else:
                # Invalid choice - show list again
                customers_list = session.data.get('customers_list', [])
                msg = "*Invalid Selection*\n\nPlease select your profile:\n\n"
                for i, c in enumerate(customers_list, 1):
                    masked_cnic = f"*****{c['cnic'][-6:]}" if c.get('cnic') else "N/A"
                    msg += f"{self.messages.get_number_emoji(i)} {c['full_name']} ({masked_cnic})\n"
                msg += "\n_Reply with the option number_"
                return msg
        except ValueError:
            # Not a number - show list again
            customers_list = session.data.get('customers_list', [])
            msg = "*Invalid Selection*\n\nPlease select your profile:\n\n"
            for i, c in enumerate(customers_list, 1):
                masked_cnic = f"*****{c['cnic'][-6:]}" if c.get('cnic') else "N/A"
                msg += f"{self.messages.get_number_emoji(i)} {c['full_name']} ({masked_cnic})\n"
            msg += "\n_Reply with the option number_"
            return msg

    async def _handle_active_slip_options(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle options when active slip exists"""
        if message == '1':
            # View existing slip
            drid = session.data.get('existing_drid')
            slip = DRIDService.get_deposit_slip_by_drid(self.db, drid)
            if slip:
                return self.messages.drid_success(
                    drid=slip.drid,
                    amount=slip.amount,
                    validity_minutes=slip.validity_minutes,
                    customer_name=slip.customer_name,
                    account_number=slip.customer_account
                )
            session.reset()
            return self.messages.ERROR_OCCURRED
        elif message == '2':
            # Cancel existing slip and continue current flow
            drid = session.data.get('existing_drid')
            slip, error = DRIDService.cancel_deposit_slip(
                self.db, drid, "CUSTOMER", "Cancelled by customer via WhatsApp"
            )
            if error:
                return f"Could not cancel slip: {error}\n\nSend *Hi* to start again."

            # Remove existing slip data but preserve current transaction data (cheque_data, transaction_type, etc.)
            session.data.pop('existing_drid', None)
            session.data.pop('existing_slip_status', None)

            # Continue the flow - go to account selection
            accounts = session.data.get('accounts', [])
            if accounts:
                session.state = SessionState.ACCOUNT_SELECTION
                return "Existing slip cancelled.\n\n" + self.messages.account_selection(accounts)
            else:
                # No accounts, restart flow
                session.reset()
                return "Existing slip cancelled.\n\nSend *Hi* to create a new deposit slip."
        elif message == '3':
            # Return to main menu
            session.reset()
            return self.messages.GREETING
        else:
            return self.messages.INVALID_OPTION

    async def _handle_confirm_overwrite(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle confirmation to overwrite existing deposit slip"""
        if message == '1':
            # Yes - Cancel old slip and create new one
            existing_drid = session.data.get('existing_drid')
            if existing_drid:
                slip, error = DRIDService.cancel_deposit_slip(
                    self.db, existing_drid, "CUSTOMER", "Cancelled by customer to create new slip via WhatsApp"
                )
                if error:
                    logger.error(f"Error cancelling existing slip: {error}")
                    session.reset()
                    return f"Could not cancel existing slip: {error}\n\nSend *Hi* to start again."

            # Remove existing slip data
            session.data.pop('existing_drid', None)
            session.data.pop('existing_slip_status', None)

            # Now create the new slip
            return await self._create_deposit_slip(session)

        elif message == '2':
            # No - Keep existing slip
            existing_drid = session.data.get('existing_drid')
            session.reset()
            return f"""*Keeping Existing Slip*

Your existing deposit slip is still active:

*DRID:* `{existing_drid}`

Visit any Meezan Bank branch to complete your deposit.

Send *Hi* to return to main menu."""

        else:
            existing_drid = session.data.get('existing_drid', 'N/A')
            status = session.data.get('existing_slip_status', 'UNKNOWN')
            return f"""*Invalid Selection*

You already have an active deposit slip:

*DRID:* `{existing_drid}`
*Status:* {status}

Would you like to cancel it and create a new one?

1️⃣ Yes - Cancel old slip and create new
2️⃣ No - Keep existing slip

_Reply with the option number_"""

    # ============================================
    # ACCOUNT SELECTION HANDLERS
    # ============================================

    async def _handle_account_selection(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle account selection"""
        try:
            choice = int(message)
            accounts = session.data.get('accounts', [])

            if 1 <= choice <= len(accounts):
                selected = accounts[choice - 1]
                session.data['selected_account'] = selected['account_number']
                session.data['selected_account_id'] = selected['id']

                # For Pay Order, redirect to payee information capture
                if session.data.get('transaction_type') == 'PAY_ORDER':
                    session.state = SessionState.PAYORDER_PAYEE_NAME
                    return self.messages.PAYORDER_PAYEE_NAME_REQUEST

                # For cheque deposits, amount is already set from OCR - skip to confirmation
                if session.data.get('amount'):
                    session.state = SessionState.CONFIRMATION
                    return self.messages.confirmation_summary(
                        account_number=session.data.get('selected_account'),
                        customer_name=session.data.get('customer_name'),
                        amount=session.data.get('amount'),
                        transaction_type=session.data.get('transaction_type', 'CASH_DEPOSIT').replace('_', ' ').title(),
                        depositor_name=session.data.get('depositor_name'),
                        depositor_cnic=session.data.get('depositor_cnic'),
                        depositor_phone=session.data.get('depositor_phone'),
                        payee_name=session.data.get('payee_name'),
                        payee_cnic=session.data.get('payee_cnic'),
                        payee_phone=session.data.get('payee_phone')
                    )
                else:
                    session.state = SessionState.AMOUNT_INPUT
                    return self.messages.AMOUNT_REQUEST
            else:
                return self.messages.INVALID_OPTION + "\n" + self.messages.account_selection(accounts)
        except ValueError:
            accounts = session.data.get('accounts', [])
            return self.messages.INVALID_OPTION + "\n" + self.messages.account_selection(accounts)

    # ============================================
    # AMOUNT INPUT HANDLERS
    # ============================================

    async def _handle_amount_input(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle amount input"""
        amount = self.messages.validate_amount(original_message)

        if not amount:
            return self.messages.INVALID_AMOUNT

        session.data['amount'] = amount
        session.state = SessionState.CONFIRMATION

        return self.messages.confirmation_summary(
            account_number=session.data.get('selected_account'),
            customer_name=session.data.get('customer_name'),
            amount=amount,
            transaction_type=session.data.get('transaction_type', 'CASH_DEPOSIT').replace('_', ' ').title(),
            depositor_name=session.data.get('depositor_name'),
            depositor_cnic=session.data.get('depositor_cnic'),
            depositor_phone=session.data.get('depositor_phone'),
            payee_name=session.data.get('payee_name'),
            payee_cnic=session.data.get('payee_cnic'),
            payee_phone=session.data.get('payee_phone')
        )

    # ============================================
    # CONFIRMATION HANDLERS
    # ============================================

    async def _handle_confirmation(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle confirmation"""
        if message == '1':
            # Confirm - create deposit slip using EXISTING DRIDService
            return await self._create_deposit_slip(session)
        elif message == '2':
            # Cancel
            session.reset()
            return self.messages.CANCELLED
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.confirmation_summary(
                account_number=session.data.get('selected_account'),
                customer_name=session.data.get('customer_name'),
                amount=session.data.get('amount'),
                transaction_type=session.data.get('transaction_type', 'CASH_DEPOSIT').replace('_', ' ').title(),
                depositor_name=session.data.get('depositor_name'),
                depositor_cnic=session.data.get('depositor_cnic'),
                depositor_phone=session.data.get('depositor_phone'),
                payee_name=session.data.get('payee_name'),
                payee_cnic=session.data.get('payee_cnic'),
                payee_phone=session.data.get('payee_phone')
            )

    async def _create_deposit_slip(self, session: UserSession) -> str:
        """Create deposit slip using EXISTING DRIDService"""
        try:
            # Prepare additional data based on transaction type
            additional_data = None
            if session.data.get('cheque_data'):
                additional_data = session.data['cheque_data']
            elif session.data.get('transaction_type') == 'PAY_ORDER':
                additional_data = {
                    'payee_name': session.data.get('payee_name'),
                    'payee_cnic': session.data.get('payee_cnic'),
                    'payee_phone': session.data.get('payee_phone')
                }
            elif session.data.get('is_business'):
                additional_data = {
                    'business_name': session.data.get('business_name'),
                    'business_registration_number': session.data.get('business_registration_number'),
                    'business_tax_id': session.data.get('business_tax_id'),
                    'business_contact_person': session.data.get('business_contact_person'),
                    'business_phone': session.data.get('business_phone')
                }

            # Call EXISTING DRIDService.create_deposit_slip()
            slip, error = DRIDService.create_deposit_slip(
                db=self.db,
                transaction_type=session.data.get('transaction_type', 'CASH_DEPOSIT'),
                customer_cnic=session.data.get('customer_cnic'),
                customer_account=session.data.get('selected_account'),
                amount=session.data.get('amount'),
                currency="PKR",
                narration=f"Deposit initiated via WhatsApp",
                depositor_name=session.data.get('depositor_name'),
                depositor_cnic=session.data.get('depositor_cnic'),
                depositor_phone=session.data.get('depositor_phone'),
                depositor_relationship=session.data.get('depositor_relationship', 'SELF'),
                channel="WHATSAPP",  # Using WhatsApp channel
                device_info={"source": "whatsapp", "phone": session.phone_number},
                ip_address=None,
                validity_minutes=60,
                additional_data=additional_data
            )

            if error:
                # Check if it's an existing slip error
                if error.startswith("EXISTING_SLIP:"):
                    existing_drid = error.split(":")[1]
                    session.data['existing_drid'] = existing_drid
                    # Get status of existing slip
                    existing_slip = DRIDService.get_deposit_slip_by_drid(self.db, existing_drid)
                    status = existing_slip.status.value if existing_slip else "UNKNOWN"
                    session.data['existing_slip_status'] = status
                    session.state = SessionState.CONFIRM_OVERWRITE
                    return f"""*Active Deposit Slip Found*

You already have an active deposit slip:

*DRID:* `{existing_drid}`
*Status:* {status}

Would you like to cancel it and create a new one?

1️⃣ Yes - Cancel old slip and create new
2️⃣ No - Keep existing slip

_Reply with the option number_"""

                logger.error(f"Error creating deposit slip: {error}")
                return f"*Error*\n\n{error}\n\nSend *Hi* to try again."

            # Success - send DRID message
            response = self.messages.drid_success(
                drid=slip.drid,
                amount=slip.amount,
                validity_minutes=slip.validity_minutes,
                customer_name=slip.customer_name,
                account_number=slip.customer_account
            )

            # Send QR code image as separate message
            if slip.qr_code_data:
                try:
                    # Save QR code to file and get public URL
                    qr_url = self.save_qr_code_image(slip.qr_code_data, slip.drid)

                    if qr_url:
                        # Send QR code image via WhatsApp
                        await self._send_qr_code_to_customer(session.phone_number, slip.drid, qr_url)
                except Exception as e:
                    logger.error(f"Error sending QR code: {e}", exc_info=True)
                    # Don't fail the whole flow if QR sending fails

            # Reset session
            session.reset()

            return response

        except Exception as e:
            logger.error(f"Error creating deposit slip: {e}", exc_info=True)
            session.reset()
            return self.messages.ERROR_OCCURRED

    # ============================================
    # WALK-IN FLOW HANDLERS
    # ============================================

    async def _handle_walkin_cnic(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle walk-in CNIC input"""
        if not self.messages.validate_cnic(original_message):
            return self.messages.INVALID_CNIC

        cnic = self.messages.format_cnic(original_message)
        session.data['depositor_cnic'] = cnic

        # Try to find depositor by CNIC to auto-fill their info
        customer = self.db.query(Customer).filter(Customer.cnic == cnic).first()

        if customer:
            # Found in DB - pre-fill name, but still ask to confirm/change
            session.data['depositor_name_prefill'] = customer.full_name
            session.data['depositor_phone_prefill'] = customer.phone

        # Always ask for name (with pre-fill hint if found in DB)
        session.state = SessionState.WALKIN_NAME
        if customer:
            return f"*CNIC Verified!*\n\nWe found: *{customer.full_name}*\n\n" + self.messages.WALKIN_NAME_REQUEST + f"\n\n_Send *ok* to use: {customer.full_name}_"
        return self.messages.WALKIN_NAME_REQUEST

    async def _handle_walkin_name(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle walk-in name input"""
        # Allow "ok" to accept pre-filled name from DB
        if message == 'ok' and session.data.get('depositor_name_prefill'):
            session.data['depositor_name'] = session.data['depositor_name_prefill']
        else:
            name = original_message.strip()
            if len(name) < 3:
                return "Please enter a valid name (at least 3 characters):"
            session.data['depositor_name'] = name

        session.state = SessionState.WALKIN_PHONE
        prefill_phone = session.data.get('depositor_phone_prefill')
        if prefill_phone:
            return self.messages.WALKIN_PHONE_REQUEST + f"\n\n_Send *ok* to use: {prefill_phone}_"
        return self.messages.WALKIN_PHONE_REQUEST

    async def _handle_walkin_phone(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle walk-in phone input"""
        # Allow "ok" to accept pre-filled phone from DB
        if message == 'ok' and session.data.get('depositor_phone_prefill'):
            session.data['depositor_phone'] = session.data['depositor_phone_prefill']
        else:
            if not self.messages.validate_phone(original_message):
                return self.messages.INVALID_PHONE
            phone = self.messages.clean_phone_number(original_message)
            session.data['depositor_phone'] = phone

        session.state = SessionState.WALKIN_TARGET_ACCOUNT
        return self.messages.WALKIN_TARGET_ACCOUNT_REQUEST

    async def _handle_walkin_target_account(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle walk-in target account input"""
        account_number = original_message.strip()

        # Validate account exists
        account = self.db.query(Account).filter(
            Account.account_number == account_number,
            Account.account_status == AccountStatus.ACTIVE
        ).first()

        if not account:
            return self.messages.ACCOUNT_NOT_FOUND

        # Get customer info for this account
        customer = self.db.query(Customer).filter(
            Customer.id == account.customer_id
        ).first()

        if not customer:
            return self.messages.ACCOUNT_NOT_FOUND

        # Store account and customer info
        session.data['selected_account'] = account.account_number
        session.data['selected_account_id'] = str(account.id)
        session.data['customer_id'] = str(customer.id)
        session.data['customer_cnic'] = customer.cnic
        session.data['customer_name'] = customer.full_name
        session.data['customer_phone'] = customer.phone
        session.data['depositor_relationship'] = 'OTHER'

        # For cheque deposits, amount is already set from OCR - skip to confirmation
        if session.data.get('amount'):
            session.state = SessionState.CONFIRMATION
            return f"*Account Found*\n\nAccount Holder: {customer.full_name}\n\n" + self.messages.confirmation_summary(
                account_number=session.data.get('selected_account'),
                customer_name=session.data.get('customer_name'),
                amount=session.data.get('amount'),
                transaction_type=session.data.get('transaction_type', 'CASH_DEPOSIT').replace('_', ' ').title(),
                depositor_name=session.data.get('depositor_name'),
                depositor_cnic=session.data.get('depositor_cnic'),
                depositor_phone=session.data.get('depositor_phone'),
                payee_name=session.data.get('payee_name'),
                payee_cnic=session.data.get('payee_cnic'),
                payee_phone=session.data.get('payee_phone')
            )
        else:
            # Move to amount input for cash deposits
            session.state = SessionState.AMOUNT_INPUT
            return f"*Account Found*\n\nAccount Holder: {customer.full_name}\n\n" + self.messages.AMOUNT_REQUEST

    # ============================================
    # CHEQUE FLOW HANDLERS
    # ============================================

    async def _handle_cheque_image(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle cheque image upload"""
        if not media_url:
            return self.messages.CHEQUE_IMAGE_REQUEST

        try:
            # Download image and process with EXISTING ChequeOCRService
            import httpx
            from app.core.config import settings

            # Twilio media URLs require Basic Auth and follow redirects
            auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            async with httpx.AsyncClient(auth=auth, follow_redirects=True) as client:
                response = await client.get(media_url)
                if response.status_code != 200:
                    return self.messages.CHEQUE_OCR_FAILED

                image_bytes = response.content

            # Call EXISTING cheque OCR service
            cheque_data, error = await ChequeOCRService.extract_cheque_data(image_bytes)

            if error or not cheque_data:
                logger.error(f"Cheque OCR error: {error}")
                return self.messages.CHEQUE_OCR_FAILED

            # Save cheque image to disk for teller preview
            cheque_image_url = None
            if image_bytes:
                import uuid
                os.makedirs("uploads/cheques", exist_ok=True)
                image_filename = f"cheque_{uuid.uuid4().hex[:12]}.jpg"
                image_path = f"uploads/cheques/{image_filename}"
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                public_url = os.environ.get("PUBLIC_URL", "").rstrip("/")
                cheque_image_url = f"{public_url}/uploads/cheques/{image_filename}"
                logger.info(f"Saved cheque image: {cheque_image_url}")

            # Store cheque data with keys matching frontend expectations
            session.data['cheque_data'] = {
                'cheque_number': cheque_data.cheque_number,
                'cheque_date': cheque_data.cheque_date,
                'cheque_bank': cheque_data.bank_name,
                'cheque_branch': cheque_data.branch_name,
                'cheque_amount_in_words': cheque_data.amount_in_words,
                'cheque_amount_in_figures': cheque_data.amount_in_figures,
                'cheque_payee_name': cheque_data.payee_name,
                'cheque_account_holder_name': cheque_data.account_holder_name,
                'cheque_account_number': cheque_data.account_number,
                'cheque_signature_status': cheque_data.signature_status,
                'cheque_signature_verified': cheque_data.signature_verified,
                'cheque_image': cheque_image_url
            }

            # Store amount from cheque
            if cheque_data.amount_in_figures:
                session.data['amount'] = Decimal(str(cheque_data.amount_in_figures))

            # After OCR, ask for clearing type
            session.state = SessionState.CHEQUE_CLEARING_TYPE
            return self.messages.CHEQUE_CLEARING_TYPE_REQUEST

        except Exception as e:
            logger.error(f"Error processing cheque image: {e}", exc_info=True)
            return self.messages.CHEQUE_OCR_FAILED

    async def _handle_cheque_clearing_type(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle cheque clearing type selection"""
        if message == '1':
            # Meezan Bank cheque
            clearing_type = 'LOCAL'
            clearing_days = 1
        elif message == '2':
            # Other Bank cheque
            clearing_type = 'OTHER_BANK'
            clearing_days = 3
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.CHEQUE_CLEARING_TYPE_REQUEST

        # Store clearing information in cheque_data
        if 'cheque_data' not in session.data:
            session.data['cheque_data'] = {}

        session.data['cheque_data']['cheque_clearing_type'] = clearing_type
        session.data['cheque_data']['cheque_clearing_days'] = clearing_days

        # Move to confirmation
        session.state = SessionState.CHEQUE_CONFIRMATION
        return self.messages.cheque_details_confirmation(session.data['cheque_data'])

    async def _handle_cheque_confirmation(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle cheque details confirmation"""
        if message == '1':
            # Confirm - proceed to customer type selection for cheque deposit
            session.state = SessionState.CUSTOMER_TYPE
            return self.messages.CUSTOMER_TYPE_MENU
        elif message == '2':
            # Edit details
            session.state = SessionState.CHEQUE_EDIT_MENU
            return self.messages.CHEQUE_EDIT_MENU
        elif message == '3':
            # Cancel - re-upload
            session.data.pop('cheque_data', None)
            session.state = SessionState.CHEQUE_IMAGE
            return self.messages.CHEQUE_IMAGE_REQUEST
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.cheque_details_confirmation(
                session.data.get('cheque_data', {})
            )

    async def _handle_cheque_account_selection(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle account selection for cheque deposit"""
        # Same as regular account selection
        return await self._handle_account_selection(session, message, original_message, media_url)

    # ============================================
    # CHEQUE EDIT HANDLERS
    # ============================================

    async def _handle_cheque_edit_menu(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle cheque edit menu selection"""
        if message == '1':
            session.state = SessionState.CHEQUE_EDIT_AMOUNT
            cheque_data = session.data.get('cheque_data', {})
            current = cheque_data.get('cheque_amount_in_figures', 'Not set')
            return f"*Edit Amount*\n\nCurrent amount: PKR {current}\n\nEnter the correct amount (numbers only):"
        elif message == '2':
            session.state = SessionState.CHEQUE_EDIT_PAYEE
            cheque_data = session.data.get('cheque_data', {})
            current = cheque_data.get('cheque_payee_name', 'Not set')
            return f"*Edit Payee Name*\n\nCurrent payee: {current}\n\nEnter the correct payee name:"
        elif message == '3':
            session.state = SessionState.CHEQUE_EDIT_DATE
            cheque_data = session.data.get('cheque_data', {})
            current = cheque_data.get('cheque_date', 'Not set')
            return f"*Edit Cheque Date*\n\nCurrent date: {current}\n\nEnter the correct date (YYYY-MM-DD):"
        elif message == '4':
            session.state = SessionState.CHEQUE_EDIT_CHEQUE_NUMBER
            cheque_data = session.data.get('cheque_data', {})
            current = cheque_data.get('cheque_number', 'Not set')
            return f"*Edit Cheque Number*\n\nCurrent number: {current}\n\nEnter the correct cheque number:"
        elif message == '5':
            # Edit clearing type
            session.state = SessionState.CHEQUE_EDIT_CLEARING_TYPE
            return self.messages.CHEQUE_CLEARING_TYPE_REQUEST
        elif message == '6':
            # Done editing - back to confirmation
            session.state = SessionState.CHEQUE_CONFIRMATION
            return self.messages.cheque_details_confirmation(session.data.get('cheque_data', {}))
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.CHEQUE_EDIT_MENU

    async def _handle_cheque_edit_amount(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle amount edit"""
        amount = self.messages.validate_amount(original_message)
        if not amount:
            return "Invalid amount. Please enter a valid number (e.g., 250000 or 250,000):"

        # Update cheque data
        cheque_data = session.data.get('cheque_data', {})
        cheque_data['cheque_amount_in_figures'] = float(amount)
        session.data['cheque_data'] = cheque_data
        session.data['amount'] = amount  # Also update the amount used for DRID

        session.state = SessionState.CHEQUE_EDIT_MENU
        return f"✅ Amount updated to PKR {amount:,.2f}\n\n" + self.messages.CHEQUE_EDIT_MENU

    async def _handle_cheque_edit_payee(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle payee name edit"""
        if len(original_message.strip()) < 2:
            return "Please enter a valid name (at least 2 characters):"

        # Update cheque data
        cheque_data = session.data.get('cheque_data', {})
        cheque_data['cheque_payee_name'] = original_message.strip()
        session.data['cheque_data'] = cheque_data

        session.state = SessionState.CHEQUE_EDIT_MENU
        return f"✅ Payee name updated to: {original_message.strip()}\n\n" + self.messages.CHEQUE_EDIT_MENU

    async def _handle_cheque_edit_date(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle cheque date edit"""
        import re
        date_str = original_message.strip()

        # Accept formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY
        if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            formatted_date = date_str
        elif re.match(r'^\d{2}-\d{2}-\d{4}$', date_str):
            parts = date_str.split('-')
            formatted_date = f"{parts[2]}-{parts[1]}-{parts[0]}"
        elif re.match(r'^\d{2}/\d{2}/\d{4}$', date_str):
            parts = date_str.split('/')
            formatted_date = f"{parts[2]}-{parts[1]}-{parts[0]}"
        else:
            return "Invalid date format. Please use YYYY-MM-DD (e.g., 2024-02-06):"

        # Update cheque data
        cheque_data = session.data.get('cheque_data', {})
        cheque_data['cheque_date'] = formatted_date
        session.data['cheque_data'] = cheque_data

        session.state = SessionState.CHEQUE_EDIT_MENU
        return f"✅ Cheque date updated to: {formatted_date}\n\n" + self.messages.CHEQUE_EDIT_MENU

    async def _handle_cheque_edit_cheque_number(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle cheque number edit"""
        cheque_num = original_message.strip()
        if len(cheque_num) < 3:
            return "Please enter a valid cheque number (at least 3 digits):"

        # Update cheque data
        cheque_data = session.data.get('cheque_data', {})
        cheque_data['cheque_number'] = cheque_num
        session.data['cheque_data'] = cheque_data

        session.state = SessionState.CHEQUE_EDIT_MENU
        return f"✅ Cheque number updated to: {cheque_num}\n\n" + self.messages.CHEQUE_EDIT_MENU

    async def _handle_cheque_edit_clearing_type(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle clearing type edit"""
        if message == '1':
            clearing_type = 'LOCAL'
            clearing_days = 1
            label = "Meezan Bank (1 day)"
        elif message == '2':
            clearing_type = 'OTHER_BANK'
            clearing_days = 3
            label = "Other Bank (3 days)"
        else:
            return self.messages.INVALID_OPTION + "\n" + self.messages.CHEQUE_CLEARING_TYPE_REQUEST

        # Update cheque data
        cheque_data = session.data.get('cheque_data', {})
        cheque_data['cheque_clearing_type'] = clearing_type
        cheque_data['cheque_clearing_days'] = clearing_days
        session.data['cheque_data'] = cheque_data

        session.state = SessionState.CHEQUE_EDIT_MENU
        return f"✅ Clearing type updated to: {label}\n\n" + self.messages.CHEQUE_EDIT_MENU

    # ============================================
    # PAY ORDER HANDLERS
    # ============================================

    async def _handle_payorder_payee_name(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle pay order payee name input"""
        name = original_message.strip()
        if len(name) < 3:
            return "Please enter a valid name (at least 3 characters):"

        session.data['payee_name'] = name
        session.state = SessionState.PAYORDER_PAYEE_CNIC
        return self.messages.PAYORDER_PAYEE_CNIC_REQUEST

    async def _handle_payorder_payee_cnic(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle pay order payee CNIC input"""
        if not self.messages.validate_cnic(original_message):
            return self.messages.INVALID_CNIC

        cnic = self.messages.format_cnic(original_message)
        session.data['payee_cnic'] = cnic
        session.state = SessionState.PAYORDER_PAYEE_PHONE
        return self.messages.PAYORDER_PAYEE_PHONE_REQUEST

    async def _handle_payorder_payee_phone(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle pay order payee phone input"""
        # Allow skipping phone number
        if message == 'skip':
            session.data['payee_phone'] = None
        else:
            if not self.messages.validate_phone(original_message):
                return self.messages.INVALID_PHONE
            phone = self.messages.clean_phone_number(original_message)
            session.data['payee_phone'] = phone

        # After payee details, go to amount input
        session.state = SessionState.AMOUNT_INPUT
        return self.messages.AMOUNT_REQUEST

    # ============================================
    # BUSINESS/MERCHANT HANDLERS
    # ============================================

    async def _handle_business_name(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle business name input"""
        name = original_message.strip()
        if len(name) < 3:
            return "Please enter a valid business name (at least 3 characters):"

        session.data['business_name'] = name
        session.state = SessionState.BUSINESS_REGISTRATION
        return self.messages.BUSINESS_REGISTRATION_REQUEST

    async def _handle_business_registration(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle business registration number input"""
        reg_number = original_message.strip()
        if len(reg_number) < 3:
            return "Please enter a valid registration number:"

        session.data['business_registration_number'] = reg_number
        session.state = SessionState.BUSINESS_TAX_ID
        return self.messages.BUSINESS_TAX_ID_REQUEST

    async def _handle_business_tax_id(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle business tax ID/NTN input"""
        tax_id = original_message.strip()
        if len(tax_id) < 5:
            return "Please enter a valid Tax ID/NTN:"

        session.data['business_tax_id'] = tax_id
        session.state = SessionState.BUSINESS_CONTACT_PERSON
        return self.messages.BUSINESS_CONTACT_PERSON_REQUEST

    async def _handle_business_contact_person(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle business contact person input"""
        contact_person = original_message.strip()
        if len(contact_person) < 3:
            return "Please enter a valid contact person name:"

        session.data['business_contact_person'] = contact_person
        session.state = SessionState.BUSINESS_PHONE
        return self.messages.BUSINESS_PHONE_REQUEST

    async def _handle_business_phone(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle business phone input"""
        if not self.messages.validate_phone(original_message):
            return self.messages.INVALID_PHONE

        phone = self.messages.clean_phone_number(original_message)
        session.data['business_phone'] = phone
        session.state = SessionState.BUSINESS_TARGET_ACCOUNT
        return self.messages.WALKIN_TARGET_ACCOUNT_REQUEST  # Reuse the target account message

    async def _handle_business_target_account(
        self,
        session: UserSession,
        message: str,
        original_message: str,
        media_url: Optional[str]
    ) -> str:
        """Handle business target account input"""
        account_number = original_message.strip()

        # Validate account exists
        account = self.db.query(Account).filter(
            Account.account_number == account_number,
            Account.account_status == AccountStatus.ACTIVE
        ).first()

        if not account:
            return self.messages.ACCOUNT_NOT_FOUND

        # Get customer info for this account
        customer = self.db.query(Customer).filter(
            Customer.id == account.customer_id
        ).first()

        if not customer:
            return self.messages.ACCOUNT_NOT_FOUND

        # Store account and customer info
        session.data['selected_account'] = account.account_number
        session.data['selected_account_id'] = str(account.id)
        session.data['customer_id'] = str(customer.id)
        session.data['customer_cnic'] = customer.cnic
        session.data['customer_name'] = customer.full_name
        session.data['customer_phone'] = customer.phone
        session.data['depositor_relationship'] = 'BUSINESS'

        # Move to amount input
        session.state = SessionState.AMOUNT_INPUT
        return f"*Account Found*\n\nAccount Holder: {customer.full_name}\n\n" + self.messages.AMOUNT_REQUEST
