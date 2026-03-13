/**
 * Background service worker — Central message router
 * Handles: presence checks, login detection, Transact tab management,
 * slip retrieval relay, fill forwarding, multi-slip queue, audit logging
 */

import { apiFetch, retrieveSlip, verifySlip, completeSlip, getAuthToken, setAuthToken, clearAuthToken, getConfig } from './utils/api.js';

// ── State (rebuilt from chrome.storage.session on restart) ──

let transactTabId = null;
let slipQueue = [];
let currentSlip = null;
let isLoggedIn = false;

// ── Initialize state from storage ──

async function initState() {
  const session = await chrome.storage.session.get([
    'transactTabId', 'slipQueue', 'currentSlip', 'accessToken',
  ]);
  transactTabId = session.transactTabId || null;
  slipQueue = session.slipQueue || [];
  currentSlip = session.currentSlip || null;
  isLoggedIn = !!session.accessToken;

  // Verify transact tab still exists
  if (transactTabId) {
    try {
      await chrome.tabs.get(transactTabId);
    } catch {
      transactTabId = null;
      await chrome.storage.session.remove('transactTabId');
    }
  }
}

initState();

// Force disable autoOpenTransact (overrides stale stored value)
chrome.storage.local.set({ autoOpenTransact: false });

// ── Audit Log ──

async function addAuditEntry(action, details = {}) {
  const { auditLog = [] } = await chrome.storage.local.get('auditLog');
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    action,
    ...details,
  };
  auditLog.unshift(entry);
  // Cap at 1000 entries
  if (auditLog.length > 1000) auditLog.length = 1000;
  await chrome.storage.local.set({ auditLog });
  return entry;
}

// ── Recent Lookups ──

async function addRecentLookup(slip) {
  const { recentLookups = [] } = await chrome.storage.local.get('recentLookups');
  // Remove duplicate
  const filtered = recentLookups.filter(s => s.drid !== slip.drid);
  filtered.unshift({
    drid: slip.drid,
    transaction_type: slip.transaction_type,
    amount: slip.amount,
    currency: slip.currency,
    customer_name: slip.customer_name,
    status: slip.status,
    timestamp: new Date().toISOString(),
  });
  if (filtered.length > 10) filtered.length = 10;
  await chrome.storage.local.set({ recentLookups: filtered });
}

// ── Transact Tab Management ──

