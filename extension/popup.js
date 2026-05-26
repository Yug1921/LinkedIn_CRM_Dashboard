// GoTeeOff Lead Capture — popup.js v2.0 (production-stable)
// ──────────────────────────────────────────────────────────────
// ROOT CAUSE FIXES:
//  1. Activity log was maintained ONLY in popup memory — wiped on close.
//     Fixed: read/write activity_log from chrome.storage (background now owns it).
//  2. dup_count was maintained only in popup memory. Fixed: background owns it.
//  3. setInterval for time refresh reads chrome.storage every 30 s in a loop —
//     wasteful and O(N) storage reads. Fixed: derive times from in-memory copy.
//  4. CAPTURE_FAILED and QUEUED_OFFLINE message types were not handled — silent.
//  5. feed-item dot colours for 'failed' and 'offline' types were missing.

const $ = id => document.getElementById(id);

let sessionNew = 0, sessionDup = 0;
let _activityLog = []; // in-memory mirror of storage

const MAX_FEED = 100;

const STATUS_CFG = {
  success:      { cls: 'success',   dot: false, label: '✓ Captured' },
  duplicate:    { cls: 'duplicate', dot: false, label: '↩ Duplicate' },
  offline:      { cls: 'offline',   dot: true,  label: 'Queued offline' },
  rate_limited: { cls: 'error',     dot: false, label: 'Daily limit hit' },
  failed:       { cls: 'error',     dot: false, label: '✗ Failed to capture' },
  idle:         { cls: 'idle',      dot: false, label: 'Waiting…' },
  disabled:     { cls: 'idle',      dot: false, label: 'Extension OFF' },
};

function setStatus(status, name = '') {
  const cfg = STATUS_CFG[status] || STATUS_CFG.idle;
  const pill = $('status-pill');
  pill.className = `pill ${cfg.cls}`;
  $('status-dot').className = cfg.dot ? 'dot pulse' : 'dot';
  $('status-txt').textContent = name ? `${cfg.label}: ${truncate(name, 22)}` : cfg.label;
}

function setCount(n, dupCount = null, oqSize = null) {
  $('count').textContent = n;
  const pct = Math.min(Math.round((n / 80) * 100), 100);
  $('prog-pct').textContent = pct + '%';
  const fill = $('prog-fill');
  fill.style.width = pct + '%';
  fill.className = pct >= 90 ? 'prog-fill danger' : pct >= 70 ? 'prog-fill warn' : 'prog-fill';
  if (dupCount !== null) $('dup-count').textContent = dupCount;
  if (oqSize !== null) $('oq-count').textContent = oqSize;
}

function syncToggle(on) {
  $('tlabel').textContent = on ? 'ON' : 'OFF';
  $('tlabel').className = on ? 'tlabel on' : 'tlabel';
  if (!on) setStatus('disabled');
}

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : s; }

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ── Feed rendering ───────────────────────────────────────────
function buildFeedItem(item) {
  const el = document.createElement('div');
  el.className = 'feed-item';
  const dotType = item.type || item.status || 'success';
  el.innerHTML = `
    <div class="fi-dot ${dotType}"></div>
    <div class="fi-body">
      <div class="fi-name">${escHtml(item.name || 'LinkedIn Member')}</div>
      <div class="fi-meta">${escHtml(item.headline || item.note || item.category || '')}</div>
    </div>
    <div class="fi-time" data-ts="${item.ts}">${timeAgo(item.ts)}</div>
  `;
  return el;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function prependFeedItem(item) {
  $('feed-empty').style.display = 'none';
  const el = buildFeedItem(item);
  const firstChild = $('feed').firstChild;
  if (firstChild) $('feed').insertBefore(el, firstChild);
  else $('feed').appendChild(el);
  // Trim DOM
  const items = $('feed').querySelectorAll('.feed-item');
  if (items.length > MAX_FEED) items[items.length - 1].remove();
}

function renderFeed(log) {
  $('feed').querySelectorAll('.feed-item').forEach(e => e.remove());
  if (!log.length) { $('feed-empty').style.display = 'block'; return; }
  $('feed-empty').style.display = 'none';
  log.forEach(item => {
    const el = buildFeedItem(item);
    $('feed').appendChild(el);
  });
}

// Refresh relative times every 30 s without storage reads
setInterval(() => {
  $('feed').querySelectorAll('.fi-time[data-ts]').forEach(el => {
    el.textContent = timeAgo(parseInt(el.dataset.ts, 10));
  });
}, 30000);

function updateFeedBadge(n) {
  $('feed-badge').textContent = n > 99 ? '99+' : n;
}

// ── Load all state on popup open ────────────────────────────
function load() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, stats => {
    if (chrome.runtime.lastError || !stats) return;
    $('tog').checked = stats.enabled;
    syncToggle(stats.enabled);
    setCount(stats.daily_scrape_count, stats.dup_count || 0, stats.offline_queue_size);
    $('cat').value = stats.selected_category || 'crypto_influencer';
    $('api').value = stats.api_base || 'https://linkedin-crm-dashboard.onrender.com';
    setStatus(stats.last_capture_status || 'idle', stats.last_capture_name);
    if (stats.offline_queue_size > 0) {
      $('oq-badge').textContent = `▲ ${stats.offline_queue_size} queued`;
      $('oq-badge').classList.add('show');
    } else {
      $('oq-badge').classList.remove('show');
    }
    // Render activity from background's persistent storage
    _activityLog = stats.activity_log || [];
    renderFeed(_activityLog);
    updateFeedBadge(_activityLog.length);
    $('dup-count').textContent = stats.dup_count || 0;
  });
}

