/**
 * Options page — 4-tab configuration
 * Tab 1: URLs & Endpoints
 * Tab 2: Transact Credentials (encrypted with PIN)
 * Tab 3: Field Mappings (accordion per slip type, JSON import/export)
 * Tab 4: Appearance (brand color, widget position, toggles)
 */

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadAllSettings();
  setupEventHandlers();
});

// ── Tab Switching ──

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.querySelector(`[data-pane="${btn.dataset.tab}"]`).classList.add('active');
    });
  });
}

// ── Load Settings ──

async function loadAllSettings() {
  const settings = await chrome.storage.local.get([
    'digitalSlipsUrl', 'transactUrl', 'apiBaseUrl', 'installUrl',
    'autoOpenTransact', 'showBadge', 'enableHotkey',
    'brandColor', 'widgetPosition', 't24Version',
    'fieldMappings', 'transactSelectors', 'encryptedTransactCreds',
  ]);

  // Tab 1: URLs
  document.getElementById('digitalSlipsUrl').value = settings.digitalSlipsUrl || 'http://localhost:3080';
  document.getElementById('apiBaseUrl').value = settings.apiBaseUrl || 'http://localhost:8001';
  document.getElementById('transactUrl').value = settings.transactUrl || 'https://transact.meezanbank.com';
  document.getElementById('installUrl').value = settings.installUrl || '';

  // Tab 2: Selectors
  if (settings.transactSelectors) {
    document.getElementById('sel-username').value = settings.transactSelectors.loginUsername || '';
    document.getElementById('sel-password').value = settings.transactSelectors.loginPassword || '';
    document.getElementById('sel-submit').value = settings.transactSelectors.loginSubmit || '';
    document.getElementById('sel-command').value = settings.transactSelectors.commandLine || '';
  }

  // Show credential status
  if (settings.encryptedTransactCreds) {
    showStatus('creds-status', 'Encrypted credentials stored. Enter new values to update.', 'info');
  }

  // Tab 3: Mappings
  document.getElementById('t24-version').value = settings.t24Version || 'R22';
  renderFieldMappings(settings.fieldMappings || getDefaultFieldMappings());

  // Tab 4: Appearance
  const color = settings.brandColor || '#006241';
  document.getElementById('brand-color').value = color;
  document.getElementById('brand-color-hex').value = color;
  document.getElementById('auto-open-transact').checked = settings.autoOpenTransact !== false;
  document.getElementById('show-badge').checked = settings.showBadge !== false;
  document.getElementById('enable-hotkey').checked = settings.enableHotkey !== false;
  document.getElementById('widget-right').value = settings.widgetPosition?.right ?? 20;
  document.getElementById('widget-bottom').value = settings.widgetPosition?.bottom ?? 20;
}

// ── Event Handlers ──

function setupEventHandlers() {
  // Tab 1: URLs
  document.getElementById('save-urls').addEventListener('click', saveUrls);
  document.getElementById('reset-urls').addEventListener('click', resetUrls);

  // Tab 2: Credentials
  document.getElementById('save-creds').addEventListener('click', saveCredentials);
  document.getElementById('test-login').addEventListener('click', testLogin);
  document.getElementById('clear-creds').addEventListener('click', clearCredentials);
  document.getElementById('save-selectors').addEventListener('click', saveSelectors);

  // Tab 3: Mappings
  document.getElementById('save-mappings').addEventListener('click', saveMappings);
  document.getElementById('export-mappings').addEventListener('click', exportMappings);
  document.getElementById('import-mappings').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importMappings);

  // Tab 4: Appearance
  document.getElementById('save-appearance').addEventListener('click', saveAppearance);
  document.getElementById('brand-color').addEventListener('input', (e) => {
    document.getElementById('brand-color-hex').value = e.target.value;
  });
  document.getElementById('brand-color-hex').addEventListener('input', (e) => {
    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
      document.getElementById('brand-color').value = e.target.value;
    }
  });
}

// ── Tab 1: URLs ──

async function saveUrls() {
  const config = {
    digitalSlipsUrl: document.getElementById('digitalSlipsUrl').value.replace(/\/$/, ''),
    apiBaseUrl: document.getElementById('apiBaseUrl').value.replace(/\/$/, ''),
    transactUrl: document.getElementById('transactUrl').value.replace(/\/$/, ''),
    installUrl: document.getElementById('installUrl').value,
  };
  await chrome.storage.local.set(config);

  // Update content script matches (requires extension reload)
  showStatus('urls-status', 'URLs saved. Reload the extension if URLs changed significantly.', 'success');
}

