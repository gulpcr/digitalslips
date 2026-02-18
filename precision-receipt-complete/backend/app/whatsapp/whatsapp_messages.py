# app/whatsapp/whatsapp_messages.py
"""
WhatsApp Message Templates for Precision Receipt System
All messages formatted with WhatsApp markdown and emojis
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any


class WhatsAppMessages:
    """WhatsApp message templates with formatting helpers"""

    # ============================================
    # MAIN MENU
    # ============================================

    GREETING = """
╔══════════════════════════╗
      🏦 *MEEZAN BANK*
    _WhatsApp Banking_
╚══════════════════════════╝

Assalam-o-Alaikum! 👋

Welcome to Meezan Bank's WhatsApp Banking Service.

━━━━━━━━━━━━━━━━━━━━━
*Select a Service:*
━━━━━━━━━━━━━━━━━━━━━

1️⃣  💳  Account Services
2️⃣  💰  Card Services
3️⃣  🏢  Branch Services
4️⃣  📞  Complaints & Support

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-4)_
"""

    # ============================================
    # BRANCH SERVICES MENU
    # ============================================

    BRANCH_SERVICES_MENU = """
╭─────────────────────────╮
   🏢 *BRANCH SERVICES*
╰─────────────────────────╯

How can we help you today?

━━━━━━━━━━━━━━━━━━━━━

1️⃣  📝  Digital Deposit Slip
      _Create deposit slip online_

2️⃣  📅  Appointment Booking
      _Book your branch visit_

3️⃣  📍  Branch Locator
      _Find nearest branch_

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-3)_

💡 Type *0* to go back
"""

    # ============================================
    # DEPOSIT TYPE MENU
    # ============================================

    DEPOSIT_TYPE_MENU = """
╭─────────────────────────╮
  📝 *DIGITAL DEPOSIT SLIP*
╰─────────────────────────╯

Select deposit type:

━━━━━━━━━━━━━━━━━━━━━

1️⃣  💵  *Cash Deposit*
      _Deposit cash into account_

2️⃣  📄  *Cheque Deposit*
      _Deposit a cheque_

3️⃣  💳  *Pay Order / Demand Draft*
      _Request a pay order_

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-3)_

💡 Type *0* to go back
"""

    # ============================================
    # CUSTOMER TYPE MENU
    # ============================================

    CUSTOMER_TYPE_MENU = """
╭─────────────────────────╮
   🔐 *VERIFICATION*
╰─────────────────────────╯

Who is making the deposit?

━━━━━━━━━━━━━━━━━━━━━

1️⃣  ✅  *Meezan Customer*
      _Auto-fetch your details_

2️⃣  👤  *Walk-in Individual*
      _Deposit to any account_

3️⃣  🏢  *Business / Merchant*
      _Company deposit_

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-3)_
"""

    # ============================================
    # ACCOUNT SELECTION
    # ============================================

    @staticmethod
    def account_selection(accounts: List[Dict[str, Any]]) -> str:
        """Generate account selection message with masked account numbers"""
        message = """
╭─────────────────────────╮
   🏦 *SELECT ACCOUNT*
╰─────────────────────────╯

Choose your account for deposit:

━━━━━━━━━━━━━━━━━━━━━
"""
        for i, account in enumerate(accounts, 1):
            masked = WhatsAppMessages.mask_account(account.get('account_number', ''))
            acc_type = account.get('account_type', 'SAVINGS').replace('_', ' ').title()
            emoji = "💰" if "SAVING" in acc_type.upper() else "💼" if "CURRENT" in acc_type.upper() else "🏦"
            message += f"\n{WhatsAppMessages.get_number_emoji(i)}  {emoji}  *{masked}*\n      _{acc_type}_\n"

        message += """
━━━━━━━━━━━━━━━━━━━━━
_Reply with account number (1-""" + str(len(accounts)) + ")_"
        return message

    # ============================================
    # AMOUNT REQUEST
    # ============================================

    AMOUNT_REQUEST = """
╭─────────────────────────╮
   💰 *DEPOSIT AMOUNT*
╰─────────────────────────╯

Please enter the amount you want to deposit:

━━━━━━━━━━━━━━━━━━━━━
💡 *Example:* 50000

_Enter amount in PKR (numbers only)_
"""

    AMOUNT_REQUEST_CHEQUE = """
╭─────────────────────────╮
   💰 *CONFIRM AMOUNT*
╰─────────────────────────╯

Cheque amount detected:

╔════════════════════════╗
     💵 *PKR {amount}*
╚════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━

1️⃣  ✅  *Confirm* this amount
2️⃣  ✏️  *Edit* - Enter different amount

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-2)_
"""

    # ============================================
    # WALK-IN CUSTOMER FLOW
    # ============================================

    WALKIN_CNIC_REQUEST = """