async function openTransactTab() {
  const { transactUrl } = await chrome.storage.local.get('transactUrl');
  const url = transactUrl || 'https://transact.meezanbank.com';

  // Check if stored tab still exists
  if (transactTabId) {
    try {
      const tab = await chrome.tabs.get(transactTabId);
      await chrome.tabs.update(transactTabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      return tab;
    } catch {
      transactTabId = null;
    }
  }

  // Search ALL windows for an existing Transact tab
  try {
    const allTabs = await chrome.tabs.query({ url: url + '/*' });
    if (allTabs.length > 0) {
      const tab = allTabs[0];
      transactTabId = tab.id;
      await chrome.storage.session.set({ transactTabId });
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      await addAuditEntry('TRANSACT_TAB_FOUND', { tabId: tab.id, windowId: tab.windowId });
      return tab;
    }

    // Broader search by meezanbank.com domain
    const meezanTabs = await chrome.tabs.query({ url: '*://*.meezanbank.com/*' });
    if (meezanTabs.length > 0) {
      const tab = meezanTabs[0];
      transactTabId = tab.id;
      await chrome.storage.session.set({ transactTabId });
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      await addAuditEntry('TRANSACT_TAB_FOUND', { tabId: tab.id, windowId: tab.windowId });
      return tab;
    }
  } catch { /* query failed — open new tab */ }

  // No existing tab found — open login page
  const tab = await chrome.tabs.create({ url, active: true });
  transactTabId = tab.id;
  await chrome.storage.session.set({ transactTabId });
  await addAuditEntry('TRANSACT_TAB_OPENED', { tabId: tab.id });
  return tab;
}

// ── Slip Queue Management ──

async function queueSlip(slip) {
  // Avoid duplicates
  if (!slipQueue.find(s => s.drid === slip.drid)) {
    slipQueue.push(slip);
    await chrome.storage.session.set({ slipQueue });
    await addAuditEntry('SLIP_QUEUED', { drid: slip.drid });
  }
  return slipQueue;
}

async function processNextSlip() {
  if (slipQueue.length === 0) return null;
  currentSlip = slipQueue.shift();
  await chrome.storage.session.set({ slipQueue, currentSlip });
  await addAuditEntry('SLIP_PROCESSING', { drid: currentSlip.drid });

  // Forward to Transact tab
  if (transactTabId) {
    try {
      await chrome.tabs.sendMessage(transactTabId, {
        type: 'FILL_TRANSACT',
        slip: currentSlip,
      });
    } catch {
      // Tab may not be ready yet
      await addAuditEntry('FILL_FORWARD_FAILED', { drid: currentSlip.drid });
    }
  }
  return currentSlip;
}

async function removeFromQueue(drid) {
  slipQueue = slipQueue.filter(s => s.drid !== drid);
  await chrome.storage.session.set({ slipQueue });
}

// ── Auto-Forward to Transact ──

async function autoForwardToTransact(slip) {
  try {
    const tab = await openTransactTab();
    await addAuditEntry('T24_AUTO_FORWARD', { drid: slip.drid, tabId: tab.id });

    // Wait for tab to load, then send fill message
    // Use a retry mechanism since the content script may not be ready immediately
    let retries = 0;
    const maxRetries = 10;
    const sendFill = async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'FILL_TRANSACT',
          slip,
        });
        await addAuditEntry('FILL_FORWARDED', { drid: slip.drid });
      } catch {
        retries++;
        if (retries < maxRetries) {
          setTimeout(sendFill, 1500);
        } else {
          await addAuditEntry('FILL_FORWARD_FAILED', { drid: slip.drid, reason: 'max retries' });
        }
      }
    };

    // Give the tab a moment to load content script
    setTimeout(sendFill, 2000);
  } catch (err) {
    await addAuditEntry('T24_AUTO_FORWARD_FAILED', { drid: slip.drid, error: err.message });
  }
}

