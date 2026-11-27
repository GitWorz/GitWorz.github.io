/* Jukebox de classe — logique commune (file partagée via ntfy.sh, recherche via API publique Deezer en JSONP) */
'use strict';
const JBX = (() => {
  const NTFY = 'https://ntfy.sh/';
  const ROOM_RE = /^jbx-[a-z0-9]{8,40}$/;
  const MAX_PER_PERSON = 3;

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

  const roomFromUrl = () => { const r = new URLSearchParams(location.search).get('r') || ''; return ROOM_RE.test(r) ? r : ''; };
  const newRoom = () => 'jbx-' + rnd(14);
  const guestUrl = room => new URL('./?r=' + room, location.href).href;

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
    const k = clip(ev.k, 200); if (!k) return;
    const ts = Number(ev.ts) || (m.time * 1000);
    let t = S.tracks.get(k);
    switch (ev.t) {
      case 'add':
        if (!t) {
          t = { k, id: /^\d{1,15}$/.test(String(ev.id)) ? String(ev.id) : '', title: clip(ev.title), artist: clip(ev.artist),
            cover: safeCover(ev.cover), dur: Math.max(0, ev.dur | 0), by: clip(ev.by, 24), u: clip(ev.u, 20), ts, votes: new Set(), status: 'q' };
          S.tracks.set(k, t);
        } else if (t.status !== 'q' && t.status !== 'n') { t.status = 'q'; t.ts = ts; t.votes = new Set(); t.by = clip(ev.by, 24); t.u = clip(ev.u, 20); }
        t.votes.add(clip(ev.u, 20));
        break;
      case 'vote': if (t && t.status === 'q') t.votes.add(clip(ev.u, 20)); break;
      case 'unvote': if (t) t.votes.delete(clip(ev.u, 20)); break;
      case 'now':
        if (!t) break;
        for (const o of S.tracks.values()) if (o.status === 'n') o.status = 'p';
        t.status = 'n'; break;
      case 'play': if (t) t.status = 'p'; break;
      case 'del': if (t) t.status = 'x'; break;
      case 'requeue': if (t) { t.status = 'q'; t.ts = ts; } break;
    }
  }
  const byStatus = (S, st) => [...S.tracks.values()].filter(t => t.status === st);
  const queue = S => byStatus(S, 'q').sort((a, b) => b.votes.size - a.votes.size || a.ts - b.ts);

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

  return { esc, clip, rnd, store, uid, roomFromUrl, newRoom, guestUrl, safeCover, fmtDur, norm, send, subscribe, makeState, apply, byStatus, queue, dzSearch, MAX_PER_PERSON, ROOM_RE };
})();