// ── Tabs ────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'feed') updateFeedBadge(_activityLog.length);
  });
});

// ── Toggle ──────────────────────────────────────────────────
$('tog').addEventListener('change', e => {
  const on = e.target.checked;
  chrome.storage.local.set({ enabled: on });
  syncToggle(on);
});

// ── Category ────────────────────────────────────────────────
$('cat').addEventListener('change', e => chrome.storage.local.set({ selected_category: e.target.value }));

// ── Save API ────────────────────────────────────────────────
$('save').addEventListener('click', () => {
  const v = $('api').value.trim().replace(/\/$/, '');
  if (!v) return;
  chrome.storage.local.set({ api_base: v });
  $('save').textContent = '✓';
  setTimeout(() => ($('save').textContent = 'Save'), 1400);
});

// ── Test connection ─────────────────────────────────────────
$('test').addEventListener('click', () => {
  const base = $('api').value.trim().replace(/\/$/, '');
  $('test').textContent = 'Testing…'; $('test').className = 'btn btn-test';
  chrome.runtime.sendMessage({ type: 'TEST_CONNECTION', apiBase: base }, res => {
    if (res && res.ok) { $('test').textContent = '✓ Connected'; $('test').classList.add('ok'); }
    else               { $('test').textContent = '✗ Not reachable'; $('test').classList.add('fail'); }
    setTimeout(() => { $('test').textContent = 'Test connection'; $('test').className = 'btn btn-test'; }, 2500);
  });
});

// ── Clear feed ──────────────────────────────────────────────
$('clear-feed').addEventListener('click', () => {
  chrome.storage.local.set({ activity_log: [] });
  _activityLog = [];
  $('feed').querySelectorAll('.feed-item').forEach(e => e.remove());
  $('feed-empty').style.display = 'block';
  updateFeedBadge(0);
});

// ── Live updates from background ───────────────────────────
chrome.runtime.onMessage.addListener(msg => {

  if (msg.type === 'CAPTURED') {
    const isDup = msg.status === 'duplicate';
    if (!isDup) { sessionNew++; $('session-count').textContent = sessionNew; }
    else { sessionDup++; }

    setCount(msg.count, msg.dup_count !== undefined ? msg.dup_count : null);
    setStatus(msg.status || 'success', msg.name);

    // Background already wrote to activity_log — we just mirror it locally for the DOM
    const item = {
      type:     msg.status || 'success',
      name:     msg.name || 'LinkedIn Member',
      headline: msg.headline || '',
      category: msg.category || '',
      ts:       Date.now()
    };
    _activityLog.unshift(item);
    if (_activityLog.length > MAX_FEED) _activityLog.length = MAX_FEED;
    prependFeedItem(item);

    // Badge only if feed tab not active
    const feedTabActive = document.querySelector('[data-tab="feed"]')?.classList.contains('active');
    if (!feedTabActive) updateFeedBadge(_activityLog.length);

    $('ft-hint').textContent = isDup ? `↩ Already in CRM` : `✓ ${truncate(msg.name || 'Lead', 20)} saved`;
    setTimeout(() => ($('ft-hint').textContent = 'Browse LinkedIn → leads auto-captured'), 3000);
  }

  if (msg.type === 'CAPTURE_FAILED') {
    setStatus('failed', msg.profileUrl || '');
    const item = {
      type:     'failed',
      name:     msg.profileUrl || 'Unknown profile',
      headline: msg.reason || 'DOM elements not found — retries exhausted',
      ts:       Date.now()
    };
    _activityLog.unshift(item);
    prependFeedItem(item);

    const feedTabActive = document.querySelector('[data-tab="feed"]')?.classList.contains('active');
    if (!feedTabActive) updateFeedBadge(_activityLog.length);

    $('ft-hint').textContent = '✗ Capture failed — see Activity tab';
    setTimeout(() => ($('ft-hint').textContent = 'Browse LinkedIn → leads auto-captured'), 4000);
  }

  if (msg.type === 'QUEUED_OFFLINE') {
    setStatus('offline', msg.name || '');
    const item = {
      type:     'offline',
      name:     msg.name || 'LinkedIn Member',
      headline: 'Backend unreachable — queued for sync',
      ts:       Date.now()
    };
    _activityLog.unshift(item);
    prependFeedItem(item);
    $('oq-badge').classList.add('show');
  }

  if (msg.type === 'QUEUE_FLUSHED') {
    const { remaining } = msg;
    $('oq-count').textContent = remaining;
    if (remaining === 0) $('oq-badge').classList.remove('show');
    else $('oq-badge').textContent = `▲ ${remaining} queued`;
  }

  if (msg.type === 'RATE_LIMITED') {
    setStatus('rate_limited');
    $('ft-hint').textContent = '⚠ Daily limit reached (80/day)';
  }
});

load();