╭─────────────────────────╮
   👤 *WALK-IN DEPOSIT*
╰─────────────────────────╯

Please enter your *CNIC* number:

━━━━━━━━━━━━━━━━━━━━━
📝 *Format:* XXXXX-XXXXXXX-X
💡 *Example:* 35202-1234567-9
━━━━━━━━━━━━━━━━━━━━━

_Enter your 13-digit CNIC_
"""

    WALKIN_NAME_REQUEST = """
╭─────────────────────────╮
   ✍️ *YOUR NAME*
╰─────────────────────────╯

Please enter your *full name*
as per your CNIC:

━━━━━━━━━━━━━━━━━━━━━
_Type your complete name_
"""

    WALKIN_PHONE_REQUEST = """
╭─────────────────────────╮
   📱 *CONTACT NUMBER*
╰─────────────────────────╯

Please enter your *phone number*:

━━━━━━━━━━━━━━━━━━━━━
📝 *Format:* 03XXXXXXXXX
💡 *Example:* 03001234567
━━━━━━━━━━━━━━━━━━━━━

_Enter your mobile number_
"""

    WALKIN_TARGET_ACCOUNT_REQUEST = """
╭─────────────────────────╮
   🏦 *TARGET ACCOUNT*
╰─────────────────────────╯

Enter the *account number* you want to deposit into:

━━━━━━━━━━━━━━━━━━━━━
💡 *Example:* 0123456789012
━━━━━━━━━━━━━━━━━━━━━

_Enter the complete account number_
"""

    # ============================================
    # BUSINESS/MERCHANT FLOW
    # ============================================

    BUSINESS_NAME_REQUEST = """
╭─────────────────────────╮
   🏢 *BUSINESS NAME*
╰─────────────────────────╯

Please enter your *business/company name*:

━━━━━━━━━━━━━━━━━━━━━
_Type the registered business name_
"""

    BUSINESS_REGISTRATION_REQUEST = """
╭─────────────────────────╮
   📋 *REGISTRATION NUMBER*
╰─────────────────────────╯

Please enter your *business registration number*:

━━━━━━━━━━━━━━━━━━━━━
💡 *Example:* REG-123456
━━━━━━━━━━━━━━━━━━━━━

_Enter your company registration number_
"""

    BUSINESS_TAX_ID_REQUEST = """
╭─────────────────────────╮
   📝 *TAX ID / NTN*
╰─────────────────────────╯

Please enter your *Tax ID or NTN*:

━━━━━━━━━━━━━━━━━━━━━
💡 *Example:* 1234567-8
━━━━━━━━━━━━━━━━━━━━━

_Enter your tax identification number_
"""

    BUSINESS_CONTACT_PERSON_REQUEST = """
╭─────────────────────────╮
   👤 *CONTACT PERSON*
╰─────────────────────────╯

Please enter the *contact person's name*:

━━━━━━━━━━━━━━━━━━━━━
_Full name of the authorized person_
"""

    BUSINESS_PHONE_REQUEST = """
╭─────────────────────────╮
   📱 *BUSINESS PHONE*
╰─────────────────────────╯

Please enter your *business phone number*:

━━━━━━━━━━━━━━━━━━━━━
📝 *Format:* 021-12345678 or 03XXXXXXXXX
💡 *Example:* 02112345678
━━━━━━━━━━━━━━━━━━━━━

_Enter business contact number_
"""

    # ============================================
    # PAY ORDER FLOW
    # ============================================

    PAYORDER_PAYEE_NAME_REQUEST = """
╭─────────────────────────╮
   👤 *PAYEE INFORMATION*
╰─────────────────────────╯

Please enter the *payee's full name*
(person who will receive the pay order):

━━━━━━━━━━━━━━━━━━━━━
_Type the complete name_
"""

    PAYORDER_PAYEE_CNIC_REQUEST = """
╭─────────────────────────╮
   🆔 *PAYEE CNIC*