// ── Message Router ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    sendResponse({ error: err.message || 'Unknown error' });
  });
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  const { type } = message;

  switch (type) {
    // ── Presence ──
    case 'EXTENSION_PRESENCE_CHECK':
      return { active: true, version: chrome.runtime.getManifest().version };

    // ── Auth ──
    case 'DIGITAL_SLIPS_LOGIN_SUCCESS': {
      const { accessToken, refreshToken, user } = message;
      await setAuthToken(accessToken, refreshToken);
      if (user) await chrome.storage.session.set({ userInfo: user });
      isLoggedIn = true;
      await addAuditEntry('LOGIN_DETECTED', {
        username: user?.username,
        branch: user?.branch_name,
      });
      // Auto-open Transact tab on login (disabled by default — use "Open Transact" button manually)
      const { autoOpenTransact = false } = await chrome.storage.local.get('autoOpenTransact');
      if (autoOpenTransact) {
        await openTransactTab();
      }
      return { success: true };
    }

    case 'DIGITAL_SLIPS_LOGOUT': {
      await clearAuthToken();
      isLoggedIn = false;
      currentSlip = null;
      slipQueue = [];
      await chrome.storage.session.remove(['currentSlip', 'slipQueue', 'userInfo']);
      await addAuditEntry('LOGOUT');
      return { success: true };
    }

    // ── Slip Operations ──
    case 'RETRIEVE_SLIP': {
      const { drid } = message;
      try {
        const result = await retrieveSlip(drid);
        const slip = result.deposit_slip || result;
        await addRecentLookup(slip);
        await addAuditEntry('SLIP_RETRIEVED', {
          drid,
          type: slip.transaction_type,
          amount: slip.amount,
        });

        // Cache for offline
        const { offlineCache = {} } = await chrome.storage.local.get('offlineCache');
        offlineCache[drid] = { slip, cachedAt: new Date().toISOString() };
        // Keep only last 20 cached
        const keys = Object.keys(offlineCache);
        if (keys.length > 20) {
          delete offlineCache[keys[0]];
        }
        await chrome.storage.local.set({ offlineCache });

        return { success: true, slip, validation: result.validation_result };
      } catch (err) {
        // Try offline cache
        const { offlineCache = {} } = await chrome.storage.local.get('offlineCache');
        if (offlineCache[drid]) {
          return {
            success: true,
            slip: offlineCache[drid].slip,
            cached: true,
            cachedAt: offlineCache[drid].cachedAt,
          };
        }
        throw err;
      }
    }

    case 'VERIFY_SLIP': {
      const { drid, data } = message;
      try {
        const result = await verifySlip(drid, data);
        await addAuditEntry('SLIP_VERIFIED', { drid });
        return { success: true, result };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'COMPLETE_SLIP': {
      const { drid, data, slip: completedSlip } = message;
      try {
        const result = await completeSlip(drid, data);
        await addAuditEntry('SLIP_COMPLETED', { drid });
        // Auto-forward to T24 Transact if slip data is provided
        if (completedSlip) {
          currentSlip = completedSlip;
          await chrome.storage.session.set({ currentSlip });
          await autoForwardToTransact(completedSlip);
        }
        return { success: true, result };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    case 'SLIP_SAVE_SUCCESS': {
      const { drid, slip } = message;
      await addAuditEntry('SLIP_SAVED', { drid });
      // Forward to Transact if ready
      if (slip && transactTabId) {
        await queueSlip(slip);
        await processNextSlip();
      }
      return { success: true };
    }

    // ── Queue ──
    case 'QUEUE_SLIP': {
      const queue = await queueSlip(message.slip);
      return { success: true, queueLength: queue.length };
    }

    case 'PROCESS_NEXT_SLIP': {
      const slip = await processNextSlip();
      return { success: true, slip, remaining: slipQueue.length };
    }

    case 'REMOVE_FROM_QUEUE': {
      await removeFromQueue(message.drid);
      return { success: true, queueLength: slipQueue.length };
    }

    case 'GET_QUEUE': {
      return { queue: slipQueue, current: currentSlip };
    }

    // ── Transact ──
    case 'FILL_TRANSACT': {
      if (!transactTabId) {
        await openTransactTab();
        // Wait for tab to be ready, then retry
        return { success: false, error: 'Transact tab opening, retry shortly' };
      }
      try {
        await chrome.tabs.sendMessage(transactTabId, {
          type: 'FILL_TRANSACT',
          slip: message.slip,
        });
        await addAuditEntry('FILL_FORWARDED', { drid: message.slip?.drid });
        return { success: true };
      } catch (err) {
        return { success: false, error: 'Transact tab not ready' };
      }
    }

    case 'TRANSACT_READY': {
      await addAuditEntry('TRANSACT_READY');
      // If there's a current slip waiting, send it
      if (currentSlip) {
        try {
          await chrome.tabs.sendMessage(transactTabId, {
            type: 'FILL_TRANSACT',
            slip: currentSlip,
          });
        } catch { /* ignore */ }
      }
      return { success: true };
    }

    case 'TRANSACT_FILL_COMPLETE': {
      const { drid, success: fillSuccess, errors } = message;
      await addAuditEntry('TRANSACT_FILL_COMPLETE', { drid, success: fillSuccess, errors });
      currentSlip = null;
      await chrome.storage.session.remove('currentSlip');
      // Auto-process next
      if (slipQueue.length > 0) {
        setTimeout(() => processNextSlip(), 1000);
      }
      return { success: true };
    }

    case 'TRANSACT_SESSION_EXPIRED': {
      await addAuditEntry('TRANSACT_SESSION_EXPIRED');
      // Notify popup
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', transactStatus: 'expired' }).catch(() => {});
      return { success: true };
    }

    case 'OPEN_TRANSACT': {
      const tab = await openTransactTab();
      return { success: true, tabId: tab.id };
    }

    // ── Status ──
    case 'GET_STATUS': {
      const { accessToken } = await getAuthToken();
      const { userInfo } = await chrome.storage.session.get('userInfo');
      return {
        isLoggedIn: !!accessToken,
        user: userInfo || null,
        transactTabId,
        transactConnected: !!transactTabId,
        queueLength: slipQueue.length,
        currentSlip,
      };
    }

    // ── Audit ──
    case 'GET_AUDIT_LOG': {
      const { auditLog = [] } = await chrome.storage.local.get('auditLog');
      const limit = message.limit || 50;
      return { log: auditLog.slice(0, limit) };
    }

    case 'CLEAR_AUDIT_LOG': {
      await chrome.storage.local.set({ auditLog: [] });
      return { success: true };
    }

    case 'EXPORT_AUDIT_CSV': {
      const { auditLog = [] } = await chrome.storage.local.get('auditLog');
      const headers = 'ID,Timestamp,Action,Details\n';
      const rows = auditLog.map(e =>
        `${e.id},${e.timestamp},${e.action},"${JSON.stringify(e).replace(/"/g, '""')}"`
      ).join('\n');
      return { csv: headers + rows };
    }

    // ── Recent ──
    case 'GET_RECENT_LOOKUPS': {
      const { recentLookups = [] } = await chrome.storage.local.get('recentLookups');
      return { lookups: recentLookups };
    }

    // ── Config ──
    case 'GET_CONFIG': {
      const config = await chrome.storage.local.get([
        'digitalSlipsUrl', 'transactUrl', 'apiBaseUrl',
        'autoOpenTransact', 'widgetPosition', 'brandColor',
        'fieldMappings', 't24Version',
      ]);
      return config;
    }

    case 'SAVE_CONFIG': {
      const { config } = message;
      await chrome.storage.local.set(config);
      await addAuditEntry('CONFIG_UPDATED', { keys: Object.keys(config) });
      return { success: true };
    }

    default:
      return { error: `Unknown message type: ${type}` };
  }
}

// ── Tab removal listener ──

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === transactTabId) {
    transactTabId = null;
    chrome.storage.session.remove('transactTabId');
    addAuditEntry('TRANSACT_TAB_CLOSED');
  }
});

