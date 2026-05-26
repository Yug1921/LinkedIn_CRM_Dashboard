// GoTeeOff Lead Capture — background.js v2.0 (production-stable)
// ──────────────────────────────────────────────────────────────
// ROOT CAUSE FIXES:
//  1. setInterval for offline queue flush — ILLEGAL in MV3 service workers.
//     SW can be killed at any time; setInterval silently stops. Fixed: use chrome.alarms.
//  2. Activity log only lived in popup.js memory — lost on popup close, never
//     persisted from background. Fixed: background writes to activity_log on every event.
//  3. CAPTURE_FAILED messages were not handled — failed leads vanished silently.
//     Fixed: handler added, failure written to activity log.
//  4. notifyPopup used chrome.runtime.sendMessage which throws when popup is closed.
//     The .catch(() => {}) swallowed errors fine, but the real problem was the popup
//     had no way to receive events that happened while it was closed.
//     Fixed: ALL events written to persistent activity_log first, then popup notified.
//  5. dup_count was only maintained in popup.js — lost on close. Fixed: BG owns it.
//  6. postWithRetry used blind sleep(3000) inside the fetch catch — this blocks the
//     SW and can trigger the 30 s SW lifetime limit on slow connections. Fixed: proper
//     await with reasonable timeout.

const LOG = (msg, data) => console.log('[GoTeeOff BG]', msg, data !== undefined ? data : '');

const DAILY_LIMIT = 80;
const DEFAULT_API_BASE = 'http://127.0.0.1:8000';
const ENDPOINT = '/api/ingest/linkedin-profile-full';
const MAX_ACTIVITY = 100; // keep last N events in storage

// ── Alarms ──────────────────────────────────────────────────
chrome.alarms.create('midnight-reset',    { when: nextMidnight(), periodInMinutes: 1440 });
chrome.alarms.create('flush-offline-queue', { periodInMinutes: 1 }); // every 60 s (alarms min = 1 min)

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'midnight-reset') {
    chrome.storage.local.set({ daily_scrape_count: 0, last_capture_status: 'idle' });
    LOG('Daily counter reset');
  }
  if (alarm.name === 'flush-offline-queue') {
    flushOfflineQueue();
  }
});

function nextMidnight() {
  const m = new Date(); m.setHours(24, 0, 0, 0); return m.getTime();
}

// ── Message router ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'PROFILE_SCRAPED') { handleCapture(msg.data).then(reply); return true; }
  if (msg.type === 'CAPTURE_FAILED')  { handleFailure(msg.profileUrl, msg.reason).then(reply); return true; }
  if (msg.type === 'GET_STATS')       { getStats().then(reply); return true; }
  if (msg.type === 'TEST_CONNECTION') { testConn(msg.apiBase).then(reply); return true; }
});

// ── Core capture handler ─────────────────────────────────────
async function handleCapture(data) {
  const store = await get({
    enabled: true,
    daily_scrape_count: 0,
    selected_category: 'crypto_influencer',
    api_base: DEFAULT_API_BASE
  });

  if (!store.enabled) return { status: 'disabled' };

  if (store.daily_scrape_count >= DAILY_LIMIT) {
    await appendActivity({ type: 'rate_limited', name: data.full_name || '', ts: Date.now() });
    notifyPopup({ type: 'RATE_LIMITED' });
    return { status: 'rate_limited' };
  }

  const payload = {
    profile_url:    data.profile_url,
    full_name:      data.full_name    || '',
    headline:       data.headline     || '',
    location:       data.location     || '',
    company:        data.company      || '',
    about:          data.about        || '',
    connections:    data.connections  || '',
    profile_type:   data.profile_type || 'person',
    category_hint:  store.selected_category,
    source:         data.source || 'chrome_extension',
    raw_data:       data
  };

  const result = await postWithRetry(store.api_base, payload);

  if (result.ok) {
    const isDup = result.duplicate;
    const newCount = isDup ? store.daily_scrape_count : store.daily_scrape_count + 1;

    // ── Persist dup_count in storage (not just popup memory) ──
    const { dup_count = 0 } = await get({ dup_count: 0 });

    await set({
      daily_scrape_count:  newCount,
      last_capture_status: isDup ? 'duplicate' : 'success',
      last_capture_time:   Date.now(),
      last_capture_name:   data.full_name || 'Unknown',
      dup_count:           isDup ? dup_count + 1 : dup_count
    });

    // ── Write to persistent activity log ──
    await appendActivity({
      type:     isDup ? 'duplicate' : 'success',
      name:     data.full_name || 'LinkedIn Member',
      headline: data.headline || '',
      category: store.selected_category,
      url:      data.profile_url,
      ts:       Date.now()
    });

    LOG(isDup ? `↩ Duplicate: ${data.full_name}` : `✓ Saved (${newCount}/${DAILY_LIMIT}): ${data.full_name}`);

    notifyPopup({
      type:     'CAPTURED',
      count:    newCount,
      name:     data.full_name,
      headline: data.headline || '',
      category: store.selected_category,
      status:   isDup ? 'duplicate' : 'success',
      dup_count: isDup ? dup_count + 1 : dup_count
    });

    return { status: isDup ? 'duplicate' : 'ok', count: newCount };

  } else {
    await queueOffline(payload);
    await set({ last_capture_status: 'offline' });
    await appendActivity({
      type:     'offline',
      name:     data.full_name || 'LinkedIn Member',
      headline: data.headline || '',
      category: store.selected_category,
      url:      data.profile_url,
      ts:       Date.now()
    });
    notifyPopup({ type: 'QUEUED_OFFLINE', name: data.full_name });
    return { status: 'queued_offline' };
  }
}