╰─────────────────────────╯

Please enter the *payee's CNIC*:

━━━━━━━━━━━━━━━━━━━━━
📝 *Format:* XXXXX-XXXXXXX-X
💡 *Example:* 42101-1234567-1
━━━━━━━━━━━━━━━━━━━━━

_Enter the 13-digit CNIC with dashes_
"""

    PAYORDER_PAYEE_PHONE_REQUEST = """
╭─────────────────────────╮
   📱 *PAYEE CONTACT*
╰─────────────────────────╯

Please enter the *payee's phone number*:

━━━━━━━━━━━━━━━━━━━━━
📝 *Format:* 03XXXXXXXXX
💡 *Example:* 03001234567
━━━━━━━━━━━━━━━━━━━━━

_Enter mobile number (optional - send 'skip' to skip)_
"""

    # ============================================
    # CHEQUE DEPOSIT FLOW
    # ============================================

    CHEQUE_IMAGE_REQUEST = """
╭─────────────────────────╮
   📄 *CHEQUE DEPOSIT*
╰─────────────────────────╯

Please upload a *clear photo* of your cheque.

━━━━━━━━━━━━━━━━━━━━━
📸 *Tips for best results:*
━━━━━━━━━━━━━━━━━━━━━

✓ Place cheque on *flat surface*
✓ Ensure *good lighting*
✓ Capture the *entire cheque*
✓ Avoid *shadows & glare*
✓ Keep camera *steady*

━━━━━━━━━━━━━━━━━━━━━

📷 _Send the cheque image now_
"""

    CHEQUE_CLEARING_TYPE_REQUEST = """
╭─────────────────────────╮
   ⏱️ *CLEARING TYPE*
╰─────────────────────────╯

Select the cheque clearing type:

━━━━━━━━━━━━━━━━━━━━━

1️⃣  🏙️  *Local Cheque*
      _Same city - 1 day clearing_
      _Fee: PKR 50_

2️⃣  🌍  *Inter-City Cheque*
      _Different city - 3 days clearing_
      _Fee: PKR 150_

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-2)_
"""

    @staticmethod
    def cheque_details_confirmation(cheque_data: Dict[str, Any]) -> str:
        """Generate cheque details confirmation message"""
        # Use 'or' to handle both missing keys and None values
        bank = cheque_data.get('cheque_bank') or 'N/A'
        payee = cheque_data.get('cheque_payee_name') or 'N/A'
        amount_words = cheque_data.get('cheque_amount_in_words') or 'N/A'
        amount_figures = cheque_data.get('cheque_amount_in_figures')
        cheque_date = cheque_data.get('cheque_date') or 'N/A'
        signature = cheque_data.get('cheque_signature_status') or 'N/A'
        cheque_number = cheque_data.get('cheque_number') or 'N/A'
        account_holder = cheque_data.get('cheque_account_holder_name') or 'N/A'
        clearing_type = cheque_data.get('cheque_clearing_type', 'LOCAL')
        clearing_days = cheque_data.get('cheque_clearing_days', 1)
        processing_fee = cheque_data.get('cheque_processing_fee', 50)

        amount_str = WhatsAppMessages.format_amount(amount_figures) if amount_figures else 'N/A'

        sig_status = "✅ Present" if signature == 'present' else "❌ Missing" if signature == 'missing' else "⚠️ Unclear"
        clearing_label = "🏙️ Local" if clearing_type == 'LOCAL' else "🌍 Inter-City"

        return f"""
╭─────────────────────────╮
   📄 *CHEQUE DETAILS*
╰─────────────────────────╯

_AI-extracted information:_

━━━━━━━━━━━━━━━━━━━━━
🏦 *Bank:* {bank}
🔢 *Cheque No:* {cheque_number}
👤 *Account Holder:* {account_holder}
👤 *Payee Name:* {payee}
━━━━━━━━━━━━━━━━━━━━━
💰 *Amount:* {amount_str}
📝 *In Words:* {amount_words}
📅 *Date:* {cheque_date}
✍️ *Signature:* {sig_status}
━━━━━━━━━━━━━━━━━━━━━
⏱️ *Clearing:* {clearing_label} ({clearing_days} {'day' if clearing_days == 1 else 'days'})
💵 *Fee:* PKR {processing_fee}
━━━━━━━━━━━━━━━━━━━━━

*Please review and confirm:*

