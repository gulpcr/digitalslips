/**
 * Content script for Digital Slips web app
 * Features: Presence check, login detection, floating pill button,
 * embedded DRID Lookup Modal, save detection, Ctrl+Shift+D hotkey
 */

(function () {
  'use strict';

  const BRAND_COLOR = '#5B2D8E';
  const BRAND_DARK = '#452170';
  const WIDGET_ID = 'dds-extension-widget';
  const MARKER_ID = 'dds-extension-active';
  const MODAL_ID = 'dds-drid-modal-overlay';

  let widgetEl = null;
  let userInfo = null;

  // ── 1. Presence Check ──

  function injectPresenceMarker() {
    if (document.getElementById(MARKER_ID)) return;
    const marker = document.createElement('div');
    marker.id = MARKER_ID;
    marker.style.display = 'none';
    marker.dataset.version = chrome.runtime.getManifest().version;
    document.body.appendChild(marker);
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'DDS_EXTENSION_CHECK') {
      window.postMessage({
        type: 'DDS_EXTENSION_RESPONSE',
        active: true,
        version: chrome.runtime.getManifest().version,
      }, '*');
    }
    // Receive config from web portal and save to extension storage
    if (event.data?.type === 'DDS_EXTENSION_CONFIG' && event.data.config) {
      chrome.runtime.sendMessage({
        type: 'SAVE_CONFIG',
        config: event.data.config,
      }).catch(() => {});
    }
  });

  function showPresenceBadge() {
    if (document.getElementById('dds-presence-badge')) return;
    const badge = document.createElement('div');
    badge.id = 'dds-presence-badge';
    badge.innerHTML = `
      <div style="
        position: fixed; top: 12px; right: 12px; z-index: 99999;
        background: ${BRAND_COLOR}; color: white; padding: 6px 14px;
        border-radius: 20px; font-size: 12px; font-family: system-ui, sans-serif;
        display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: opacity 0.3s;
      ">
        <span style="width:8px;height:8px;border-radius:50%;background:#4ade80;display:inline-block;"></span>
        Extension Active
      </div>
    `;
    document.body.appendChild(badge);
    setTimeout(() => {
      const el = document.getElementById('dds-presence-badge');
      if (el) el.style.opacity = '0';
      setTimeout(() => el?.remove(), 300);
    }, 5000);
  }

  // ── 2. Login Detection ──

  function checkForLogin() {
    const token = localStorage.getItem('access_token');
    if (!token) return false;
    const authStorage = localStorage.getItem('auth-storage');
    let user = null;
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        user = parsed?.state?.user;
      } catch { /* ignore */ }
    }
    return { token, user };
  }

  // Safe message sender — handles "Extension context invalidated"
  function safeSendMessage(msg) {
    try {
      chrome.runtime.sendMessage(msg).catch(() => {});
    } catch {
      // Extension was reloaded — stop polling
      clearInterval(tokenPollInterval);
    }
  }

  function onLoginDetected(token, user) {
    userInfo = user;
    let jwtPayload = null;
    try {
      jwtPayload = JSON.parse(atob(token.split('.')[1]));
    } catch { /* ignore */ }
    safeSendMessage({
      type: 'DIGITAL_SLIPS_LOGIN_SUCCESS',
      accessToken: token,
      refreshToken: localStorage.getItem('refresh_token'),
      user: user || jwtPayload,
    });
    setTimeout(() => createWidget(), 500);
  }

  function onLogoutDetected() {
    userInfo = null;
    safeSendMessage({ type: 'DIGITAL_SLIPS_LOGOUT' });
    removeWidget();
  }

  let lastToken = localStorage.getItem('access_token');
  const tokenPollInterval = setInterval(() => {
    const currentToken = localStorage.getItem('access_token');
    if (currentToken && !lastToken) {
      const loginData = checkForLogin();
      if (loginData) onLoginDetected(loginData.token, loginData.user);
    } else if (!currentToken && lastToken) {
      onLogoutDetected();
    }
    lastToken = currentToken;
  }, 1000);

  const origPushState = history.pushState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    setTimeout(() => {
      const loginData = checkForLogin();
      if (loginData && !widgetEl) {
        onLoginDetected(loginData.token, loginData.user);
      }
    }, 500);
  };

  const bodyObserver = new MutationObserver(() => {
    const loginData = checkForLogin();
    if (loginData && !widgetEl) {
      onLoginDetected(loginData.token, loginData.user);
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });

  // ── 3. Floating Pill Button ──

  function createWidget() {
    if (document.getElementById(WIDGET_ID)) return;
    widgetEl = document.createElement('div');
    widgetEl.id = WIDGET_ID;
    widgetEl.innerHTML = `
      <style>
        #${WIDGET_ID} {
          position: fixed; right: 20px; bottom: 20px; z-index: 999999;
          font-family: system-ui, -apple-system, sans-serif;
        }
        #dds-widget-pill {
          width: 56px; height: 56px; border-radius: 50%;
          background: ${BRAND_COLOR}; color: white; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.2s;
          font-size: 20px;
        }
        #dds-widget-pill:hover { transform: scale(1.1); }
        #dds-widget-pill:active { transform: scale(0.95); }
      </style>
      <button id="dds-widget-pill" title="Open DRID Lookup (Ctrl+Shift+D)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="7" y1="8" x2="17" y2="8"/>
          <line x1="7" y1="12" x2="17" y2="12"/>
          <line x1="7" y1="16" x2="13" y2="16"/>
        </svg>
      </button>
    `;
    document.body.appendChild(widgetEl);
    const pill = widgetEl.querySelector('#dds-widget-pill');
    makeDraggable(pill, widgetEl);
    pill.addEventListener('click', openDRIDModal);
    chrome.storage.local.get('widgetPosition', (result) => {
      if (result.widgetPosition) {
        widgetEl.style.right = result.widgetPosition.right + 'px';
        widgetEl.style.bottom = result.widgetPosition.bottom + 'px';
      }
    });
  }

  function removeWidget() {
    const el = document.getElementById(WIDGET_ID);
    if (el) el.remove();
    widgetEl = null;
  }

  // ── 4. Embedded DRID Lookup Modal ──

  let modalState = {
    step: 'lookup', // lookup | retrieved | complete | success
    drid: '',
    loading: false,
    error: null,
    depositSlip: null,
    validation: null,
    amountConfirmed: false,
    depositorVerified: false,
    instrumentVerified: false,
    verifyNotes: '',
    authorizationCaptured: false,
    tellerNotes: '',
    completionResult: null,
  };

  function resetModalState() {
    modalState = {
      step: 'lookup', drid: '', loading: false, error: null,
      depositSlip: null, validation: null,
      amountConfirmed: false, depositorVerified: false, instrumentVerified: false,
      verifyNotes: '', authorizationCaptured: false, tellerNotes: '',
      completionResult: null,
    };
  }

  function openDRIDModal() {
    if (document.getElementById(MODAL_ID)) return;
    resetModalState();
    renderModal();
  }

  function closeDRIDModal() {
    const el = document.getElementById(MODAL_ID);
    if (el) el.remove();
    resetModalState();
  }

  function renderModal() {
    let overlay = document.getElementById(MODAL_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = MODAL_ID;
      document.body.appendChild(overlay);
    }

    const s = modalState;
    const slip = s.depositSlip;
    const needsInstrument = slip && ['CHEQUE_DEPOSIT', 'PAY_ORDER'].includes(slip.transaction_type);

    overlay.innerHTML = `
      <style>
        #${MODAL_ID} {
          position: fixed; inset: 0; z-index: 9999999;
          background: rgba(0,0,0,0.5); display: flex;
          align-items: center; justify-content: center;
          font-family: system-ui, -apple-system, sans-serif;
          padding: 16px;
        }
        #${MODAL_ID} * { box-sizing: border-box; }
        .dds-modal {
          background: white; border-radius: 12px; width: 100%; max-width: 640px;
          max-height: 90vh; overflow-y: auto; padding: 28px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.25);
        }
        .dds-modal-header {
          display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;
        }
        .dds-modal-title { font-size: 24px; font-weight: 700; color: ${BRAND_COLOR}; margin: 0; }
        .dds-modal-subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
        .dds-close-btn {
          background: none; border: none; cursor: pointer; color: #94a3b8;
          font-size: 24px; padding: 4px; line-height: 1;
        }
        .dds-close-btn:hover { color: #334155; }
        .dds-form-row { display: flex; gap: 12px; margin-bottom: 20px; }
        .dds-input {
          flex: 1; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px;
          font-size: 15px; outline: none; font-family: inherit;
        }
        .dds-input:focus { border-color: ${BRAND_COLOR}; box-shadow: 0 0 0 3px rgba(91,45,142,0.1); }
        .dds-btn {
          padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
          border: none; cursor: pointer; font-family: inherit; white-space: nowrap;
          transition: background 0.2s;
        }
        .dds-btn-primary { background: ${BRAND_COLOR}; color: white; }
        .dds-btn-primary:hover { background: ${BRAND_DARK}; }
        .dds-btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
        .dds-btn-outline { background: white; color: ${BRAND_COLOR}; border: 2px solid ${BRAND_COLOR}; }
        .dds-btn-outline:hover { background: #f5f0fa; }
        .dds-btn-full { width: 100%; }
        .dds-error {
          background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;
          padding: 12px 16px; color: #b91c1c; font-size: 14px; margin-bottom: 16px;
        }
        .dds-instructions {
          background: #f8fafc; border-radius: 8px; padding: 20px; margin-top: 20px;
        }
        .dds-instructions h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0 0 12px; }
        .dds-instructions ol { margin: 0; padding-left: 20px; color: #64748b; font-size: 14px; line-height: 1.8; }
        .dds-detail-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;
        }
        .dds-detail-card {
          background: #f8fafc; border-radius: 8px; padding: 16px;
        }
        .dds-detail-label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .dds-detail-value { font-size: 18px; font-weight: 700; color: ${BRAND_COLOR}; }
        .dds-detail-value-sm { font-size: 15px; font-weight: 600; color: #1e293b; }
        .dds-section-title {
          font-size: 15px; font-weight: 600; color: #1e293b; margin: 0 0 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .dds-customer-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;
        }
        .dds-customer-grid .label { color: #64748b; }
        .dds-customer-grid .value { font-weight: 500; color: #1e293b; }
        .dds-check-row {
          display: flex; align-items: center; gap: 12px; padding: 8px 0; cursor: pointer;
        }
        .dds-check-row input[type="checkbox"] {
          width: 20px; height: 20px; accent-color: ${BRAND_COLOR};
        }
        .dds-check-row span { font-size: 14px; }
        .dds-textarea {
          width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
          font-size: 14px; font-family: inherit; resize: vertical; min-height: 60px;
        }
        .dds-textarea:focus { border-color: ${BRAND_COLOR}; outline: none; }
        .dds-btn-row { display: flex; gap: 12px; margin-top: 20px; }
        .dds-success-center { text-align: center; }
        .dds-success-icon {
          width: 64px; height: 64px; border-radius: 50%; background: #16a34a;
          display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;
        }
        .dds-success-icon svg { width: 32px; height: 32px; color: white; }
        .dds-success-ref {
          background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;
        }
        .dds-time-warning {
          display: flex; align-items: center; gap: 8px; padding: 12px; margin-bottom: 16px;
          background: #fffbeb; border: 1px solid #fbbf24; border-radius: 8px;
          font-size: 14px; font-weight: 500; color: #92400e;
        }
        .dds-divider { border-top: 1px solid #e2e8f0; margin: 16px 0; padding-top: 16px; }
        .dds-spinner {
          display: inline-block; width: 18px; height: 18px;
          border: 2px solid white; border-top-color: transparent; border-radius: 50%;
          animation: dds-spin 0.6s linear infinite; vertical-align: middle; margin-right: 6px;
        }
        @keyframes dds-spin { to { transform: rotate(360deg); } }
        .dds-depositor-box {
          background: #f5f0fa; border-radius: 8px; padding: 16px; margin-bottom: 16px;
        }
        .dds-cheque-box {
          background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
          padding: 16px; margin-bottom: 16px;
        }
        .dds-narration {
          background: #f8fafc; padding: 8px 12px; border-radius: 6px;
          font-size: 14px; color: #475569; margin-top: 4px;
        }
      </style>

      <div class="dds-modal">
        ${renderModalContent(s, slip, needsInstrument)}
      </div>
    `;

    // Bind events
    bindModalEvents(s, slip, needsInstrument);
  }

  function renderModalContent(s, slip, needsInstrument) {
    // Header
    let subtitle = '';
    if (s.step === 'lookup') subtitle = 'Enter customer DRID to retrieve deposit slip';
    if (s.step === 'retrieved') subtitle = 'Review and verify transaction details';
    if (s.step === 'complete') subtitle = 'Capture authorization and complete';
    if (s.step === 'success') subtitle = 'Transaction completed successfully';

    let html = `
      <div class="dds-modal-header">
        <div>
          <h2 class="dds-modal-title">DRID Transaction</h2>
          <p class="dds-modal-subtitle">${subtitle}</p>
        </div>
        <button class="dds-close-btn" id="dds-close-modal">&times;</button>
      </div>
    `;

    // ── LOOKUP STEP ──
    if (s.step === 'lookup') {
      html += `
        <div class="dds-form-row">
          <input class="dds-input" id="dds-drid-input" type="text"
            placeholder="Enter DRID (e.g., DRID-20240128-ABC123)"
            value="${escHtml(s.drid)}" ${s.loading ? 'disabled' : ''} />
          <button class="dds-btn dds-btn-primary" id="dds-retrieve-btn" ${s.loading ? 'disabled' : ''}>
            ${s.loading ? '<span class="dds-spinner"></span>Retrieving...' : 'Retrieve'}
          </button>
        </div>
      `;
      if (s.error) {
        html += `<div class="dds-error">${escHtml(s.error)}</div>`;
      }
      html += `
        <div class="dds-instructions">
          <h3>Instructions</h3>
          <ol>
            <li>Ask customer for their Digital Reference ID (DRID)</li>
            <li>Enter the DRID or scan QR code</li>
            <li>Verify the pre-filled details with the customer</li>
            <li>Count cash/verify instrument and confirm amount</li>
            <li>Capture customer authorization and complete transaction</li>
          </ol>
        </div>
      `;
    }

    // ── RETRIEVED STEP ──
    if (s.step === 'retrieved' && slip) {
      const amount = formatPKR(slip.amount, slip.currency);
      const timeStr = formatTimeRemaining(slip.time_remaining_seconds);

      html += `
        <div class="dds-time-warning">&#9200; Time Remaining: ${timeStr}</div>

        <div class="dds-detail-grid">
          <div class="dds-detail-card">
            <div class="dds-detail-label">Amount</div>
            <div class="dds-detail-value">${escHtml(amount)}</div>
          </div>
          <div class="dds-detail-card">
            <div class="dds-detail-label">Type</div>
            <div class="dds-detail-value-sm">${escHtml((slip.transaction_type || 'N/A').replace(/_/g, ' '))}</div>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <div class="dds-section-title">Customer Information</div>
          <div class="dds-customer-grid">
            <div><span class="label">Name:</span><div class="value">${escHtml(slip.customer_name || 'N/A')}</div></div>
            <div><span class="label">CNIC:</span><div class="value">${escHtml(slip.customer_cnic || 'N/A')}</div></div>
            <div><span class="label">Account:</span><div class="value">${escHtml(slip.customer_account || 'N/A')}</div></div>
            <div><span class="label">Branch:</span><div class="value">${escHtml(slip.branch_name || 'N/A')}</div></div>
          </div>
        </div>
      `;

      // Depositor info
      if (slip.depositor_name) {
        html += `
          <div class="dds-depositor-box">
            <div class="dds-section-title">Depositor (Verify Identity)</div>
            <div class="dds-customer-grid">
              <div><span class="label">Name:</span><div class="value">${escHtml(slip.depositor_name)}</div></div>
              ${slip.depositor_cnic ? `<div><span class="label">CNIC:</span><div class="value">${escHtml(slip.depositor_cnic)}</div></div>` : ''}
              ${slip.depositor_phone ? `<div><span class="label">Phone:</span><div class="value">${escHtml(slip.depositor_phone)}</div></div>` : ''}
              ${slip.depositor_relationship ? `<div><span class="label">Relationship:</span><div class="value">${escHtml(slip.depositor_relationship)}</div></div>` : ''}
            </div>
          </div>
        `;
      }

      // Cheque details
      if (slip.transaction_type === 'CHEQUE_DEPOSIT' && slip.additional_data) {
        const ad = slip.additional_data;
        html += `
          <div class="dds-cheque-box">
            <div class="dds-section-title">Cheque Details</div>
            <div class="dds-customer-grid">
              <div><span class="label">Bank:</span><div class="value">${escHtml(ad.cheque_bank || 'N/A')}</div></div>
              <div><span class="label">Cheque Date:</span><div class="value">${escHtml(ad.cheque_date || 'N/A')}</div></div>
              <div><span class="label">Account Holder:</span><div class="value">${escHtml(ad.cheque_account_holder_name || 'N/A')}</div></div>
              <div><span class="label">Payee:</span><div class="value">${escHtml(ad.cheque_payee_name || 'N/A')}</div></div>
              <div><span class="label">Cheque #:</span><div class="value">${escHtml(ad.cheque_number || 'N/A')}</div></div>
              ${ad.cheque_amount_in_words ? `<div style="grid-column:span 2;"><span class="label">Amount in Words:</span><div class="value">${escHtml(ad.cheque_amount_in_words)}</div></div>` : ''}
            </div>
          </div>
        `;
      }

      // Narration
      if (slip.narration) {
        html += `
          <div style="margin-bottom:16px;">
            <span style="font-size:13px;color:#64748b;">Narration:</span>
            <div class="dds-narration">${escHtml(slip.narration)}</div>
          </div>
        `;
      }

      // Verification checklist
      html += `
        <div class="dds-divider">
          <div class="dds-section-title">Verification Checklist</div>
          <label class="dds-check-row">
            <input type="checkbox" id="dds-chk-amount" ${s.amountConfirmed ? 'checked' : ''} />
            <span>Amount confirmed: <strong>${escHtml(amount)}</strong></span>
          </label>
          <label class="dds-check-row">
            <input type="checkbox" id="dds-chk-depositor" ${s.depositorVerified ? 'checked' : ''} />
            <span>Depositor identity verified (CNIC checked)</span>
          </label>
          ${needsInstrument ? `
            <label class="dds-check-row">
              <input type="checkbox" id="dds-chk-instrument" ${s.instrumentVerified ? 'checked' : ''} />
              <span>Instrument verified (Cheque/Pay Order details correct)</span>
            </label>
          ` : ''}
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:14px;font-weight:500;color:#1e293b;">Notes (Optional)</label>
          <textarea class="dds-textarea" id="dds-verify-notes" placeholder="Any observations or notes">${escHtml(s.verifyNotes)}</textarea>
        </div>

        <div class="dds-btn-row">
          <button class="dds-btn dds-btn-outline dds-btn-full" id="dds-back-lookup">Back</button>
          <button class="dds-btn dds-btn-primary dds-btn-full" id="dds-verify-btn"
            ${s.loading ? 'disabled' : ''}
            ${!s.amountConfirmed || !s.depositorVerified || (needsInstrument && !s.instrumentVerified) ? 'disabled' : ''}>
            ${s.loading ? '<span class="dds-spinner"></span>Verifying...' : 'Verify & Continue'}
          </button>
        </div>
      `;
    }

    // ── COMPLETE STEP ──
    if (s.step === 'complete' && slip) {
      const amount = formatPKR(slip.amount, slip.currency);
      html += `
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;margin-bottom:20px;display:flex;align-items:center;gap:8px;">
          <span style="color:#16a34a;font-size:20px;">&#10003;</span>
          <div>
            <div style="font-weight:600;color:#16a34a;">Details Verified</div>
            <div style="font-size:14px;color:#64748b;">Ready to complete transaction for ${escHtml(amount)}</div>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <div class="dds-section-title">Customer Authorization</div>
          <label class="dds-check-row" style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
            <input type="checkbox" id="dds-chk-auth" ${s.authorizationCaptured ? 'checked' : ''} />
            <div>
              <div style="font-size:14px;font-weight:500;">I confirm that customer authorization has been captured</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">Customer has signed or provided verbal confirmation</div>
            </div>
          </label>
        </div>

        <div style="margin-bottom:20px;">
          <label style="font-size:14px;font-weight:500;color:#1e293b;">Teller Notes (Optional)</label>
          <textarea class="dds-textarea" id="dds-teller-notes" placeholder="Any additional notes">${escHtml(s.tellerNotes)}</textarea>
        </div>

        <div class="dds-btn-row">
          <button class="dds-btn dds-btn-outline dds-btn-full" id="dds-back-retrieved">Back</button>
          <button class="dds-btn dds-btn-primary dds-btn-full" id="dds-complete-btn"
            ${s.loading || !s.authorizationCaptured ? 'disabled' : ''}>
            ${s.loading ? '<span class="dds-spinner"></span>Completing...' : 'Complete Transaction'}
          </button>
        </div>
      `;
    }

    // ── SUCCESS STEP ──
    if (s.step === 'success' && s.completionResult) {
      const cr = s.completionResult;
      html += `
        <div class="dds-success-center">
          <div class="dds-success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h3 style="font-size:20px;font-weight:700;color:#1e293b;margin:0 0 8px;">Transaction Completed!</h3>
          <p style="color:#64748b;margin:0 0 20px;">Reference: ${escHtml(cr.transaction_reference)}</p>
          ${cr.receipt_number ? `
            <div class="dds-success-ref">
              <div style="font-size:13px;color:#64748b;">Receipt Number</div>
              <div style="font-size:18px;font-weight:700;color:${BRAND_COLOR};">${escHtml(cr.receipt_number)}</div>
            </div>
          ` : ''}
          <div class="dds-btn-row">
            <button class="dds-btn dds-btn-outline dds-btn-full" id="dds-close-success">Close</button>
            <button class="dds-btn dds-btn-primary dds-btn-full" id="dds-new-txn">New Transaction</button>
          </div>
        </div>
      `;
    }

    return html;
  }

  function bindModalEvents(s, slip, needsInstrument) {
    const $ = (id) => document.getElementById(id);

    // Close
    $('dds-close-modal')?.addEventListener('click', closeDRIDModal);

    // Click outside to close
    const overlay = $(MODAL_ID);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) closeDRIDModal();
    });

    // ── Lookup step ──
    if (s.step === 'lookup') {
      const input = $('dds-drid-input');
      const btn = $('dds-retrieve-btn');
      setTimeout(() => input?.focus(), 50);

      input?.addEventListener('input', (e) => {
        const val = e.target.value;
        // Don't uppercase if it looks like JSON (from QR scanner)
        modalState.drid = val.startsWith('{') ? val : val.toUpperCase();
        e.target.value = modalState.drid;
        modalState.error = null;
      });
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btn?.click();
      });
      btn?.addEventListener('click', handleLookup);
    }

    // ── Retrieved step ──
    if (s.step === 'retrieved') {
      $('dds-chk-amount')?.addEventListener('change', (e) => { modalState.amountConfirmed = e.target.checked; renderModal(); });
      $('dds-chk-depositor')?.addEventListener('change', (e) => { modalState.depositorVerified = e.target.checked; renderModal(); });
      $('dds-chk-instrument')?.addEventListener('change', (e) => { modalState.instrumentVerified = e.target.checked; renderModal(); });
      $('dds-verify-notes')?.addEventListener('input', (e) => { modalState.verifyNotes = e.target.value; });
      $('dds-back-lookup')?.addEventListener('click', () => { modalState.step = 'lookup'; renderModal(); });
      $('dds-verify-btn')?.addEventListener('click', handleVerify);
    }

    // ── Complete step ──
    if (s.step === 'complete') {
      $('dds-chk-auth')?.addEventListener('change', (e) => { modalState.authorizationCaptured = e.target.checked; renderModal(); });
      $('dds-teller-notes')?.addEventListener('input', (e) => { modalState.tellerNotes = e.target.value; });
      $('dds-back-retrieved')?.addEventListener('click', () => { modalState.step = 'retrieved'; renderModal(); });
      $('dds-complete-btn')?.addEventListener('click', handleComplete);
    }

    // ── Success step ──
    if (s.step === 'success') {
      $('dds-close-success')?.addEventListener('click', closeDRIDModal);
      $('dds-new-txn')?.addEventListener('click', () => { resetModalState(); renderModal(); });
    }
  }

  async function handleLookup() {
    let drid = modalState.drid.trim();
    if (!drid) { modalState.error = 'Please enter a DRID'; renderModal(); return; }

    // Extract from JSON (QR code)
    if (drid.includes('"drid"') || drid.startsWith('{')) {
      try {
        const parsed = JSON.parse(drid);
        if (parsed.drid) drid = parsed.drid.toUpperCase();
      } catch {
        const match = drid.match(/DRID-[\w-]+/i);
        if (match) drid = match[0].toUpperCase();
      }
    }
    modalState.drid = drid;
    modalState.loading = true;
    modalState.error = null;
    renderModal();

    try {
      // Pass auth token from page localStorage so background has it even if session storage was cleared
      const pageToken = localStorage.getItem('access_token');
      const pageRefresh = localStorage.getItem('refresh_token');
      const result = await chrome.runtime.sendMessage({ type: 'RETRIEVE_SLIP', drid, accessToken: pageToken, refreshToken: pageRefresh });
      if (!result) throw new Error('No response from extension background');
      if (result.error) throw new Error(result.error);
      if (!result.success) throw new Error(result.message || 'Retrieval failed');
      modalState.depositSlip = result.slip;
      modalState.validation = result.validation;
      modalState.step = 'retrieved';
    } catch (err) {
      modalState.error = err.message || 'Failed to retrieve deposit slip';
    }
    modalState.loading = false;
    renderModal();
  }

  async function handleVerify() {
    const slip = modalState.depositSlip;
    if (!slip) return;
    const needsInstrument = ['CHEQUE_DEPOSIT', 'PAY_ORDER'].includes(slip.transaction_type);

    modalState.loading = true;
    renderModal();

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'VERIFY_SLIP',
        drid: slip.drid,
        data: {
          amount_confirmed: modalState.amountConfirmed,
          depositor_identity_verified: modalState.depositorVerified,
          instrument_verified: needsInstrument ? modalState.instrumentVerified : undefined,
          notes: modalState.verifyNotes || undefined,
        },
      });
      if (!result.success) throw new Error(result.error || 'Verification failed');
      modalState.step = 'complete';
    } catch (err) {
      modalState.error = err.message;
    }
    modalState.loading = false;
    renderModal();
  }

  async function handleComplete() {
    const slip = modalState.depositSlip;
    if (!slip) return;

    modalState.loading = true;
    renderModal();

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'COMPLETE_SLIP',
        drid: slip.drid,
        data: {
          authorization_captured: modalState.authorizationCaptured,
          teller_notes: modalState.tellerNotes || undefined,
        },
        // Include full slip data so background can auto-forward to T24 Transact
        slip: slip,
      });
      if (!result.success) throw new Error(result.error || 'Completion failed');
      modalState.completionResult = result.result;
      modalState.step = 'success';
    } catch (err) {
      modalState.error = err.message;
    }
    modalState.loading = false;
    renderModal();
  }

  // ── Listen for messages from background (extension icon click) ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'OPEN_DRID_MODAL') {
      openDRIDModal();
      sendResponse({ ok: true });
    }
  });

  // ── 5. Save Detection ──

  let currentSlipData = null;
  function setupSaveDetection() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const text = node.textContent || '';
          if (
            (node.classList?.contains('Toastify__toast--success') ||
              node.querySelector?.('.Toastify__toast--success') ||
              text.includes('successfully') || text.includes('completed')) &&
            currentSlipData
          ) {
            chrome.runtime.sendMessage({
              type: 'SLIP_SAVE_SUCCESS',
              drid: currentSlipData.drid,
              slip: currentSlipData,
            });
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── 6. Hotkey: Ctrl+Shift+D ──

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      openDRIDModal();
    }
  });

  // ── 7. Physical QR/Barcode Scanner Detection ──
  // Scanners act as keyboard emulators: type characters rapidly (< 50ms apart) then press Enter.
  // Detect this pattern globally and auto-open DRID modal with scanned content.

  let scanBuffer = '';
  let scanTimeout = null;
  const SCAN_CHAR_INTERVAL = 80; // Max ms between keystrokes to count as scanner input

  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in a visible input/textarea (not our modal)
    const active = document.activeElement;
    const isInOurModal = active?.closest?.('#' + MODAL_ID);
    const isInInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && !isInOurModal;
    if (isInInput) return;

    // Collect printable characters
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      clearTimeout(scanTimeout);
      scanBuffer += e.key;
      scanTimeout = setTimeout(() => { scanBuffer = ''; }, SCAN_CHAR_INTERVAL);
      return;
    }

    // Enter key with buffered content = scanner completed
    if (e.key === 'Enter' && scanBuffer.length >= 8) {
      e.preventDefault();
      const scannedValue = scanBuffer;
      scanBuffer = '';
      clearTimeout(scanTimeout);
      handleScannerInput(scannedValue);
    }
  });

  function handleScannerInput(scanned) {
    // Extract DRID from scanned content (could be plain DRID or JSON)
    let drid = scanned.trim();

    // Try JSON parse (QR code format)
    if (drid.includes('"drid"') || drid.includes('"DRID"') || drid.startsWith('{')) {
      try {
        const parsed = JSON.parse(drid);
        if (parsed.drid) drid = parsed.drid;
        else if (parsed.DRID) drid = parsed.DRID;
      } catch {
        const match = drid.match(/(?:DRID|MZ)-[\w-]+/i);
        if (match) drid = match[0];
      }
    }

    drid = drid.toUpperCase();

    // Open modal with scanned DRID and auto-trigger lookup
    resetModalState();
    modalState.drid = drid;
    renderModal();

    // Auto-trigger lookup after a brief render delay
    setTimeout(() => handleLookup(), 100);
  }

  // ── Utility Functions ──

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatPKR(amount, currency = 'PKR') {
    return `${currency} ${parseFloat(amount).toLocaleString()}`;
  }

  function formatTimeRemaining(seconds) {
    if (!seconds) return 'Expired';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }

  function makeDraggable(handle, container) {
    let isDragging = false;
    let wasDragged = false;
    let startX, startY, startRight, startBottom;

    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      wasDragged = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = container.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = startX - e.clientX;
      const dy = startY - e.clientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged = true;
      container.style.right = Math.max(0, startRight + dx) + 'px';
      container.style.bottom = Math.max(0, startBottom + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (wasDragged) {
          chrome.storage.local.set({
            widgetPosition: {
              right: parseInt(container.style.right),
              bottom: parseInt(container.style.bottom),
            },
          });
        }
      }
    });

    handle.addEventListener('click', (e) => {
      if (wasDragged) {
        e.stopImmediatePropagation();
        wasDragged = false;
      }
    });
  }

  // ── Initialize ──

  // Auto-detect and save the site URL so background/api.js can derive the API base
  (async () => {
    try {
      const origin = window.location.origin; // e.g. https://rcpt-demo.edimensionz.com
      const stored = await chrome.storage.local.get(['digitalSlipsUrl', 'apiBaseUrl']);
      if (!stored.digitalSlipsUrl || stored.digitalSlipsUrl !== origin) {
        const updates = { digitalSlipsUrl: origin };
        // For production domains, API is proxied via nginx on same origin
        if (!origin.includes('localhost')) {
          updates.apiBaseUrl = origin;
        }
        await chrome.storage.local.set(updates);
      }
    } catch { /* storage unavailable */ }
  })();

  injectPresenceMarker();
  showPresenceBadge();
  setupSaveDetection();

  const loginData = checkForLogin();
  if (loginData) {
    onLoginDetected(loginData.token, loginData.user);
  }

  window.addEventListener('beforeunload', () => {
    clearInterval(tokenPollInterval);
  });
})();