function resetUrls() {
  document.getElementById('digitalSlipsUrl').value = 'http://localhost:3080';
  document.getElementById('apiBaseUrl').value = 'http://localhost:8001';
  document.getElementById('transactUrl').value = 'https://transact.meezanbank.com';
  document.getElementById('installUrl').value = '';
  showStatus('urls-status', 'Reset to defaults. Click Save to apply.', 'info');
}

// ── Tab 2: Credentials ──

async function saveCredentials() {
  const username = document.getElementById('transact-username').value.trim();
  const password = document.getElementById('transact-password').value;
  const pin = document.getElementById('encryption-pin').value;

  if (!username || !password) {
    showStatus('creds-status', 'Username and password are required.', 'error');
    return;
  }
  if (!pin || pin.length < 4) {
    showStatus('creds-status', 'PIN must be at least 4 characters.', 'error');
    return;
  }

  try {
    const plaintext = JSON.stringify({ username, password });
    const encrypted = await encrypt(plaintext, pin);
    await chrome.storage.local.set({ encryptedTransactCreds: encrypted });
    // Store PIN in session for immediate use
    await chrome.storage.session.set({ sessionPin: pin });

    // Clear form
    document.getElementById('transact-username').value = '';
    document.getElementById('transact-password').value = '';
    document.getElementById('encryption-pin').value = '';

    showStatus('creds-status', 'Credentials encrypted and saved successfully.', 'success');
  } catch (err) {
    showStatus('creds-status', 'Encryption failed: ' + err.message, 'error');
  }
}

async function testLogin() {
  const { transactUrl } = await chrome.storage.local.get('transactUrl');
  const url = transactUrl || 'https://transact.meezanbank.com';

  showStatus('creds-status', 'Opening Transact for login test...', 'info');

  try {
    await chrome.runtime.sendMessage({ type: 'OPEN_TRANSACT' });
    showStatus('creds-status', 'Transact tab opened. Auto-login will be attempted.', 'success');
  } catch (err) {
    showStatus('creds-status', 'Failed to open Transact: ' + err.message, 'error');
  }
}

async function clearCredentials() {
  if (!confirm('Are you sure you want to delete your stored credentials?')) return;
  await chrome.storage.local.remove('encryptedTransactCreds');
  await chrome.storage.session.remove('sessionPin');
  showStatus('creds-status', 'Credentials cleared.', 'info');
}

async function saveSelectors() {
  const transactSelectors = {};
  const fields = {
    loginUsername: 'sel-username',
    loginPassword: 'sel-password',
    loginSubmit: 'sel-submit',
    commandLine: 'sel-command',
  };

  for (const [key, id] of Object.entries(fields)) {
    const val = document.getElementById(id).value.trim();
    if (val) transactSelectors[key] = val;
  }

  await chrome.storage.local.set({ transactSelectors });
  showStatus('selectors-status', 'Custom selectors saved.', 'success');
}

// ── Tab 3: Field Mappings ──

function renderFieldMappings(mappings) {
  const container = document.getElementById('mappings-accordions');
  container.innerHTML = '';

  const typeLabels = {
    CASH_DEPOSIT: 'Cash Deposit',
    CHEQUE_DEPOSIT: 'Cheque Deposit',
    PAY_ORDER: 'Pay Order',
    BILL_PAYMENT: 'Bill Payment',
    FUND_TRANSFER: 'Fund Transfer',
  };

  for (const [type, config] of Object.entries(mappings)) {
    const accordion = document.createElement('div');
    accordion.className = 'accordion';
    accordion.innerHTML = `
      <button class="accordion-header">
        <span>${typeLabels[type] || type}</span>
        <span class="accordion-arrow">&#9654;</span>
      </button>
      <div class="accordion-body">
        <div class="form-group">
          <label class="label">T24 Screen Name</label>
          <input type="text" class="input input-sm" data-type="${type}" data-field="screen" value="${config.screen || ''}"/>
        </div>
        <div class="form-group">
          <label class="label">Field Mappings (JSON: T24 field → Slip field)</label>
          <textarea class="input" data-type="${type}" data-field="fields" rows="6">${JSON.stringify(config.fields || {}, null, 2)}</textarea>
        </div>
      </div>
    `;

    accordion.querySelector('.accordion-header').addEventListener('click', () => {
      accordion.classList.toggle('open');
    });

    container.appendChild(accordion);
  }
}

