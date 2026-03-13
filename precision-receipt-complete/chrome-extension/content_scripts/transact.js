/**
 * Content script for T24/Transact core banking
 * Features: Auto-login, field filling, session expiry detection,
 * manual fill guide, amount validation
 */

(function () {
  'use strict';

  const BRAND_COLOR = '#006241';
  const HIGHLIGHT_COLOR = '#fef08a'; // Yellow highlight for filled fields

  let isReady = false;
  let currentSlip = null;
  let pinAttempts = 0;
  const MAX_PIN_ATTEMPTS = 3;

  // ── Default selectors (configurable via options) ──
  let selectors = {
    loginUsername: '#signOnName',
    loginPassword: '#password',
    loginSubmit: '#sign-in',
    loginPage: '#loginForm, .login-container, [data-testid="login"]',
    commandLine: '#commandLine, input[name="commandValue"]',
    mainFrame: '#main, #workspace, [name="main"]',
  };

  // Load custom selectors from storage
  chrome.storage.local.get('transactSelectors', (result) => {
    if (result.transactSelectors) {
      selectors = { ...selectors, ...result.transactSelectors };
    }
    init();
  });

  function init() {
    detectLoginPage();
    setupSessionExpiryDetection();
    notifyReady();
  }

  // ── 1. Login Detection & Auto-Login ──

  function detectLoginPage() {
    const loginEl = document.querySelector(selectors.loginPage);
    const usernameEl = document.querySelector(selectors.loginUsername);

    if (loginEl || usernameEl) {
      attemptAutoLogin();
    }
  }

  async function attemptAutoLogin() {
    if (pinAttempts >= MAX_PIN_ATTEMPTS) {
      showLoginNotification('Auto-login disabled: too many failed PIN attempts', 'error');
      return;
    }

    try {
      // Check if we have encrypted credentials
      const { encryptedTransactCreds } = await chrome.storage.local.get('encryptedTransactCreds');
      if (!encryptedTransactCreds) {
        showLoginNotification('No Transact credentials configured. Set them in extension options.', 'info');
        return;
      }

      // Get PIN from session storage
      let { sessionPin } = await chrome.storage.session.get('sessionPin');

      if (!sessionPin) {
        // Prompt for PIN
        sessionPin = await promptForPIN();
        if (!sessionPin) return;
      }

      // Decrypt credentials
      const { decrypt } = await importCrypto();
      let creds;
      try {
        const decrypted = await decrypt(encryptedTransactCreds, sessionPin);
        creds = JSON.parse(decrypted);
      } catch {
        pinAttempts++;
        await chrome.storage.session.set({ pinAttempts });
        showLoginNotification(`Invalid PIN (${pinAttempts}/${MAX_PIN_ATTEMPTS} attempts)`, 'error');
        // Clear bad PIN
        await chrome.storage.session.remove('sessionPin');
        if (pinAttempts < MAX_PIN_ATTEMPTS) {
          setTimeout(() => attemptAutoLogin(), 500);
        }
        return;
      }

      // Store valid PIN for session
      await chrome.storage.session.set({ sessionPin });
      pinAttempts = 0;

      // Fill login form
      const usernameEl = document.querySelector(selectors.loginUsername);
      const passwordEl = document.querySelector(selectors.loginPassword);
      const submitEl = document.querySelector(selectors.loginSubmit);

      if (usernameEl && passwordEl) {
        fillField(usernameEl, creds.username);
        fillField(passwordEl, creds.password);
        showLoginNotification('Credentials filled. Submitting...', 'success');

        if (submitEl) {
          setTimeout(() => {
            submitEl.click();
          }, 500);
        }
      }
    } catch (err) {
      showLoginNotification('Auto-login error: ' + err.message, 'error');
    }
  }

  function promptForPIN() {
    return new Promise((resolve) => {
      // Create PIN overlay
      const overlay = document.createElement('div');
      overlay.id = 'dds-pin-overlay';
      overlay.innerHTML = `
        <div style="
          position:fixed;top:0;left:0;right:0;bottom:0;
          background:rgba(0,0,0,0.5);z-index:999999;
          display:flex;align-items:center;justify-content:center;
        ">
          <div style="
            background:white;border-radius:12px;padding:24px;width:320px;
            box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:system-ui,sans-serif;
          ">
            <h3 style="margin:0 0 4px;font-size:16px;color:#111;">Enter Session PIN</h3>
            <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
              PIN is used to decrypt your Transact credentials. It is not stored on disk.
            </p>
            <input type="password" id="dds-pin-input" placeholder="Enter PIN"
              style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;
              font-size:14px;box-sizing:border-box;outline:none;" maxlength="20" autofocus/>
            <div style="display:flex;gap:8px;margin-top:16px;">
              <button id="dds-pin-submit" style="
                flex:1;padding:10px;border-radius:8px;border:none;
                background:${BRAND_COLOR};color:white;cursor:pointer;font-size:14px;font-weight:500;
              ">Unlock</button>
              <button id="dds-pin-cancel" style="
                flex:1;padding:10px;border-radius:8px;border:none;
                background:#e5e7eb;color:#374151;cursor:pointer;font-size:14px;
              ">Cancel</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#dds-pin-input');
      const submitBtn = overlay.querySelector('#dds-pin-submit');
      const cancelBtn = overlay.querySelector('#dds-pin-cancel');

      input.focus();

      submitBtn.addEventListener('click', () => {
        const pin = input.value;
        overlay.remove();
        resolve(pin || null);
      });

      cancelBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(null);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
      });
    });
  }

  function showLoginNotification(message, type = 'info') {
    const existing = document.getElementById('dds-login-notification');
    if (existing) existing.remove();

    const colors = {
      info: { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
      success: { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
      error: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
    };
    const c = colors[type] || colors.info;

    const el = document.createElement('div');
    el.id = 'dds-login-notification';
    el.style.cssText = `
      position:fixed;top:16px;right:16px;z-index:999999;
      padding:12px 20px;border-radius:8px;font-size:13px;
      background:${c.bg};color:${c.text};border:1px solid ${c.border};
      font-family:system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.1);
      max-width:400px;animation:dds-slide-in 0.3s ease;
    `;
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }

  // ── 2. Session Expiry Detection ──

  function setupSessionExpiryDetection() {
    const observer = new MutationObserver(() => {
      const loginEl = document.querySelector(selectors.loginPage);
      const usernameEl = document.querySelector(selectors.loginUsername);
      if ((loginEl || usernameEl) && isReady) {
        // Session expired — login page appeared again
        isReady = false;
        chrome.runtime.sendMessage({ type: 'TRANSACT_SESSION_EXPIRED' });
        showLoginNotification('Transact session expired. Re-authenticating...', 'info');
        setTimeout(() => attemptAutoLogin(), 1000);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── 3. Auto-Fill from Slip Data ──

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FILL_TRANSACT') {
      currentSlip = message.slip;
      handleFillTransact(message.slip).then(sendResponse);
      return true;
    }
    if (message.type === 'PING') {
      sendResponse({ alive: true });
      return;
    }
  });

  async function handleFillTransact(slip) {
    if (!slip) return { success: false, error: 'No slip data' };

    showProgressPanel(slip);

    try {
      // Load field mappings
      const { fieldMappings } = await chrome.storage.local.get('fieldMappings');
      const mapping = fieldMappings?.[slip.transaction_type];

      if (!mapping) {
        updateProgress('error', `No field mapping for type: ${slip.transaction_type}`);
        showManualGuide(slip);
        return { success: false, error: 'No field mapping' };
      }

      // Navigate to correct T24 screen using initState (or screen as fallback)
      const screenCmd = mapping.initState || mapping.screen;
      updateProgress('navigating', `Opening ${mapping.screen}...`);
      const navigated = await navigateToScreen(screenCmd);
      if (!navigated) {
        updateProgress('error', 'Could not navigate to screen');
        showManualGuide(slip);
        return { success: false, error: 'Navigation failed' };
      }

      // Wait for T24 screen to load (T24 screens take time)
      await sleep(2500);

      const errors = [];
      const filled = [];

      // 1. Fill text/number input fields
      for (const [t24Field, slipField] of Object.entries(mapping.fields || {})) {
        updateProgress('filling', `Filling ${t24Field}...`);

        const value = getNestedValue(slip, slipField);
        if (value === undefined || value === null || value === '') continue;

        const success = await fillT24Field(t24Field, String(value));
        if (success) {
          filled.push(t24Field);
        } else {
          errors.push(t24Field);
        }
        await sleep(200); // Small delay between fields for T24 to process
      }

      // 2. Fill radio buttons
      for (const [radioName, config] of Object.entries(mapping.radios || {})) {
        updateProgress('filling', `Setting ${radioName}...`);
        let value;
        if (config.value) {
          value = config.value;
        } else if (config.slipField && config.mapping) {
          const slipValue = getNestedValue(slip, config.slipField);
          value = config.mapping[slipValue] || config.mapping['_default'];
        }
        if (value) {
          const success = await fillT24Radio(radioName, value);
          if (success) {
            filled.push(radioName);
          } else {
            errors.push(radioName);
          }
          await sleep(200);
        }
      }

      // 3. Fill select dropdowns
      for (const [selectName, config] of Object.entries(mapping.selects || {})) {
        updateProgress('filling', `Selecting ${selectName}...`);
        const value = config.value || getNestedValue(slip, config.slipField);
        if (value) {
          const success = await fillT24Select(selectName, value);
          if (success) {
            filled.push(selectName);
          } else {
            errors.push(selectName);
          }
          await sleep(200);
        }
      }

      // Amount validation
      if (slip.amount) {
        const amountValid = validateAmount(slip.amount, mapping.fields || {});
        if (!amountValid) {
          errors.push('AMOUNT_MISMATCH');
        }
      }

      const allSuccess = errors.length === 0;
      updateProgress(
        allSuccess ? 'complete' : 'partial',
        allSuccess
          ? `All ${filled.length} fields filled successfully`
          : `${filled.length} filled, ${errors.length} failed: ${errors.join(', ')}`
      );

      if (errors.length > 0) {
        showManualGuide(slip, errors);
      }

      chrome.runtime.sendMessage({
        type: 'TRANSACT_FILL_COMPLETE',
        drid: slip.drid,
        success: allSuccess,
        errors,
        filled,
      });

      return { success: allSuccess, filled, errors };
    } catch (err) {
      updateProgress('error', err.message);
      showManualGuide(slip);
      return { success: false, error: err.message };
    }
  }

  async function navigateToScreen(screenName) {
    // Try command line input (T24's main navigation)
    const cmdEl = document.querySelector(selectors.commandLine);
    if (cmdEl) {
      fillField(cmdEl, screenName);
      // Submit command
      const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true });
      cmdEl.dispatchEvent(event);
      cmdEl.form?.submit();
      return true;
    }

    // Try iframe-based navigation
    const frames = document.querySelectorAll('iframe');
    for (const frame of frames) {
      try {
        const cmdInput = frame.contentDocument?.querySelector(selectors.commandLine);
        if (cmdInput) {
          fillField(cmdInput, screenName);
          const event = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true });
          cmdInput.dispatchEvent(event);
          return true;
        }
      } catch { /* cross-origin iframe */ }
    }

    return false;
  }

  async function fillT24Field(fieldName, value) {
    // T24 uses names like "fieldName:ACCOUNT.2" — the colon is literal in the name attribute
    // Build selectors: exact match first, then partial match
    const baseName = fieldName.replace(/^fieldName:/, '');
    const possibleSelectors = [
      `[name="${fieldName}"]`,
      `[id="${fieldName}"]`,
      `[name="${baseName}"]`,
      `[id="${baseName}"]`,
      `[name*="${baseName}"]`,
      `[id*="${baseName}"]`,
      `input[title="${baseName}"]`,
      `textarea[name="${fieldName}"]`,
      `textarea[name="${baseName}"]`,
    ];

    let input = null;

    // Search main document
    for (const sel of possibleSelectors) {
      input = document.querySelector(sel);
      if (input) break;
    }

    // Search iframes (T24 often uses frames)
    if (!input) {
      const frames = document.querySelectorAll('iframe');
      for (const frame of frames) {
        try {
          for (const sel of possibleSelectors) {
            input = frame.contentDocument?.querySelector(sel);
            if (input) break;
          }
          if (input) break;
        } catch { /* cross-origin */ }
      }
    }

    if (!input) return false;

    // Fill the field
    fillField(input, value);

    // Highlight filled field
    input.style.backgroundColor = HIGHLIGHT_COLOR;
    input.style.transition = 'background-color 0.3s';

    return true;
  }

  async function fillT24Radio(name, value) {
    // T24 radio buttons: name="radio:tab1:MAND.CAP.INFO" value="SELF"
    const baseName = name.replace(/^radio:/, '');
    const lastPart = name.split(':').pop();

    const possibleSelectors = [
      `input[type="radio"][name="${name}"][value="${value}"]`,
      `input[type="radio"][name="${baseName}"][value="${value}"]`,
      `input[type="radio"][name*="${lastPart}"][value="${value}"]`,
    ];

    let radio = findElement(possibleSelectors);

    if (!radio) return false;

    // Click the radio button
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    radio.dispatchEvent(new Event('click', { bubbles: true }));
    radio.click();

    // Highlight parent label
    const label = radio.closest('label') || radio.parentElement;
    if (label) {
      label.style.backgroundColor = HIGHLIGHT_COLOR;
      label.style.transition = 'background-color 0.3s';
    }

    return true;
  }

  async function fillT24Select(name, value) {
    const baseName = name.replace(/^fieldName:/, '');
    const possibleSelectors = [
      `select[name="${name}"]`,
      `select[id="${name}"]`,
      `select[name="${baseName}"]`,
      `select[id="${baseName}"]`,
      `select[name*="${baseName}"]`,
    ];

    let select = findElement(possibleSelectors);

    if (!select) return false;

    // Find matching option (by value, text, or partial match)
    let matched = false;
    for (const option of select.options) {
      if (
        option.value === value ||
        option.text === value ||
        option.value.toUpperCase().includes(value.toUpperCase()) ||
        option.text.toUpperCase().includes(value.toUpperCase())
      ) {
        select.value = option.value;
        matched = true;
        break;
      }
    }

    if (!matched) return false;

    select.dispatchEvent(new Event('change', { bubbles: true }));

    // Highlight
    select.style.backgroundColor = HIGHLIGHT_COLOR;
    select.style.transition = 'background-color 0.3s';

    return true;
  }

  function findElement(selectorList) {
    // Search main document first
    for (const sel of selectorList) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // Search iframes
    const frames = document.querySelectorAll('iframe');
    for (const frame of frames) {
      try {
        for (const sel of selectorList) {
          const el = frame.contentDocument?.querySelector(sel);
          if (el) return el;
        }
      } catch { /* cross-origin */ }
    }
    return null;
  }

  function fillField(input, value) {
    // Set value using native setter to bypass React/Angular bindings
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    // Dispatch all relevant events for framework compatibility
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  }

  function validateAmount(expectedAmount, fieldMapping) {
    // Find the amount field and check its current value
    const amountFieldName = Object.entries(fieldMapping).find(
      ([, v]) => v === 'amount'
    )?.[0];

    if (!amountFieldName) return true;

    const amountEl = document.querySelector(`[name="${amountFieldName}"], [id="${amountFieldName}"]`);
    if (!amountEl || !amountEl.value) return true;

    const screenAmount = parseFloat(amountEl.value.replace(/[^0-9.]/g, ''));
    const slipAmount = parseFloat(expectedAmount);

    if (Math.abs(screenAmount - slipAmount) > 0.01) {
      showLoginNotification(
        `Amount mismatch! Slip: ${slipAmount.toFixed(2)}, Screen: ${screenAmount.toFixed(2)}`,
        'error'
      );
      return false;
    }
    return true;
  }

  // ── 4. Progress Panel ──

  function showProgressPanel(slip) {
    let panel = document.getElementById('dds-progress-panel');
    if (panel) panel.remove();

    panel = document.createElement('div');
    panel.id = 'dds-progress-panel';
    panel.innerHTML = `
      <div style="
        position:fixed;bottom:16px;right:16px;z-index:999999;
        width:320px;background:white;border-radius:12px;
        box-shadow:0 8px 30px rgba(0,0,0,0.2);overflow:hidden;
        font-family:system-ui,sans-serif;
      ">
        <div style="background:${BRAND_COLOR};color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;font-size:13px;">Auto-Filling Transact</span>
          <button id="dds-progress-close" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;">&times;</button>
        </div>
        <div style="padding:14px 16px;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">DRID: ${slip.drid}</div>
          <div id="dds-progress-status" style="font-size:13px;color:#111;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;border:2px solid #e5e7eb;border-top-color:${BRAND_COLOR};border-radius:50%;animation:dds-spin 0.6s linear infinite;display:inline-block;"></span>
            Preparing...
          </div>
        </div>
      </div>
      <style>@keyframes dds-spin { to { transform: rotate(360deg); } }</style>
    `;
    document.body.appendChild(panel);

    panel.querySelector('#dds-progress-close')?.addEventListener('click', () => panel.remove());

    // Auto-remove after 30s
    setTimeout(() => panel?.remove(), 30000);
  }

  function updateProgress(status, message) {
    const el = document.getElementById('dds-progress-status');
    if (!el) return;

    const icons = {
      navigating: `<span style="color:#3b82f6;">&#9654;</span>`,
      filling: `<span style="width:16px;height:16px;border:2px solid #e5e7eb;border-top-color:${BRAND_COLOR};border-radius:50%;animation:dds-spin 0.6s linear infinite;display:inline-block;"></span>`,
      complete: `<span style="color:#16a34a;font-size:16px;">&#10003;</span>`,
      partial: `<span style="color:#f59e0b;font-size:16px;">&#9888;</span>`,
      error: `<span style="color:#dc2626;font-size:16px;">&#10007;</span>`,
    };

    el.innerHTML = `${icons[status] || ''} ${escapeHtml(message)}`;
  }

  // ── 5. Manual Fill Guide ──

  function showManualGuide(slip, failedFields = []) {
    let guide = document.getElementById('dds-manual-guide');
    if (guide) guide.remove();

    const fields = Object.entries(slip).filter(
      ([key]) => !['id', 'created_at', 'updated_at', 'qr_code_data', 'additional_data'].includes(key)
    );

    guide = document.createElement('div');
    guide.id = 'dds-manual-guide';
    guide.innerHTML = `
      <div style="
        position:fixed;top:16px;right:16px;z-index:999998;
        width:340px;max-height:80vh;overflow-y:auto;
        background:white;border-radius:12px;
        box-shadow:0 8px 30px rgba(0,0,0,0.2);
        font-family:system-ui,sans-serif;
      ">
        <div style="background:#f59e0b;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;font-size:13px;">Manual Fill Guide</span>
          <button id="dds-guide-close" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;">&times;</button>
        </div>
        <div style="padding:12px 16px;">
          ${failedFields.length > 0 ? `
            <div style="font-size:12px;color:#dc2626;margin-bottom:10px;padding:8px;background:#fef2f2;border-radius:6px;">
              Failed fields: ${failedFields.join(', ')}
            </div>
          ` : ''}
          ${fields.map(([key, value]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f3f4f6;">
              <div>
                <div style="font-size:11px;color:#6b7280;">${key.replace(/_/g, ' ')}</div>
                <div style="font-size:13px;font-weight:500;color:#111;">${escapeHtml(String(value))}</div>
              </div>
              <button class="dds-copy-btn" data-value="${escapeHtml(String(value))}" style="
                padding:4px 10px;border:1px solid #d1d5db;border-radius:6px;
                background:white;cursor:pointer;font-size:11px;color:#374151;
              ">Copy</button>
            </div>
          `).join('')}
          ${slip.additional_data ? `
            <div style="margin-top:8px;font-size:11px;color:#6b7280;">Additional Data:</div>
            ${Object.entries(slip.additional_data).map(([key, value]) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f3f4f6;">
                <div>
                  <div style="font-size:11px;color:#6b7280;">${key.replace(/_/g, ' ')}</div>
                  <div style="font-size:13px;font-weight:500;color:#111;">${escapeHtml(String(value))}</div>
                </div>
                <button class="dds-copy-btn" data-value="${escapeHtml(String(value))}" style="
                  padding:4px 10px;border:1px solid #d1d5db;border-radius:6px;
                  background:white;cursor:pointer;font-size:11px;color:#374151;
                ">Copy</button>
              </div>
            `).join('')}
          ` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(guide);

    guide.querySelector('#dds-guide-close')?.addEventListener('click', () => guide.remove());

    // Copy buttons
    guide.querySelectorAll('.dds-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.value).then(() => {
          btn.textContent = 'Copied!';
          btn.style.background = '#d1fae5';
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.style.background = 'white';
          }, 1500);
        });
      });
    });
  }

  // ── Utility ──

  function notifyReady() {
    // Wait for page to fully load, then declare ready
    const checkReady = () => {
      const loginEl = document.querySelector(selectors.loginPage);
      const usernameEl = document.querySelector(selectors.loginUsername);
      if (!loginEl && !usernameEl) {
        isReady = true;
        chrome.runtime.sendMessage({ type: 'TRANSACT_READY' });
      }
    };

    if (document.readyState === 'complete') {
      setTimeout(checkReady, 1000);
    } else {
      window.addEventListener('load', () => setTimeout(checkReady, 1000));
    }
  }

  async function importCrypto() {
    // In content scripts, we can't use ES modules, so we inline the crypto functions
    return {
      decrypt: async function (encryptedBase64, pin) {
        const PBKDF2_ITERATIONS = 100000;
        const SALT_LENGTH = 16;
        const IV_LENGTH = 12;

        const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
        const salt = combined.slice(0, SALT_LENGTH);
        const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
      },
    };
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
