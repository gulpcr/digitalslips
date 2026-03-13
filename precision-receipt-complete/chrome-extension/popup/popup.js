/**
 * Popup quick-access panel
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Version
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version-text').textContent = `v${manifest.version}`;

  // Load status
  await refreshStatus();

  // Settings link
  document.getElementById('settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // DRID Lookup
  const dridInput = document.getElementById('drid-input');
  const lookupBtn = document.getElementById('lookup-btn');

  lookupBtn.addEventListener('click', () => doLookup(dridInput.value.trim().toUpperCase()));
  dridInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookupBtn.click();
  });
  dridInput.addEventListener('input', () => {
    dridInput.value = dridInput.value.toUpperCase();
  });

  // Process next
  document.getElementById('process-next-btn').addEventListener('click', async () => {
    const result = await chrome.runtime.sendMessage({ type: 'PROCESS_NEXT_SLIP' });
    if (result.slip) {
      showNotification(`Processing: ${result.slip.drid}`);
    }
    await refreshStatus();
  });

  // Open Transact
  document.getElementById('open-transact-btn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'OPEN_TRANSACT' });
    showNotification('Transact tab opened');
  });

  // Export CSV
  document.getElementById('export-csv-btn').addEventListener('click', async () => {
    const result = await chrome.runtime.sendMessage({ type: 'EXPORT_AUDIT_CSV' });
    if (result.csv) {
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dds-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  // Listen for status updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATUS_UPDATE') refreshStatus();
  });
});

async function refreshStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    // Status dots
    document.getElementById('ds-status').className =
      `status-dot ${status.isLoggedIn ? 'connected' : 'disconnected'}`;
    document.getElementById('transact-status').className =
      `status-dot ${status.transactConnected ? 'connected' : 'disconnected'}`;

    // User info
    const userEl = document.getElementById('user-info');
    if (status.user) {
      userEl.classList.remove('hidden');
      userEl.textContent = `${status.user.full_name || status.user.username}${status.user.branch_name ? ' | ' + status.user.branch_name : ''}`;
    } else {
      userEl.classList.add('hidden');
    }

    // Queue
    document.getElementById('queue-count').textContent = status.queueLength;
    const processBtn = document.getElementById('process-next-btn');
    processBtn.classList.toggle('hidden', status.queueLength === 0);

    // Load queue
    const queueResult = await chrome.runtime.sendMessage({ type: 'GET_QUEUE' });
    renderQueue(queueResult.queue || [], queueResult.current);

    // Load audit log
    const auditResult = await chrome.runtime.sendMessage({ type: 'GET_AUDIT_LOG', limit: 10 });
    renderAuditLog(auditResult.log || []);
  } catch { /* popup may close before response */ }
}

async function doLookup(drid) {
  const resultEl = document.getElementById('lookup-result');
  const dridPattern = /^DRID-\d{8}-[A-Z0-9]{6}$/i;

  if (!dridPattern.test(drid)) {
    resultEl.innerHTML = '<div class="error-msg">Invalid DRID format</div>';
    return;
  }

  resultEl.innerHTML = '<div class="loading"><span class="spinner"></span></div>';

  try {
    const result = await chrome.runtime.sendMessage({ type: 'RETRIEVE_SLIP', drid });
    if (result.error) {
      resultEl.innerHTML = `<div class="error-msg">${result.error}</div>`;
      return;
    }

    const slip = result.slip;
    const amount = new Intl.NumberFormat('en-PK', {
      style: 'currency', currency: slip.currency || 'PKR',
    }).format(slip.amount);

    resultEl.innerHTML = `
      <div class="slip-mini-card">
        <div class="slip-mini-header">
          <span class="type-badge type-${slip.transaction_type}">${slip.transaction_type?.replace(/_/g, ' ')}</span>
          <span class="status-badge status-${slip.status}">${slip.status}</span>
          ${result.cached ? '<span class="cached-badge">Cached</span>' : ''}
        </div>
        <div class="slip-amount">${amount}</div>
        <div class="slip-detail">${slip.customer_name || 'N/A'} | ${slip.drid}</div>
        <div class="slip-actions">
          <button class="btn btn-primary btn-sm" id="popup-fill-btn">Fill Transact</button>
          <button class="btn btn-secondary btn-sm" id="popup-queue-btn">Queue</button>
        </div>
      </div>
    `;

    document.getElementById('popup-fill-btn')?.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'FILL_TRANSACT', slip });
      showNotification('Sent to Transact');
    });

    document.getElementById('popup-queue-btn')?.addEventListener('click', async () => {
      const r = await chrome.runtime.sendMessage({ type: 'QUEUE_SLIP', slip });
      showNotification(`Queued (${r.queueLength} total)`);
      await refreshStatus();
    });
  } catch (err) {
    resultEl.innerHTML = `<div class="error-msg">${err.message || 'Lookup failed'}</div>`;
  }
}

function renderQueue(queue, current) {
  const listEl = document.getElementById('queue-list');
  if (queue.length === 0 && !current) {
    listEl.innerHTML = '<div class="empty-state">No slips in queue</div>';
    return;
  }

  let html = '';
  if (current) {
    html += `<div class="queue-item processing">
      <span class="spinner-sm"></span>
      <span>${current.drid}</span>
      <span class="type-badge type-${current.transaction_type}" style="font-size:9px;">${current.transaction_type?.replace(/_/g, ' ')}</span>
    </div>`;
  }
  html += queue.map(s => `
    <div class="queue-item" data-drid="${s.drid}">
      <span>${s.drid}</span>
      <span class="type-badge type-${s.transaction_type}" style="font-size:9px;">${formatAmount(s.amount)}</span>
      <button class="btn-remove" data-drid="${s.drid}" title="Remove">&times;</button>
    </div>
  `).join('');

  listEl.innerHTML = html;

  // Remove buttons
  listEl.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({ type: 'REMOVE_FROM_QUEUE', drid: btn.dataset.drid });
      await refreshStatus();
    });
  });
}

function renderAuditLog(log) {
  const listEl = document.getElementById('audit-list');
  if (log.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No activity yet</div>';
    return;
  }

  listEl.innerHTML = log.map(entry => `
    <div class="audit-item">
      <span class="audit-action">${entry.action}</span>
      <span class="audit-time">${formatTime(entry.timestamp)}</span>
    </div>
  `).join('');
}

function showNotification(msg) {
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function formatAmount(amount, currency = 'PKR') {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency', currency, minimumFractionDigits: 0,
  }).format(amount);
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}