1️⃣  ✅  *Confirm* - Details correct
2️⃣  ✏️  *Edit* - Make corrections
3️⃣  🔄  *Re-upload* - New image

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-3)_
"""

    # ============================================
    # CHEQUE EDIT MENU
    # ============================================

    CHEQUE_EDIT_MENU = """
╭─────────────────────────╮
   ✏️ *EDIT CHEQUE*
╰─────────────────────────╯

What would you like to edit?

━━━━━━━━━━━━━━━━━━━━━

1️⃣  💰  Amount
2️⃣  👤  Payee Name
3️⃣  📅  Cheque Date
4️⃣  🔢  Cheque Number
5️⃣  ⏱️  Clearing Type
6️⃣  ✅  *Done* - Back to confirmation

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-6)_
"""

    # ============================================
    # CONFIRMATION SUMMARY
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
        payee_phone: Optional[str] = None
    ) -> str:
        """Generate confirmation summary message"""
        masked_account = WhatsAppMessages.mask_account(account_number) if account_number else "N/A"
        formatted_amount = WhatsAppMessages.format_amount(amount)

        # Set emoji based on transaction type
        if "Pay Order" in transaction_type or "PAY_ORDER" in transaction_type:
            tx_emoji = "💳"
        elif "Cash" in transaction_type:
            tx_emoji = "💵"
        elif "Cheque" in transaction_type:
            tx_emoji = "📄"
        else:
            tx_emoji = "📝"

        summary = f"""
╭─────────────────────────╮
   📋 *CONFIRM DEPOSIT*
╰─────────────────────────╯

Please review your deposit details:

━━━━━━━━━━━━━━━━━━━━━
{tx_emoji} *Type:* {transaction_type}
🏦 *Account:* {masked_account}
"""
        if customer_name:
            summary += f"👤 *Account Holder:* {customer_name}\n"

        # For Pay Order, show payee details
        if payee_name:
            summary += f"""
━━━━━━━━━━━━━━━━━━━━━
👤 *Payee Details:*
   *Name:* {payee_name}
"""
            if payee_cnic:
                summary += f"   *CNIC:* {payee_cnic}\n"
            if payee_phone:
                summary += f"   *Phone:* {payee_phone}\n"
        # For Cash/Cheque Deposit, show depositor details if different from customer
        elif depositor_name and depositor_name != customer_name:
            summary += f"""
━━━━━━━━━━━━━━━━━━━━━
🚶 *Depositor Details:*
   *Name:* {depositor_name}
"""
            if depositor_cnic:
                summary += f"   *CNIC:* {depositor_cnic}\n"
            if depositor_phone:
                summary += f"   *Phone:* {depositor_phone}\n"

        summary += f"""
╔════════════════════════╗
     💰 *{formatted_amount}*
╚════════════════════════╝
━━━━━━━━━━━━━━━━━━━━━

1️⃣  ✅  *Confirm* - Generate slip
2️⃣  ❌  *Cancel* - Start over

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-2)_
"""
        return summary

    # ============================================
    # DRID SUCCESS MESSAGE
    # ============================================

    @staticmethod
    def drid_success(
        drid: str,
        amount: Decimal,
        validity_minutes: int,
        customer_name: Optional[str] = None,
        account_number: Optional[str] = None
    ) -> str:
        """Generate DRID success message"""
        formatted_amount = WhatsAppMessages.format_amount(amount)
        masked_account = WhatsAppMessages.mask_account(account_number) if account_number else "N/A"

        return f"""
╔══════════════════════════╗
    ✅ *SLIP CREATED!*
╚══════════════════════════╝

Your Digital Deposit Slip is ready.

━━━━━━━━━━━━━━━━━━━━━
📋 *DEPOSIT SLIP DETAILS*
━━━━━━━━━━━━━━━━━━━━━

🔑 *Your DRID:*
╔════════════════════════╗
      📌 `{drid}`
╚════════════════════════╝

💰 *Amount:* {formatted_amount}
🏦 *Account:* {masked_account}
⏱️ *Valid For:* {validity_minutes} minutes

━━━━━━━━━━━━━━━━━━━━━
📝 *NEXT STEPS*
━━━━━━━━━━━━━━━━━━━━━

1️⃣ Visit any *Meezan Bank* branch
2️⃣ Show your *CNIC* to teller
3️⃣ Share DRID: *{drid}*
4️⃣ Complete deposit with cash/cheque