// ── Extension icon badge ──

chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.accessToken) {
    const loggedIn = !!changes.accessToken.newValue;
    chrome.action.setBadgeText({ text: loggedIn ? 'ON' : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#006241' });
  }
});

// ── Extension Icon Click — Open DRID Modal in active tab ──

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  // Try sending message to content script on current tab
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_DRID_MODAL' });
  } catch {
    // Content script not on this tab — inject it and open modal
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content_scripts/digital_slips.js'],
      });
      // Give it a moment to initialize, then send the message
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_DRID_MODAL' });
        } catch { /* ignore */ }
      }, 300);
    } catch {
      // Can't inject (e.g. chrome:// pages) — ignore
    }
  }
});

// ── Install/Update ──

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set defaults
    await chrome.storage.local.set({
      digitalSlipsUrl: 'http://localhost:3080',
      transactUrl: 'https://transact.meezanbank.com',
      apiBaseUrl: 'http://localhost:8001',
      autoOpenTransact: false,
      brandColor: '#006241',
      widgetPosition: { right: 20, bottom: 20 },
      t24Version: 'R16',
      fieldMappings: getDefaultFieldMappings(),
      auditLog: [],
      recentLookups: [],
    });
    await addAuditEntry('EXTENSION_INSTALLED', { version: chrome.runtime.getManifest().version });
  }
});