// ── Failure handler ──────────────────────────────────────────
async function handleFailure(profileUrl, reason) {
  LOG('Capture failed:', profileUrl, reason);
  await appendActivity({
    type:     'failed',
    name:     profileUrl || 'Unknown',
    headline: reason || 'DOM elements not found',
    url:      profileUrl,
    ts:       Date.now()
  });
  notifyPopup({ type: 'CAPTURE_FAILED', profileUrl, reason });
  return { status: 'logged' };
}

// ── Persistent activity log ──────────────────────────────────
async function appendActivity(item) {
  const { activity_log = [] } = await get({ activity_log: [] });
  activity_log.unshift(item);
  if (activity_log.length > MAX_ACTIVITY) activity_log.length = MAX_ACTIVITY;
  await set({ activity_log });
}

// ── POST with retry ──────────────────────────────────────────
// Uses AbortController so we don't hang the service worker indefinitely.
async function postWithRetry(apiBase, payload, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 s hard timeout
  try {
    const res = await fetch(`${apiBase}${ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok || res.status === 409, duplicate: body.status === 'duplicate' };
  } catch (err) {
    clearTimeout(timeout);
    if (attempt === 1) {
      LOG('POST failed, retrying in 4 s:', err.message);
      await sleep(4000);
      return postWithRetry(apiBase, payload, 2);
    }
    LOG('POST failed after 2 attempts:', err.message);
    return { ok: false };
  }
}

// ── Offline queue ────────────────────────────────────────────
async function queueOffline(payload) {
  const { offline_queue = [] } = await get({ offline_queue: [] });
  offline_queue.push({ payload, queued_at: Date.now() });
  await set({ offline_queue });
  LOG('Queued offline. Total:', offline_queue.length);
}

// Flushed by alarm every 60 s (safe for MV3 SW lifecycle)
async function flushOfflineQueue() {
  const store = await get({ offline_queue: [], api_base: DEFAULT_API_BASE, enabled: true });
  if (!store.enabled || !store.offline_queue.length) return;

  const remaining = [];
  for (const item of store.offline_queue) {
    const r = await postWithRetry(store.api_base, item.payload);
    if (r.ok) {
      await appendActivity({
        type: r.duplicate ? 'duplicate' : 'success',
        name: item.payload.full_name || 'LinkedIn Member',
        headline: item.payload.headline || '',
        category: item.payload.category_hint || '',
        url: item.payload.profile_url,
        ts: Date.now(),
        note: 'flushed from offline queue'
      });
    } else {
      remaining.push(item);
    }
  }

  if (remaining.length !== store.offline_queue.length) {
    await set({ offline_queue: remaining });
    LOG('Offline queue flushed. Remaining:', remaining.length);
    notifyPopup({ type: 'QUEUE_FLUSHED', remaining: remaining.length });
  }
}

// ── Stats ────────────────────────────────────────────────────
async function getStats() {
  const d = await get({
    daily_scrape_count: 0,
    enabled: true,
    selected_category: 'crypto_influencer',
    api_base: DEFAULT_API_BASE,
    last_capture_status: 'idle',
    last_capture_time: null,
    last_capture_name: '',
    offline_queue: [],
    dup_count: 0,
    activity_log: []
  });
  return {
    ...d,
    limit: DAILY_LIMIT,
    offline_queue_size: d.offline_queue.length
  };
}

// ── Connection test ──────────────────────────────────────────
async function testConn(apiBase) {
  try {
    const r = await fetch(`${apiBase}/health`);
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ── Notify popup if open ─────────────────────────────────────
function notifyPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Popup is closed — that's fine, it will read activity_log on next open
  });
}

// ── Helpers ──────────────────────────────────────────────────
function get(defaults) {
  return new Promise(resolve => chrome.storage.local.get(defaults, resolve));
}
function set(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