━━━━━━━━━━━━━━━━━━━━━
⚠️ _Expires in {validity_minutes} minutes_
━━━━━━━━━━━━━━━━━━━━━

Thank you for choosing *Meezan Bank*! 🏦
"""

    # ============================================
    # TRANSACTION COMPLETE MESSAGE
    # ============================================

    @staticmethod
    def transaction_complete(
        account_number: str,
        amount: Decimal,
        transaction_id: str,
        branch_name: str,
        transaction_date: datetime,
        customer_name: Optional[str] = None,
        receipt_number: Optional[str] = None,
        is_digitally_signed: bool = False,
        verification_url: Optional[str] = None
    ) -> str:
        """Generate transaction completion message with digital signature info"""
        formatted_amount = WhatsAppMessages.format_amount(amount)
        masked_account = WhatsAppMessages.mask_account(account_number)
        formatted_date = WhatsAppMessages.format_datetime(transaction_date)

        # Digital signature badge
        signature_badge = "🔐 *Digitally Signed*" if is_digitally_signed else ""

        message = f"""
✅ *Transaction Successful!*

Dear {customer_name or 'Customer'},

Your deposit has been completed successfully.

━━━━━━━━━━━━━━━━━━━━━
*Transaction Details:*
━━━━━━━━━━━━━━━━━━━━━
*Credited Account:* {masked_account}
*Amount:* {formatted_amount}
*Transaction ID:* `{transaction_id}`
*Branch:* {branch_name}
*Date & Time:* {formatted_date}
"""
        if receipt_number:
            message += f"*Receipt No:* `{receipt_number}`\n"

        if is_digitally_signed:
            message += f"""
━━━━━━━━━━━━━━━━━━━━━
{signature_badge}
_This receipt is cryptographically signed_
_for authenticity verification (SBP Compliant)_
"""
            if verification_url:
                message += f"\n🔍 *Verify Receipt:*\n{verification_url}\n"

        message += f"""
━━━━━━━━━━━━━━━━━━━━━

_Your account has been credited with {formatted_amount}_

Thank you for banking with Meezan Bank!
"""
        return message

    # ============================================
    # ERROR MESSAGES
    # ============================================

    INVALID_OPTION = """
╭─────────────────────────╮
   ⚠️ *INVALID OPTION*
╰─────────────────────────╯

Please enter a valid option number from the menu shown above.

_Reply with a number (e.g., 1, 2, 3)_
"""

    INVALID_CNIC = """
╭─────────────────────────╮
   ⚠️ *INVALID CNIC*
╰─────────────────────────╯

Please enter a valid 13-digit CNIC number.

━━━━━━━━━━━━━━━━━━━━━
📝 *Format:* XXXXX-XXXXXXX-X
💡 *Example:* 35202-1234567-9
━━━━━━━━━━━━━━━━━━━━━

_Try again with correct format_
"""

    INVALID_PHONE = """
╭─────────────────────────╮
   ⚠️ *INVALID PHONE*
╰─────────────────────────╯

Please enter a valid Pakistani mobile number.

━━━━━━━━━━━━━━━━━━━━━
📝 *Format:* 03XXXXXXXXX
💡 *Example:* 03001234567
━━━━━━━━━━━━━━━━━━━━━

_Try again with correct format_
"""

    INVALID_AMOUNT = """
╭─────────────────────────╮
   ⚠️ *INVALID AMOUNT*
╰─────────────────────────╯

Please enter a valid amount in numbers only.

━━━━━━━━━━━━━━━━━━━━━
💡 *Example:* 50000
━━━━━━━━━━━━━━━━━━━━━

_Enter amount without commas or symbols_
"""

    INVALID_ACCOUNT = """
╭─────────────────────────╮
   ⚠️ *INVALID ACCOUNT*
╰─────────────────────────╯

Please enter a valid account number.

━━━━━━━━━━━━━━━━━━━━━
💡 *Example:* 0123456789012
━━━━━━━━━━━━━━━━━━━━━

_Enter the complete account number_
"""

    CUSTOMER_NOT_FOUND = """
╭─────────────────────────╮
   🔍 *NOT FOUND*
╰─────────────────────────╯

We couldn't find an account linked to this phone number.

━━━━━━━━━━━━━━━━━━━━━

Would you like to proceed as a *walk-in* customer?

