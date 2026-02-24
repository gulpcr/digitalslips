# app/sms/sms_messages.py
"""
SMS Message Templates for Precision Receipt System
Plain text format optimized for SMS character limits
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any


class SMSMessages:
    """SMS message templates - plain text, concise"""

    # ============================================
    # MAIN MENU
    # ============================================

    GREETING = """MEEZAN BANK - SMS Banking

Assalam-o-Alaikum!

Select a Service:
1. Account Services
2. Card Services
3. Branch Services
4. Complaints & Support

Reply with option number (1-4)"""

    # ============================================
    # BRANCH SERVICES MENU
    # ============================================

    BRANCH_SERVICES_MENU = """BRANCH SERVICES

How can we help you?

1. Digital Deposit Slip
2. Appointment Booking
3. Branch Locator

Reply with option number (1-3)
Type 0 to go back"""

    # ============================================
    # DEPOSIT TYPE MENU
    # ============================================

    DEPOSIT_TYPE_MENU = """DIGITAL DEPOSIT SLIP

Select deposit type:

1. Cash Deposit
2. Cheque Deposit
3. Pay Order / Demand Draft

Reply with option number (1-3)
Type 0 to go back"""

    # ============================================
    # CUSTOMER TYPE MENU
    # ============================================

    CUSTOMER_TYPE_MENU = """VERIFICATION

Who is making the deposit?

1. Meezan Customer (auto-fetch details)
2. Walk-in Individual
3. Business / Merchant

Reply with option number (1-3)"""

    # ============================================
    # ACCOUNT SELECTION
    # ============================================

    @staticmethod
    def account_selection(accounts: List[Dict[str, Any]]) -> str:
        """Generate account selection message"""
        message = "SELECT ACCOUNT\n\nChoose your account:\n\n"

        for i, account in enumerate(accounts, 1):
            masked = SMSMessages.mask_account(account.get('account_number', ''))
            acc_type = account.get('account_type', 'SAVINGS').replace('_', ' ')
            message += f"{i}. {masked} ({acc_type})\n"

        message += f"\nReply with account number (1-{len(accounts)})"
        return message

    # ============================================
    # AMOUNT REQUEST
    # ============================================

    AMOUNT_REQUEST = """DEPOSIT AMOUNT

Please enter the amount you want to deposit:

Example: 50000

Enter amount in PKR (numbers only)"""

    # ============================================
    # WALK-IN FLOW
    # ============================================

    WALKIN_CNIC_REQUEST = """YOUR CNIC

Please enter your CNIC:

Format: XXXXX-XXXXXXX-X
Example: 42101-1234567-1

Enter your 13-digit CNIC with dashes"""

    WALKIN_NAME_REQUEST = """YOUR NAME

Please enter your full name as per your CNIC:

Type your complete name"""

    WALKIN_PHONE_REQUEST = """CONTACT NUMBER

Please enter your phone number:

Format: 03XXXXXXXXX
Example: 03001234567

Enter your mobile number"""

    WALKIN_TARGET_ACCOUNT_REQUEST = """TARGET ACCOUNT

Enter the account number you want to deposit into:

Example: 0123456789012

Enter the complete account number"""

    # ============================================
    # BUSINESS FLOW
    # ============================================

    BUSINESS_NAME_REQUEST = """BUSINESS NAME

Please enter your business/company name:

Type the registered business name"""

    BUSINESS_REGISTRATION_REQUEST = """REGISTRATION NUMBER

Please enter your business registration number:

Example: REG-123456"""

    BUSINESS_TAX_ID_REQUEST = """TAX ID / NTN

Please enter your Tax ID or NTN:

Example: 1234567-8"""

    BUSINESS_CONTACT_PERSON_REQUEST = """CONTACT PERSON

Please enter the contact person's name:

Full name of the authorized person"""

    BUSINESS_PHONE_REQUEST = """BUSINESS PHONE

Please enter your business phone number:

Format: 021-12345678 or 03XXXXXXXXX
Example: 02112345678"""

    # ============================================
    # PAY ORDER FLOW
    # ============================================

    PAYORDER_PAYEE_NAME_REQUEST = """PAYEE INFORMATION

Please enter the payee's full name (person who will receive the pay order):

Type the complete name"""

    PAYORDER_PAYEE_CNIC_REQUEST = """PAYEE CNIC

Please enter the payee's CNIC:

Format: XXXXX-XXXXXXX-X
Example: 42101-1234567-1"""

    PAYORDER_PAYEE_PHONE_REQUEST = """PAYEE CONTACT

Please enter the payee's phone number:

Format: 03XXXXXXXXX
Example: 03001234567

Enter mobile number (or send 'skip' to skip)"""

    # ============================================
    # CHEQUE FLOW (SMS limitation - no image support)
    # ============================================

    CHEQUE_MANUAL_ENTRY = """CHEQUE DEPOSIT

SMS cannot process images. Please enter cheque details manually.

We'll ask for:
- Cheque number
- Date
- Bank
- Amount
- Payee name

Reply OK to continue"""

    CHEQUE_NUMBER_REQUEST = """CHEQUE NUMBER

Enter the 6-10 digit cheque number:

Example: 123456"""

    CHEQUE_DATE_REQUEST = """CHEQUE DATE

Enter the cheque date:

Format: YYYY-MM-DD or DD-MM-YYYY
Example: 2026-02-20"""

    CHEQUE_BANK_REQUEST = """CHEQUE BANK

Enter the bank name:

Examples:
- Meezan Bank
- HBL
- UBL
- MCB Bank"""

    CHEQUE_PAYEE_REQUEST = """PAYEE NAME

Enter the payee name (recipient):

Type the name as written on cheque"""

    CHEQUE_CLEARING_TYPE_REQUEST = """CLEARING TYPE

Select cheque clearing type:

1. Local Cheque (same city - 1 day, Fee: PKR 50)
2. Inter-City (different city - 3 days, Fee: PKR 150)

Reply with option number (1-2)"""

    # ============================================
    # CONFIRMATION
    # ============================================

    @staticmethod
    def confirmation_summary(
        account_number: Optional[str],
        customer_name: Optional[str],
        amount: Decimal,
        transaction_type: str = "Cash Deposit",
        depositor_name: Optional[str] = None,
        depositor_cnic: Optional[str] = None,
        depositor_phone: Optional[str] = None,
        payee_name: Optional[str] = None,
        payee_cnic: Optional[str] = None,
        payee_phone: Optional[str] = None,
        business_name: Optional[str] = None,
        clearing_type: Optional[str] = None
    ) -> str:
        """Generate confirmation summary"""
        masked_account = SMSMessages.mask_account(account_number) if account_number else "N/A"
        formatted_amount = SMSMessages.format_amount(amount)

        summary = f"""CONFIRM DEPOSIT

Type: {transaction_type}
Account: {masked_account}
"""
        if customer_name:
            summary += f"Account Holder: {customer_name}\n"

        # Payee details for pay order
        if payee_name:
            summary += f"\nPayee: {payee_name}\n"
            if payee_cnic:
                summary += f"Payee CNIC: {payee_cnic}\n"

        # Business details
        if business_name:
            summary += f"\nBusiness: {business_name}\n"

        # Depositor details
        if depositor_name and depositor_name != customer_name:
            summary += f"\nDepositor: {depositor_name}\n"
            if depositor_cnic:
                summary += f"Depositor CNIC: {depositor_cnic}\n"

        # Clearing type for cheques
        if clearing_type:
            days = "1 day" if clearing_type == "LOCAL" else "3 days"
            fee = "PKR 50" if clearing_type == "LOCAL" else "PKR 150"
            summary += f"\nClearing: {clearing_type} ({days}, {fee})\n"

        summary += f"""
AMOUNT: {formatted_amount}

1. Confirm - Generate slip
2. Cancel - Start over

Reply with option number (1-2)"""

        return summary

    # ============================================
    # SUCCESS MESSAGE
    # ============================================

    @staticmethod
    def drid_success(
        drid: str,
        amount: Decimal,
        validity_minutes: int,
        customer_name: str,
        account_number: str
    ) -> str:
        """Generate DRID success message"""
        masked = SMSMessages.mask_account(account_number)
        formatted_amount = SMSMessages.format_amount(amount)

        return f"""DEPOSIT SLIP CREATED

Your Digital Reference ID (DRID):
{drid}

Account: {masked}
Amount: {formatted_amount}
Valid for: {validity_minutes} minutes

NEXT STEPS:
1. Note down your DRID
2. Visit any Meezan Bank branch
3. Provide DRID to teller
4. Complete verification
5. Receive your receipt

You will receive a QR code via MMS that you can show at the branch.

