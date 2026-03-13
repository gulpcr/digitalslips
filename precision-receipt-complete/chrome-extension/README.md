# Digital Deposit Slip Assistant — Chrome Extension

Chrome Extension (Manifest V3) that bridges the Digital Slips web app with T24/Transact core banking, automating deposit slip data entry for bank tellers.

## Features

- **Extension Presence Detection** — Digital Slips login page shows green badge when extension is active
- **Auto-Login to Transact** — Encrypted credentials filled automatically (AES-256-GCM, PIN-based)
- **DRID Lookup** — Manual entry or QR scan to retrieve deposit slip data
- **Auto-Fill T24 Fields** — Maps slip data to T24 screen fields with yellow highlighting
- **Multi-Slip Queue** — Queue multiple slips for sequential processing
- **Offline Cache** — Recent lookups available even without network
- **Audit Log** — Full activity trail with CSV export
- **Configurable Field Mappings** — Per-transaction-type T24 field mappings with JSON import/export
- **Session Timeout Re-auth** — Detects Transact session expiry and re-authenticates
- **Manual Fill Guide** — Copy-button reference when auto-fill fails
- **Ctrl+Shift+D Hotkey** — Toggle the floating widget

## Installation

1. Open `chrome://extensions` in Chrome/Edge
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** and select this `chrome-extension/` directory
4. Navigate to the Digital Slips app — you should see the green "Extension Active" badge

## Configuration

Click the extension icon → gear icon, or right-click → Options:

| Tab | Settings |
|-----|----------|
| URLs & Endpoints | Digital Slips URL, API base, Transact URL |
| Transact Credentials | Username/password encrypted with PIN |
| Field Mappings | T24 screen names and field mappings per transaction type |
| Appearance | Brand color, widget position, auto-open toggle |

## Architecture

```
digital_slips.js ──sendMessage──► background.js ──tabs.sendMessage──► transact.js
                 ◄──response────                ◄──sendMessage──────
popup.js ──────sendMessage──────► background.js
options.js ────storage.local────► (shared config, read by all)
```

## Security

- Transact credentials encrypted with AES-256-GCM (PBKDF2 key derivation, 100K iterations)
- PIN held only in `chrome.storage.session` (cleared on browser close)
- 3 failed PIN attempts disables auto-login for session
- JWT tokens stored in session storage only

## Verification

1. Load extension → navigate to Digital Slips login → green badge appears
2. Log in → Transact tab opens automatically
3. Ctrl+Shift+D → floating widget appears
4. Enter DRID → slip card displays with correct data
5. Click "Fill in Transact" → fields auto-fill with yellow highlights
6. Options page → save URLs, encrypt credentials, import/export mappings