1️⃣  ✅  *Yes* - Continue as walk-in
2️⃣  ❌  *No* - Cancel

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-2)_
"""

    ACCOUNT_NOT_FOUND = """
╭─────────────────────────╮
   🔍 *ACCOUNT NOT FOUND*
╰─────────────────────────╯

The account number you entered was not found in our system.

Please *verify* and enter the correct account number:
"""

    SESSION_EXPIRED = """
╭─────────────────────────╮
   ⏰ *SESSION EXPIRED*
╰─────────────────────────╯

Your session has expired due to inactivity.

━━━━━━━━━━━━━━━━━━━━━
💡 Send *Hi* to start again
━━━━━━━━━━━━━━━━━━━━━
"""

    ERROR_OCCURRED = """
╭─────────────────────────╮
   ❌ *ERROR*
╰─────────────────────────╯

We encountered an error processing your request.

━━━━━━━━━━━━━━━━━━━━━
💡 Send *Hi* to try again
━━━━━━━━━━━━━━━━━━━━━

_We apologize for the inconvenience._
"""

    CANCELLED = """
╭─────────────────────────╮
   ❌ *CANCELLED*
╰─────────────────────────╯

Your request has been cancelled.

━━━━━━━━━━━━━━━━━━━━━
💡 Send *Hi* for a new transaction
━━━━━━━━━━━━━━━━━━━━━
"""

    ACTIVE_SLIP_EXISTS = """
╭─────────────────────────╮
   📋 *ACTIVE SLIP EXISTS*
╰─────────────────────────╯

You already have an active deposit slip:

━━━━━━━━━━━━━━━━━━━━━
🔑 *DRID:* `{drid}`
📊 *Status:* {status}
━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

1️⃣  👁️  View slip details
2️⃣  ❌  Cancel existing slip
3️⃣  🔙  Return to main menu

━━━━━━━━━━━━━━━━━━━━━
_Reply with option number (1-3)_
"""

    CHEQUE_OCR_FAILED = """
╭─────────────────────────╮
   ❌ *PROCESSING FAILED*
╰─────────────────────────╯

We couldn't read the cheque image clearly.

━━━━━━━━━━━━━━━━━━━━━
📸 *Please try again with:*
━━━━━━━━━━━━━━━━━━━━━

✓ Better *lighting*
✓ Cheque on *flat surface*
✓ Complete cheque *visible*
✓ No *shadows* or glare
✓ *Steady* camera

━━━━━━━━━━━━━━━━━━━━━

📷 _Send a clearer cheque image_
"""

    # ============================================
    # PLACEHOLDER MESSAGES
    # ============================================

    COMING_SOON = """
╭─────────────────────────╮
   🚧 *COMING SOON*
╰─────────────────────────╯

This feature is under development and will be available soon!

━━━━━━━━━━━━━━━━━━━━━
💡 Send *Hi* for main menu
━━━━━━━━━━━━━━━━━━━━━
"""

    ACCOUNT_SERVICES_PLACEHOLDER = """
╭─────────────────────────╮
   💳 *ACCOUNT SERVICES*
╰─────────────────────────╯

Account services are coming soon!

━━━━━━━━━━━━━━━━━━━━━
🔜 *Upcoming Features:*
• Balance Inquiry
• Mini Statement
• Account Details
━━━━━━━━━━━━━━━━━━━━━

💡 Send *Hi* for main menu
"""

    CARD_SERVICES_PLACEHOLDER = """
╭─────────────────────────╮
   💳 *CARD SERVICES*
╰─────────────────────────╯

Card services are coming soon!

━━━━━━━━━━━━━━━━━━━━━
🔜 *Upcoming Features:*
• Card Activation
• Block Card
• PIN Reset
━━━━━━━━━━━━━━━━━━━━━

💡 Send *Hi* for main menu
"""

    COMPLAINTS_PLACEHOLDER = """
╭─────────────────────────╮
   📞 *SUPPORT*
╰─────────────────────────╯

We're here to help!

━━━━━━━━━━━━━━━━━━━━━
📞 *Call Center:*
     111-331-331

📧 *Email:*
     support@meezanbank.com

🌐 *Website:*
     www.meezanbank.com
━━━━━━━━━━━━━━━━━━━━━

💡 Send *Hi* for main menu
"""

    APPOINTMENT_PLACEHOLDER = """