-Meezan Bank"""

    # ============================================
    # ERROR MESSAGES
    # ============================================

    ERROR_OCCURRED = """An error occurred. Please try again or send HI to restart."""

    SESSION_EXPIRED = """Your session has expired due to inactivity. Send HI to start again."""

    INVALID_OPTION = """Invalid option. Please select a valid number from the menu."""

    INVALID_AMOUNT = """Invalid amount. Please enter a valid number (e.g., 50000 or 50,000)"""

    INVALID_CNIC = """Invalid CNIC format. Please use: XXXXX-XXXXXXX-X
Example: 42101-1234567-1"""

    INVALID_PHONE = """Invalid phone number. Please use format: 03XXXXXXXXX
Example: 03001234567"""

    ACCOUNT_NOT_FOUND = """Account not found or inactive. Please check the account number and try again."""

    CUSTOMER_NOT_FOUND = """Customer not found.

Options:
1. Continue as walk-in customer
2. Cancel

Reply with option number (1-2)"""

    CANCELLED = """Transaction cancelled. Send HI to start a new deposit slip."""

    ACCOUNT_SERVICES_PLACEHOLDER = """Account Services will be available soon. Send HI for main menu."""

    CARD_SERVICES_PLACEHOLDER = """Card Services will be available soon. Send HI for main menu."""

    APPOINTMENT_PLACEHOLDER = """Appointment Booking will be available soon. Send HI for main menu."""

    BRANCH_LOCATOR_PLACEHOLDER = """Branch Locator will be available soon. Send HI for main menu."""

    COMPLAINTS_PLACEHOLDER = """Complaints & Support will be available soon. Send HI for main menu."""

    CHEQUE_OCR_FAILED = """Could not process cheque image. Via SMS, please enter cheque details manually or use WhatsApp for image scanning.

Send HI to start over."""

    # ============================================
    # HELPER METHODS
    # ============================================

    @staticmethod
    def mask_account(account_number: str) -> str:
        """Mask account number for security"""
        if not account_number or len(account_number) < 4:
            return account_number
        return f"****{account_number[-4:]}"

    @staticmethod
    def format_amount(amount: Decimal) -> str:
        """Format amount with PKR and commas"""
        return f"PKR {amount:,.2f}"

    @staticmethod
    def validate_amount(amount_str: str) -> Optional[Decimal]:
        """Validate and parse amount string"""
        try:
            # Remove commas and whitespace
            cleaned = amount_str.replace(',', '').replace(' ', '').strip()
            amount = Decimal(cleaned)
            if amount > 0:
                return amount
        except:
            pass
        return None

    @staticmethod
    def validate_cnic(cnic: str) -> bool:
        """Validate CNIC format"""
        import re
        # With dashes: XXXXX-XXXXXXX-X
        if re.match(r'^\d{5}-\d{7}-\d{1}$', cnic.strip()):
            return True
        # Without dashes: XXXXXXXXXXXXX
        if re.match(r'^\d{13}$', cnic.strip().replace('-', '')):
            return True
        return False

    @staticmethod
    def format_cnic(cnic: str) -> str:
        """Format CNIC with dashes"""
        # Remove all non-digits
        digits = ''.join(filter(str.isdigit, cnic))
        if len(digits) == 13:
            return f"{digits[0:5]}-{digits[5:12]}-{digits[12]}"
        return cnic

    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate Pakistani phone number"""
        import re
        # Clean phone
        cleaned = phone.strip().replace('-', '').replace(' ', '').replace('+', '')

        # Pakistani mobile: 03XXXXXXXXX or 923XXXXXXXXX
        if re.match(r'^(03|923)\d{9}$', cleaned):
            return True
        # Landline: 02XXXXXXXXX or 922XXXXXXXXX
        if re.match(r'^(0[2-9]|92[2-9])\d{8,9}$', cleaned):
            return True
        return False

    @staticmethod
    def clean_phone_number(phone: str) -> str:
        """Clean and format phone number"""
        cleaned = phone.strip().replace('-', '').replace(' ', '')
        # Remove + if present
        if cleaned.startswith('+'):
            cleaned = cleaned[1:]
        # Ensure it starts with country code
        if cleaned.startswith('0'):
            cleaned = '92' + cleaned[1:]
        elif not cleaned.startswith('92'):
            cleaned = '92' + cleaned
        return cleaned
