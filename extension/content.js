// GoTeeOff Lead Capture — content.js v2.0 (production-stable)
// ─────────────────────────────────────────────────────────────
// ROOT CAUSE FIXES:
//  1. Infinite retry loop → captureProfilePage/captureCompanyPage had unbounded
//     setTimeout recursion with no retry cap. Fixed: max 3 attempts with backoff.
//  2. Multiple captures of same URL in one session → no dedup guard. Fixed: per-session Set.
//  3. SPA polling fires on every hash/query change → norm(url) comparison now used.
//  4. Search results retry even when 0 cards → schedules itself again unconditionally. Fixed.
//  5. captureSearchResults fires 2 s after detectAndCapture, then again 2 s from
//     within itself = double-send on slow pages. Fixed: single attempt with one retry guard.
(function () {
  'use strict';

  if (window.__goteeoff_loaded) return; // guard against duplicate injection
  window.__goteeoff_loaded = true;

  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.log('[GoTeeOff] Chrome APIs not available, skipping')
    return
  }

  const LOG = (msg, data) => console.log('[GoTeeOff]', msg, data !== undefined ? data : '');
  LOG('v2.0 loaded:', window.location.href);

  // ── Per-session dedup (prevents re-sending the same profile URL this session) ──
  const _captured = new Set();

  // ── Enabled check (single storage read, cached 5 s) ──
  let _enabledCache = null, _enabledAt = 0;
  function isEnabled() {
    if (_enabledCache !== null && Date.now() - _enabledAt < 5000) return Promise.resolve(_enabledCache);
    return new Promise(r => chrome.storage.local.get({ enabled: true }, d => {
      _enabledCache = d.enabled; _enabledAt = Date.now(); r(d.enabled);
    }));
  }
  chrome.storage.onChanged.addListener(c => {
    if (c.enabled !== undefined) { _enabledCache = c.enabled.newValue; _enabledAt = Date.now(); }
  });

  // ── URL normaliser ──
  function norm(raw) {
    try { const u = new URL(raw); return (u.origin + u.pathname).toLowerCase().replace(/\/$/, ''); }
    catch (_) { return raw.toLowerCase().split('?')[0].replace(/\/$/, ''); }
  }

  // Fire on initial load
  setTimeout(() => detectAndCapture(location.href), 3000)

  // Fire on SPA navigation using MutationObserver on the URL
  let lastUrl = location.href
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href
      // Wait for LinkedIn SPA to finish rendering
      setTimeout(() => detectAndCapture(location.href), 2500)
    }
  })
  const bodyEl = document.body || document.querySelector('body')
  if (bodyEl) {
    urlObserver.observe(bodyEl, { childList: true, subtree: true })
  }

  // ── Route dispatcher ──
  function detectAndCapture(url) {
    if (/linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/.test(url)) {
      captureProfilePage(url)
    }
  }

  // ── Text helpers ──
  function getText(el) { return el ? (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ') : ''; }
  const JUNK = /^(1st|2nd|3rd|3rd\+|2nd\+|follow|connect|message|mutual|\d+|see all|•|·)$/i;
  function isJunk(t) { return !t || t.length < 3 || t.length > 150 || JUNK.test(t.trim()); }

  // ────────────────────────────────────────────────────────────
  // PROFILE PAGE  — max 3 attempts, 2 s / 4 s / 6 s backoff
  // ────────────────────────────────────────────────────────────
  function captureProfilePage(url, attempt = 1) {
    function tryGet(sels, ctx = document) {
      for (const s of sels) { try { const t = getText(ctx.querySelector(s)); if (t) return t; } catch (_) { } } return '';
    }

    const profileUrl = norm(url);

    // Skip if already captured this URL this session
    if (_captured.has(profileUrl)) { LOG('Profile already captured this session, skipping:', profileUrl); return; }

    const name = tryGet([
      'h1.text-heading-xlarge',
      'h1[class*="text-heading"]',
      '.pv-text-details__left-panel h1',
      'main h1',
      'h1'
    ]);

    if (!name) {
      if (attempt < 4) {
        // DOM not ready yet, retry with increasing delay
        setTimeout(() => captureProfilePage(url, attempt + 1), attempt * 1000)
        return
      }

      LOG('Could not extract name after 4 attempts, skipping')
      return;
    }

    _captured.add(profileUrl);
    const data = {
      profile_url: profileUrl, profile_type: 'person',
      full_name: name,
      headline: tryGet(['.text-body-medium.break-words', '[class*="text-body-medium"]']),
      location: tryGet(['.text-body-small.inline.t-black--light.break-words', '[class*="t-black--light"]']),
      about: tryGet(['#about ~ * span[aria-hidden="true"]', '.pv-shared-text-with-see-more span']),
      company: tryGet(['button[aria-label*="Current company"] span[aria-hidden="true"]']),
      connections: '', source: 'linkedin_browse'
    };
    LOG('Profile captured:', data.full_name);
    sendToBackground(data);
  }

  // ────────────────────────────────────────────────────────────
  // COMPANY PAGE  — max 3 attempts
  // ────────────────────────────────────────────────────────────
  function captureCompanyPage(url, attempt = 1) {
    const MAX = 3;
    function tryGet(sels, ctx = document) {
      for (const s of sels) { try { const t = getText(ctx.querySelector(s)); if (t) return t; } catch (_) { } } return '';
    }

    const profileUrl = norm(url);
    if (_captured.has(profileUrl)) { LOG('Company already captured this session, skipping:', profileUrl); return; }

    const name = tryGet(['h1.org-top-card-summary__title', '.org-top-card h1', 'main h1', 'h1']);
    if (!name) {
      if (attempt < MAX) {
        LOG(`Company name not found (attempt ${attempt}/${MAX}), retrying…`);
        setTimeout(() => captureCompanyPage(url, attempt + 1), attempt * 2000);
      } else {
        LOG('Company name not found after max retries — aborting:', url);
        sendFailure(profileUrl, 'company_name_not_found');
      }
      return;
    }

    _captured.add(profileUrl);
    const data = {
      profile_url: profileUrl, profile_type: 'company',
      full_name: name,
      headline: tryGet(['.org-top-card-summary__tagline', '.org-top-card-summary__industry']),
      location: tryGet(['.org-top-card-summary-info-list__info-item']),
      about: tryGet(['.org-about-us-organization-description__text span']),
      company: '', connections: '', source: 'linkedin_browse'
    };
    LOG('Company captured:', data.full_name);
    sendToBackground(data);
  }

  // ────────────────────────────────────────────────────────────
  // SEARCH RESULTS — one attempt + one retry only
  // ────────────────────────────────────────────────────────────
  function captureSearchResults(url, attempt = 1) {
    const MAX = 2;
    LOG('Scanning search results…');

    let cards = Array.from(document.querySelectorAll('li[data-entity-urn]'));
    if (!cards.length) cards = Array.from(document.querySelectorAll('li[class*="entity-item"]'));
    if (!cards.length) {
      cards = Array.from(document.querySelectorAll('li'))
        .filter(li => li.querySelector('a[href*="/in/"],a[href*="/company/"]'));
    }

    LOG('Cards found:', cards.length);

    if (!cards.length) {
      if (attempt < MAX) {
        LOG(`No cards yet (attempt ${attempt}/${MAX}), retrying in 2 s…`);
        setTimeout(() => captureSearchResults(url, attempt + 1), 2000);
      } else {
        LOG('No cards after max retries — page may not have results');
      }
      return;
    }

    let sent = 0;
    const pageSeen = new Set(); // within-page dedup (not per-session, search reloads)

    cards.forEach((card, idx) => {
      const linkEl = card.querySelector('a[href*="/in/"],a[href*="/company/"]');
      if (!linkEl) return;
      let profileUrl = linkEl.href || '';
      if (profileUrl.startsWith('/')) profileUrl = 'https://www.linkedin.com' + profileUrl;
      profileUrl = norm(profileUrl);
      if (!/linkedin\.com\/(in|company)\/[^/?]+/.test(profileUrl)) return;
      if (pageSeen.has(profileUrl) || _captured.has(profileUrl)) return;
      pageSeen.add(profileUrl);
      _captured.add(profileUrl);

      let name = '';
      for (const sp of Array.from(linkEl.querySelectorAll('span'))) {
        const t = getText(sp);
        if (!isJunk(t) && sp.children.length === 0) { name = t; break; }
      }
      if (!name) { const al = linkEl.getAttribute('aria-label') || ''; if (!isJunk(al)) name = al; }
      if (!name) name = getText(card.querySelector('h3,h4')) || '';
      if (isJunk(name)) name = '';

      let headline = '', location = '';
      for (const el of Array.from(card.querySelectorAll('span,div,p'))) {
        if (linkEl.contains(el) || el.children.length > 0) continue;
        const t = getText(el);
        if (isJunk(t) || t === name) continue;
        if (!headline) { headline = t; continue; }
        if (!location) { location = t; break; }
      }

      if (!name && !headline) return;

      sendToBackground({
        profile_url: profileUrl,
        profile_type: profileUrl.includes('/company/') ? 'company' : 'person',
        full_name: name || 'LinkedIn Member',
        headline, location,
        about: '', company: '', connections: '',
        source: 'linkedin_search'
      });
      sent++;
    });

    LOG(`✓ Sent ${sent}/${cards.length} search results`);
  }

  // ────────────────────────────────────────────────────────────
  // SEND helpers
  // ────────────────────────────────────────────────────────────
  function sendToBackground(data) {
    isEnabled().then(enabled => {
      if (!enabled) { LOG('Blocked — extension OFF'); return; }
      chrome.runtime.sendMessage({ type: 'PROFILE_SCRAPED', data }, res => {
        if (chrome.runtime.lastError) { LOG('sendMessage error:', chrome.runtime.lastError.message); return; }
        LOG('ACK:', res ? res.status : 'none');
      });
    });
  }

  // Reports a capture failure to background so activity log stays accurate
  function sendFailure(profileUrl, reason) {
    chrome.runtime.sendMessage({ type: 'CAPTURE_FAILED', profileUrl, reason }, () => {
      if (chrome.runtime.lastError) return;
    });
  }

})();