╭─────────────────────────╮
   📅 *APPOINTMENT*
╰─────────────────────────╯

Appointment booking is coming soon!

━━━━━━━━━━━━━━━━━━━━━
🔜 *Upcoming Features:*
• Branch Visit Booking
• Time Slot Selection
• Appointment Reminders
━━━━━━━━━━━━━━━━━━━━━

💡 Send *Hi* for main menu
"""

    BRANCH_LOCATOR_PLACEHOLDER = """
╭─────────────────────────╮
   📍 *BRANCH LOCATOR*
╰─────────────────────────╯

Find your nearest Meezan Bank branch:

━━━━━━━━━━━━━━━━━━━━━
🌐 *Visit:*
meezanbank.com/branch-locator
━━━━━━━━━━━━━━━━━━━━━

💡 Send *Hi* for main menu
"""

    # ============================================
    # HELPER METHODS
    # ============================================

    @staticmethod
    def format_amount(amount: Optional[Decimal]) -> str:
        """Format amount as PKR with commas"""
        if amount is None:
            return "N/A"
        try:
            return f"PKR {float(amount):,.2f}"
        except:
            return f"PKR {amount}"

    @staticmethod
    def mask_account(account_number: Optional[str]) -> str:
        """Mask account number showing only last 4 digits"""
        if not account_number:
            return "****"
        if len(account_number) <= 4:
            return account_number
        return f"****{account_number[-4:]}"

    @staticmethod
    def format_datetime(dt: Optional[datetime]) -> str:
        """Format datetime for display"""
        if not dt:
            return "N/A"
        return dt.strftime("%d %b %Y, %I:%M %p")

    @staticmethod
    def format_date(dt: Optional[datetime]) -> str:
        """Format date only for display"""
        if not dt:
            return "N/A"
        return dt.strftime("%d %b %Y")

    @staticmethod
    def get_number_emoji(num: int) -> str:
        """Get number emoji for list items"""
        emojis = {
            1: "1️⃣",
            2: "2️⃣",
            3: "3️⃣",
            4: "4️⃣",
            5: "5️⃣",
            6: "6️⃣",
            7: "7️⃣",
            8: "8️⃣",
            9: "9️⃣",
            10: "🔟"
        }
        return emojis.get(num, f"{num}.")

    @staticmethod
    def clean_phone_number(phone: str) -> str:
        """Clean and normalize phone number"""
        # Remove all non-digits
        digits = ''.join(filter(str.isdigit, phone))

        # Handle Pakistan numbers
        if digits.startswith('92'):
            digits = '0' + digits[2:]
        elif digits.startswith('0092'):
            digits = '0' + digits[4:]
        elif not digits.startswith('0') and len(digits) == 10:
            digits = '0' + digits

        return digits

    @staticmethod
    def validate_cnic(cnic: str) -> bool:
        """Validate CNIC format: XXXXX-XXXXXXX-X"""
        import re
        # Remove any spaces or extra dashes
        cnic = cnic.strip().replace(' ', '')

        # Check format with or without dashes
        pattern_with_dashes = r'^\d{5}-\d{7}-\d{1}$'
        pattern_without_dashes = r'^\d{13}$'

        return bool(re.match(pattern_with_dashes, cnic) or re.match(pattern_without_dashes, cnic))

    @staticmethod
    def format_cnic(cnic: str) -> str:
        """Format CNIC to standard format: XXXXX-XXXXXXX-X"""
        digits = ''.join(filter(str.isdigit, cnic))
        if len(digits) == 13:
            return f"{digits[:5]}-{digits[5:12]}-{digits[12]}"
        return cnic

    @staticmethod
    def validate_phone(phone: str) -> bool:
        """Validate Pakistani phone number"""
        digits = ''.join(filter(str.isdigit, phone))
        # Pakistani mobile numbers: 03XXXXXXXXX (11 digits starting with 03)
        if digits.startswith('03') and len(digits) == 11:
            return True
        # With country code
        if digits.startswith('923') and len(digits) == 12:
            return True
        return False

    @staticmethod
    def validate_amount(amount_str: str) -> Optional[Decimal]:
        """Validate and parse amount string"""
        try:
            # Remove commas and spaces
            clean = amount_str.replace(',', '').replace(' ', '').strip()
            amount = Decimal(clean)
            if amount > 0:
                return amount
        except:
            pass
        return None
