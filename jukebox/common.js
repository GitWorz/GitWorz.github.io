/* Jukebox de classe — logique commune (file partagée via ntfy.sh, recherche via API publique Deezer en JSONP) */
'use strict';
const JBX = (() => {
  const NTFY = 'https://ntfy.sh/';
  const ROOM_RE = /^jbx-[a-z0-9]{8,40}$/;
  const MAX_PER_PERSON = 3;
  const ACTIVE = ['q', 'd', 'n'];
  const DEFAULT_ROOM = 'jbx-gnrnyq237qz397im'; // salle permanente : le QR code pointe toujours ici

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clip = (s, n = 120) => String(s ?? '').slice(0, n);
  const rnd = n => { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = ''; for (const x of crypto.getRandomValues(new Uint8Array(n))) s += a[x % a.length]; return s; };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  };
  let _uid = store.get('jbx-uid');
  if (!_uid) { _uid = rnd(10); store.set('jbx-uid', _uid); }
  const uid = () => _uid;

  const roomFromUrl = () => { const r = new URLSearchParams(location.search).get('r') || ''; return ROOM_RE.test(r) ? r : DEFAULT_ROOM; };
  const newRoom = () => 'jbx-' + rnd(14);
  const guestUrl = room => new URL(room === DEFAULT_ROOM ? './' : './?r=' + room, location.href).href;

  const safeCover = u => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)dzcdn\.net$/.test(x.hostname) ? x.href : ''; } catch (e) { return ''; } };
  const fmtDur = s => s > 0 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : '';
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  async function send(room, ev) {
    ev.u = uid(); ev.ts = Date.now();
    const r = await fetch(NTFY + room, { method: 'POST', body: JSON.stringify(ev) });
    if (!r.ok) throw new Error(r.status === 429 ? 'Trop de requêtes, réessaie dans quelques secondes.' : 'Envoi impossible (' + r.status + ').');
  }

  /* Abonnement temps réel. since=all rejoue l'historique (12 h max côté ntfy.sh). */
  function subscribe(room, onEvent, onStatus) {
    const seen = new Set();
    const es = new EventSource(NTFY + room + '/sse?since=all');
    es.onopen = () => onStatus(true);
    es.onerror = () => onStatus(false);
    es.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      if (m.event !== 'message' || !m.id || seen.has(m.id)) return;
      seen.add(m.id);
      let ev; try { ev = JSON.parse(m.message); } catch (_) { return; }
      if (ev && typeof ev === 'object') onEvent(ev, m);
    };
    return es;
  }

  /* État : chaque titre a un statut q (en attente), n (en cours), p (joué), x (retiré). */
  function makeState() { return { tracks: new Map() }; }
  function apply(S, ev, m) {
    if (ev.t === 'clear') { for (const t of S.tracks.values()) if (ACTIVE.includes(t.status)) t.status = 'x'; return; }
    const k = clip(ev.k, 200); if (!k) return;
    const ts = Number(ev.ts) || (m.time * 1000);
    let t = S.tracks.get(k);
    switch (ev.t) {
      case 'add':
        if (!t) {
          t = { k, id: /^\d{1,15}$/.test(String(ev.id)) ? String(ev.id) : '', title: clip(ev.title), artist: clip(ev.artist),
            cover: safeCover(ev.cover), dur: Math.max(0, ev.dur | 0), by: clip(ev.by, 24), u: clip(ev.u, 20), ts, votes: new Set(), status: 'q' };
          S.tracks.set(k, t);
        } else if (!ACTIVE.includes(t.status)) { t.status = 'q'; t.ts = ts; t.votes = new Set(); t.by = clip(ev.by, 24); t.u = clip(ev.u, 20); }
        t.votes.add(clip(ev.u, 20));
        break;
      case 'vote': if (t && t.status === 'q') t.votes.add(clip(ev.u, 20)); break;
      case 'unvote': if (t) t.votes.delete(clip(ev.u, 20)); break;
      case 'queue': if (t) { for (const o of timeline(S, ts).played) o.status = 'p'; t.status = 'd'; t.dts = ts; } break;
      case 'now':
        if (!t) break;
        for (const o of timeline(S, ts).played) o.status = 'p';
        for (const o of S.tracks.values()) if (o.status === 'n') o.status = 'p';
        t.status = 'n'; t.nts = ts; break;
      case 'play': if (t) t.status = 'p'; break;
      case 'del': if (t) t.status = 'x'; break;
      case 'requeue': if (t) { t.status = 'q'; t.ts = ts; } break;
    }
  }
  const byStatus = (S, st) => [...S.tracks.values()].filter(t => t.status === st);
  const queue = S => byStatus(S, 'q').sort((a, b) => a.ts - b.ts);

  /* Chronologie déduite : le titre en cours avance seul selon les durées.
     cur = vraiment en cours, up = déjà dans la file Deezer (dans l'ordre), played = terminés. */
  const GRACE = 3000;
  function timeline(S, now = Date.now()) {
    const up = byStatus(S, 'd').sort((a, b) => a.dts - b.dts);
    const played = [];
    let cur = byStatus(S, 'n')[0] || null, start = cur ? cur.nts : 0;
    const over = () => cur && cur.dur > 0 && now - start > cur.dur * 1000 + GRACE;
    while (over() && up.length) { played.push(cur); const nx = up.shift(); start = Math.max(start + cur.dur * 1000, nx.dts); cur = nx; }
    if (over()) { played.push(cur); cur = null; }
    return { cur, start, up, played };
  }

  /* Recherche Deezer en JSONP (l'API publique n'envoie pas d'en-têtes CORS). */
  let cbN = 0;
  function dzSearch(q) {
    return new Promise((res, rej) => {
      const cb = '__dz' + Date.now() + '_' + (cbN++);
      const s = document.createElement('script');
      const done = () => { clearTimeout(to); delete window[cb]; s.remove(); };
      const to = setTimeout(() => { done(); rej(new Error('timeout')); }, 8000);
      window[cb] = d => { done(); if (d && d.error) rej(new Error('api')); else res((d && d.data) || []); };
      s.onerror = () => { done(); rej(new Error('net')); };
      s.src = 'https://api.deezer.com/search?q=' + encodeURIComponent(q) + '&limit=12&output=jsonp&callback=' + cb;
      document.head.appendChild(s);
    });
  }

  /* --- Rendu partagé --- */
  const bigCover = u => u ? u.replace(/\/\d+x\d+-/, '/500x500-').replace(/['"()\\\s]/g, '') : '';
  const pct = tl => { const t = tl.cur; return t && t.dur ? Math.min(100, (Date.now() - tl.start) / (t.dur * 10)) : 0; };
  const times = tl => {
    const t = tl.cur; if (!t || !t.dur) return ['En direct', ''];
    const el = Math.min(t.dur, Math.max(0, Math.round((Date.now() - tl.start) / 1000)));
    return [fmtDur(el) || '0:00', '-' + (fmtDur(t.dur - el) || '0:00')];
  };
  const EQ = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  let lastNow = '';
  function nowCard(tl, extra = '') {
    const t = tl.cur;
    if (!t) { lastNow = ''; return `<div class="np-empty"><span class="disc"></span><div>Rien ne joue pour l'instant.<br><span class="note">Le prochain titre apparaîtra ici.</span></div></div>`; }
    const c = bigCover(t.cover), fresh = t.k !== lastNow; lastNow = t.k;
    const [a, b] = times(tl);
    return `<div class="np${fresh ? ' new' : ''}">
      <div class="bg"${c ? ` style="background-image:url('${esc(c)}')"` : ''}></div>
      <div class="deck"><span class="vinyl"${c ? ` style="--lab:url('${esc(c)}')"` : ''}></span>${c ? `<img class="sleeve" src="${esc(c)}" alt="">` : '<span class="sleeve"></span>'}</div>
      <div><div class="label">${EQ}En cours</div><div class="title">${esc(t.title)}</div>
        <div class="artist">${esc(t.artist)}${t.by ? ' · demandé par ' + esc(t.by) : ''}</div>
        <div class="prog"><i id="prog" style="width:${pct(tl)}%"></i></div>
        <div class="meta"><span id="elapsed">${a}</span>${extra}<span id="left">${b}</span></div></div></div>`;
  }
  function tick(tl) {
    const p = document.getElementById('prog'); if (p) p.style.width = pct(tl) + '%';
    const [a, b] = times(tl);
    const e = document.getElementById('elapsed'); if (e) e.textContent = a;
    const l = document.getElementById('left'); if (l) l.textContent = b;
  }
  /* N'anime que les lignes qui viennent d'apparaître. */
  function animator() {
    let seen = new Set();
    return keys => { const fresh = new Set(keys.filter(k => !seen.has(k))); seen = new Set(keys); return fresh; };
  }
  function toaster(el) {
    let tm;
    return (msg, err) => { el.textContent = msg; el.classList.toggle('err', !!err); el.classList.add('show'); clearTimeout(tm); tm = setTimeout(() => el.classList.remove('show'), 2600); };
  }

  return { bigCover, pct, nowCard, tick, animator, toaster, EQ, esc, clip, rnd, store, uid, roomFromUrl, newRoom, guestUrl, safeCover, fmtDur, norm, send, subscribe, makeState, apply, byStatus, queue, dzSearch, MAX_PER_PERSON, ROOM_RE, DEFAULT_ROOM, ACTIVE, timeline };
})();