async function saveMappings() {
  const mappings = {};
  const containers = document.querySelectorAll('#mappings-accordions .accordion');

  for (const accordion of containers) {
    const screenInput = accordion.querySelector('[data-field="screen"]');
    const fieldsInput = accordion.querySelector('[data-field="fields"]');
    const type = screenInput.dataset.type;

    try {
      mappings[type] = {
        screen: screenInput.value,
        fields: JSON.parse(fieldsInput.value),
      };
    } catch {
      showStatus('mappings-status', `Invalid JSON in ${type} field mappings.`, 'error');
      return;
    }
  }

  const t24Version = document.getElementById('t24-version').value;
  await chrome.storage.local.set({ fieldMappings: mappings, t24Version });
  showStatus('mappings-status', 'Field mappings saved.', 'success');
}

async function exportMappings() {
  const { fieldMappings, t24Version } = await chrome.storage.local.get(['fieldMappings', 't24Version']);
  const data = JSON.stringify({ version: t24Version, mappings: fieldMappings }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dds-field-mappings-${t24Version || 'custom'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importMappings(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const mappings = data.mappings || data;

    if (typeof mappings !== 'object') throw new Error('Invalid format');

    renderFieldMappings(mappings);
    if (data.version) {
      document.getElementById('t24-version').value = data.version;
    }
    showStatus('mappings-status', 'Mappings imported. Click Save to apply.', 'info');
  } catch (err) {
    showStatus('mappings-status', 'Import failed: ' + err.message, 'error');
  }

  event.target.value = ''; // Reset file input
}

// ── Tab 4: Appearance ──

async function saveAppearance() {
  const config = {
    brandColor: document.getElementById('brand-color').value,
    autoOpenTransact: document.getElementById('auto-open-transact').checked,
    showBadge: document.getElementById('show-badge').checked,
    enableHotkey: document.getElementById('enable-hotkey').checked,
    widgetPosition: {
      right: parseInt(document.getElementById('widget-right').value) || 20,
      bottom: parseInt(document.getElementById('widget-bottom').value) || 20,
    },
  };
  await chrome.storage.local.set(config);
  showStatus('appearance-status', 'Appearance settings saved.', 'success');
}

// ── Crypto (inline for options page) ──

async function encrypt(plaintext, pin) {
  const PBKDF2_ITERATIONS = 100000;
  const SALT_LENGTH = 16;
  const IV_LENGTH = 12;

  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));

  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

// ── Utilities ──

function showStatus(elementId, message, type) {
  const el = document.getElementById(elementId);
  el.className = `status-msg status-${type}`;
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function getDefaultFieldMappings() {
  return {
    CASH_DEPOSIT: {
      screen: 'TELLER,CASH.IN',
      fields: { 'DEBIT.ACCT.NO': 'customer_account', 'DEBIT.CURRENCY': 'currency', 'DEBIT.AMOUNT': 'amount', 'ORDERING.CUST': 'depositor_name', 'NARRATIVE': 'narration' },
    },
    CHEQUE_DEPOSIT: {
      screen: 'TELLER,CHEQUE.DEPOSIT',
      fields: { 'CREDIT.ACCT.NO': 'customer_account', 'CREDIT.CURRENCY': 'currency', 'CREDIT.AMOUNT': 'amount', 'CHEQUE.NO': 'additional_data.cheque_number', 'CHEQUE.DATE': 'additional_data.cheque_date', 'DRAWER.BANK': 'additional_data.cheque_bank', 'NARRATIVE': 'narration' },
    },
    PAY_ORDER: {
      screen: 'TELLER,PAY.ORDER',
      fields: { 'CREDIT.ACCT.NO': 'customer_account', 'CREDIT.AMOUNT': 'amount', 'CREDIT.CURRENCY': 'currency', 'BENEFICIARY': 'additional_data.beneficiary_name', 'NARRATIVE': 'narration' },
    },
    BILL_PAYMENT: {
      screen: 'TELLER,BILL.PAY',
      fields: { 'DEBIT.ACCT.NO': 'customer_account', 'DEBIT.AMOUNT': 'amount', 'DEBIT.CURRENCY': 'currency', 'BILL.REF': 'additional_data.bill_reference', 'NARRATIVE': 'narration' },
    },
    FUND_TRANSFER: {
      screen: 'FUNDS.TRANSFER,FT',
      fields: { 'DEBIT.ACCT.NO': 'customer_account', 'DEBIT.AMOUNT': 'amount', 'DEBIT.CURRENCY': 'currency', 'CREDIT.ACCT.NO': 'additional_data.beneficiary_account', 'NARRATIVE': 'narration' },
    },
  };
}