function getDefaultFieldMappings() {
  return {
    CASH_DEPOSIT: {
      screen: 'TELLER,PK.LCY.CASHIN.MBL',
      initState: 'TELLER,PK.LCY.CASHIN.MBL I F3',
      // Text/number input fields — key is T24 HTML element name, value is slip property path
      fields: {
        'fieldName:ACCOUNT.2': 'customer_account',
        'fieldName:AMOUNT.LOCAL.1:1': 'amount',
        'fieldName:NARRATIVE.2:1': 'narration',
        'fieldName:ID.NUMBER:1': 'depositor_cnic',
        'fieldName:CP.ADD': 'depositor_name',
        'fieldName:QMC.TOKEN': 'drid',
      },
      // Radio button groups — key is T24 radio name, value defines how to select
      radios: {
        'radio:tab1:MAND.CAP.INFO': {
          slipField: 'depositor_relationship',
          mapping: {
            'SELF': 'SELF',
            'THIRD_PARTY': 'WALK.IN.CUSTOMER',
            '_default': 'MBL.AC.HOLDER',
          },
        },
        'radio:tab1:PURPOSE.TXN': {
          value: 'Personal',
        },
        'radio:tab1:REL.AC.HOLD': {
          slipField: 'depositor_relationship',
          mapping: {
            'SELF': 'Family/Friend',
            'THIRD_PARTY': 'Other',
            '_default': 'Family/Friend',
          },
        },
      },
      // Select dropdowns
      selects: {
        'fieldName:ID.TYPE:1': {
          value: 'CNIC',
        },
      },
    },
    CHEQUE_DEPOSIT: {
      screen: 'TELLER,PK.LCY.CASHIN.MBL',
      initState: 'TELLER,PK.LCY.CASHIN.MBL I F3',
      fields: {
        'fieldName:ACCOUNT.2': 'customer_account',
        'fieldName:AMOUNT.LOCAL.1:1': 'amount',
        'fieldName:NARRATIVE.2:1': 'narration',
        'fieldName:ID.NUMBER:1': 'depositor_cnic',
        'fieldName:CP.ADD': 'depositor_name',
        'fieldName:QMC.TOKEN': 'drid',
      },
      radios: {
        'radio:tab1:MAND.CAP.INFO': {
          slipField: 'depositor_relationship',
          mapping: {
            'SELF': 'SELF',
            'THIRD_PARTY': 'WALK.IN.CUSTOMER',
            '_default': 'MBL.AC.HOLDER',
          },
        },
        'radio:tab1:PURPOSE.TXN': { value: 'Personal' },
        'radio:tab1:REL.AC.HOLD': {
          slipField: 'depositor_relationship',
          mapping: {
            'SELF': 'Family/Friend',
            'THIRD_PARTY': 'Other',
            '_default': 'Family/Friend',
          },
        },
      },
      selects: {
        'fieldName:ID.TYPE:1': { value: 'CNIC' },
      },
    },
    PAY_ORDER: {
      screen: 'TELLER,PK.LCY.CASHIN.MBL',
      initState: 'TELLER,PK.LCY.CASHIN.MBL I F3',
      fields: {
        'fieldName:ACCOUNT.2': 'customer_account',
        'fieldName:AMOUNT.LOCAL.1:1': 'amount',
        'fieldName:NARRATIVE.2:1': 'narration',
        'fieldName:CP.ADD': 'additional_data.beneficiary_name',
        'fieldName:QMC.TOKEN': 'drid',
      },
      radios: {
        'radio:tab1:PURPOSE.TXN': { value: 'Personal' },
      },
      selects: {},
    },
    OWN_ACCOUNT_TRANSFER: {
      screen: 'TELLER,PK.LCY.CASHIN.MBL',
      initState: 'TELLER,PK.LCY.CASHIN.MBL I F3',
      fields: {
        'fieldName:ACCOUNT.2': 'customer_account',
        'fieldName:AMOUNT.LOCAL.1:1': 'amount',
        'fieldName:NARRATIVE.2:1': 'narration',
        'fieldName:QMC.TOKEN': 'drid',
      },
      radios: {
        'radio:tab1:MAND.CAP.INFO': { value: 'MBL.AC.HOLDER' },
        'radio:tab1:PURPOSE.TXN': { value: 'Personal' },
      },
      selects: {},
    },
    LOAN_INSTALMENT: {
      screen: 'TELLER,PK.LCY.CASHIN.MBL',
      initState: 'TELLER,PK.LCY.CASHIN.MBL I F3',
      fields: {
        'fieldName:ACCOUNT.2': 'customer_account',
        'fieldName:AMOUNT.LOCAL.1:1': 'amount',
        'fieldName:NARRATIVE.2:1': 'narration',
        'fieldName:QMC.TOKEN': 'drid',
      },
      radios: {
        'radio:tab1:MAND.CAP.INFO': { value: 'MBL.AC.HOLDER' },
        'radio:tab1:PURPOSE.TXN': { value: 'Personal' },
      },
      selects: {},
    },
    CHARITY_ZAKAT: {
      screen: 'TELLER,PK.LCY.CASHIN.MBL',
      initState: 'TELLER,PK.LCY.CASHIN.MBL I F3',
      fields: {
        'fieldName:ACCOUNT.2': 'customer_account',
        'fieldName:AMOUNT.LOCAL.1:1': 'amount',
        'fieldName:NARRATIVE.2:1': 'narration',
        'fieldName:QMC.TOKEN': 'drid',
      },
      radios: {
        'radio:tab1:PURPOSE.TXN': { value: 'Other' },
      },
      selects: {},
    },
  };
}
