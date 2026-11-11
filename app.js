(() => {
'use strict';

/* =====================================================================
   1. 유틸
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const todayStr = () => ymd(new Date());
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const fmtMD = s => { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`; };
const fmtShort = s => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const isYmd = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

const LS = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 공간 없음/차단: 화면 동작은 유지 */ } },
};

const ICON = {
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  trips: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7.5" width="17" height="12.5" rx="2.5"/><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.500 4h3A1.5 1.5 0 0 1 15 5.5v2M3.5 13h17"/></svg>',
  date: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.600a4.3 4.3 0 0 1 7.5 2.900c0 5.600-7.500 10-7.500 10z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.500 4.500L19 7.500"/></svg>',
};

/* =====================================================================
   2. 상태 / 저장소
   ===================================================================== */
const PALETTE = ['#ff6b81', '#f06595', '#ff922b', '#f59f00', '#12b886', '#15aabf', '#4c8dff', '#7950f2', '#868e96'];
const COLS = ['events', 'trips', 'items'];
const defaultProfile = () => ({ names: { a: '', b: '' }, colors: { a: '#ff6b81', b: '#4c8dff' }, since: '' });
function mergeProfile(base, p) {
  if (!p) return base;
  return {
    names: Object.assign({}, base.names, p.names || {}),
    colors: Object.assign({}, base.colors, p.colors || {}),
    since: p.since == null ? base.since : p.since,
  };
}

const settings = Object.assign(
  { me: 'a', room: '', fb: null, migratedRoom: '', onboarded: false, pendingProfile: null, region: null },
  LS.get('cc.settings', {})
);
const savedData = LS.get('cc.data', {}) || {};
const data = {
  events: savedData.events || {},
  trips: savedData.trips || {},
  items: savedData.items || {},
  profile: mergeProfile(defaultProfile(), savedData.profile),
};
const saveSettings = () => LS.set('cc.settings', settings);
const saveData = () => LS.set('cc.data', data);

const state = {
  tab: '', sel: todayStr(), focus: '', filter: 'all',
  trip: null, tripSeg: 'plan', tripDay: 0,
  anim: { list: false },
};

const other = () => (settings.me === 'a' ? 'b' : 'a');
const nameOf = k => (k === 'both' ? '함께' : (data.profile.names[k] || (k === settings.me ? '나' : '상대')));

function applyTheme() {
  const st = document.documentElement.style;
  st.setProperty('--ca', data.profile.colors.a);
  st.setProperty('--cb', data.profile.colors.b);
}

/* =====================================================================
   3. 토스트 / 레이어(시트·페이지) / 뒤로가기
   ===================================================================== */
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  if (el.focus) el.focus();
}

const layers = [];
let histOK = true, navBusy = false, navTimer = 0;
const navQueue = [];
function navDone() {
  navBusy = false;
  clearTimeout(navTimer);
  const q = navQueue.splice(0);
  q.forEach(fn => fn());
}
function whenIdle(fn) { if (navBusy) navQueue.push(fn); else fn(); }
function pushLayer(closeFn) {
  layers.push(closeFn);
  if (histOK) { try { history.pushState({ cc: layers.length }, ''); } catch (e) { histOK = false; } }
}
function closeLayers(n) {
  n = Math.min(n == null ? 1 : n, layers.length);
  if (n <= 0 || navBusy) return;
  if (!histOK) { while (n-- > 0) layers.pop()(); return; }
  navBusy = true;
  navTimer = setTimeout(() => { // popstate가 오지 않는 예외 상황 대비
    while (n-- > 0 && layers.length) layers.pop()();
    navDone();
  }, 600);
  history.go(-n);
}
window.addEventListener('popstate', () => {
  const depth = (history.state && history.state.cc) || 0;
  while (layers.length > depth) layers.pop()();
  navDone();
});

let sheetEl = null, sheetCtx = null;
function openSheet(html, ctx) {
  whenIdle(() => {
    sheetCtx = ctx || null;
    if (sheetEl) { $('.sheet-body', sheetEl).innerHTML = html; return; }
    const el = document.createElement('div');
    el.className = 'sheet-wrap';
    el.innerHTML = `<div class="backdrop" data-action="close-layer"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><div class="sheet-body">${html}</div></div>`;
    $('#sheet-root').appendChild(el);
    sheetEl = el;
    pushLayer(closeSheetNow);
    const af = el.querySelector('[data-autofocus]');
    if (af) af.focus();
  });
}
function closeSheetNow() {
  const el = sheetEl;
  if (!el) return;
  sheetEl = null; sheetCtx = null;
  if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
  el.classList.add('closing');
  setTimeout(() => el.remove(), 260);
}

/* =====================================================================
   4. 데이터 쓰기 (로컬 + 클라우드 공통 진입점)
   ===================================================================== */
const FB_VER = '10.12.2';
const FB_BASE = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
const cloud = { on: false, ready: false, connecting: false, status: 'local', msg: '', db: null, fs: null };

function canWrite() {
  if (cloud.on && !cloud.ready) { toast('동기화 연결 중이에요. 잠시 후 다시 시도해 주세요'); return false; }
  return true;
}
function onWriteErr(err) {
  const denied = err && err.code === 'permission-denied';
  setStatus('error', denied ? 'Firestore 규칙을 확인해 주세요' : '저장 실패');
  toast(denied ? '저장 권한이 없어요. Firestore 규칙을 확인해 주세요' : '저장에 실패했어요');
}
const docRef = (col, id) => cloud.fs.doc(cloud.db, 'couples', settings.room, col, id);

function putDoc(col, doc) {
  if (!canWrite()) return false;
  doc.updatedAt = Date.now();
  data[col][doc.id] = doc;
  saveData();
  if (cloud.ready) cloud.fs.setDoc(docRef(col, doc.id), doc).catch(onWriteErr);
  scheduleRender();
  return true;
}
function delDoc(col, id) {
  if (!canWrite()) return false;
  delete data[col][id];
  saveData();
  if (cloud.ready) cloud.fs.deleteDoc(docRef(col, id)).catch(onWriteErr);
  scheduleRender();
  return true;
}
function mergePatch(a, b) {
  const out = Object.assign({}, a || {});
  if (b.names) out.names = Object.assign({}, out.names, b.names);
  if (b.colors) out.colors = Object.assign({}, out.colors, b.colors);
  if (b.since != null) out.since = b.since;
  return out;
}
function setProfile(patch) {
  data.profile = mergeProfile(data.profile, patch);
  saveData();
  applyTheme();
  if (cloud.ready) cloud.fs.setDoc(docRef('meta', 'profile'), patch, { merge: true }).catch(onWriteErr);
  else if (cloud.on) { settings.pendingProfile = mergePatch(settings.pendingProfile, patch); saveSettings(); }
  scheduleRender();
}

/* =====================================================================
   5. 실시간 동기화 (Firebase Firestore)
   ===================================================================== */
const SYNC_LABEL = { local: '이 기기에만 저장', connecting: '연결 중…', on: '실시간 연결됨', offline: '오프라인 · 연결 대기', error: '연결 오류' };
function setStatus(s, msg) {
  cloud.status = s; cloud.msg = msg || '';
  updateSyncBadge();
}
function updateSyncBadge() {
  const b = $('#hdr-sync');
  b.dataset.s = cloud.status;
  $('span', b).textContent = SYNC_LABEL[cloud.status];
  const s = $('#sync-status');
  if (s) { s.dataset.s = cloud.status; s.textContent = SYNC_LABEL[cloud.status] + (cloud.msg ? ' · ' + cloud.msg : ''); }
}

async function connectCloud() {
  if (!cloud.on || cloud.ready || cloud.connecting) return;
  cloud.connecting = true;
  setStatus('connecting');
  let appMod, fs;
  try {
    [appMod, fs] = await Promise.all([import(FB_BASE + 'firebase-app.js'), import(FB_BASE + 'firebase-firestore.js')]);
  } catch (e) {
    cloud.connecting = false;
    setStatus('error', '인터넷 연결을 확인해 주세요');
    return;
  }
  try {
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(settings.fb);
    let db;
    try {
      db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    } catch (e) {
      db = fs.getFirestore(app);
    }
    cloud.db = db; cloud.fs = fs; cloud.ready = true; cloud.connecting = false;
    const room = settings.room;

    // (1) 이 기기에만 있던 데이터를 처음 한 번 올림
    if (settings.migratedRoom !== room) {
      const docs = [];
      COLS.forEach(col => Object.values(data[col]).forEach(d => { if (d && d.id) docs.push([col, d]); }));
      if (docs.length) LS.set('cc.premigrate', data);
      const jobs = [];
      for (let i = 0; i < docs.length; i += 400) {
        const batch = fs.writeBatch(db);
        docs.slice(i, i + 400).forEach(([col, d]) => batch.set(docRef(col, d.id), d));
        jobs.push(batch.commit());
      }
      if (settings.onboarded) {
        const p = data.profile, me = settings.me;
        const patch = { names: { [me]: p.names[me] }, colors: { [me]: p.colors[me] } };
        if (p.since) patch.since = p.since;
        jobs.push(fs.setDoc(docRef('meta', 'profile'), patch, { merge: true }));
      }
      Promise.all(jobs).then(() => { settings.migratedRoom = room; saveSettings(); }).catch(onWriteErr);
    }
    // (2) 연결 전에 바꿔 둔 프로필 반영
    if (settings.pendingProfile) {
      fs.setDoc(docRef('meta', 'profile'), settings.pendingProfile, { merge: true }).catch(onWriteErr);
      settings.pendingProfile = null; saveSettings();
    }
    // (3) 실시간 구독
    const onErr = err => {
      const denied = err && err.code === 'permission-denied';
      setStatus('error', denied ? 'Firestore 규칙을 확인해 주세요' : '연결을 확인해 주세요');
    };
    COLS.forEach(col => {
      const opts = col === 'events' ? { includeMetadataChanges: true } : {};
      fs.onSnapshot(fs.collection(db, 'couples', room, col), opts, snap => {
        const map = {};
        snap.forEach(d => { map[d.id] = Object.assign({}, d.data(), { id: d.id }); });
        data[col] = map;
        saveData();
        if (col === 'events' && cloud.status !== 'error') setStatus(snap.metadata.fromCache ? 'offline' : 'on');
        scheduleRender();
      }, onErr);
    });
    fs.onSnapshot(docRef('meta', 'profile'), snap => {
      if (!snap.exists()) return;
      data.profile = mergeProfile(defaultProfile(), snap.data());
      saveData(); applyTheme(); scheduleRender();
    }, onErr);
  } catch (e) {
    cloud.connecting = false;
    setStatus('error', '설정값(firebaseConfig)을 확인해 주세요');
  }
}

function parseFbConfig(text) {
  const cfg = {};
  // 휴대폰 메모·메신저가 따옴표를 둥근 따옴표(“ ” ‘ ’)로 바꿔도 읽히도록 정리
  text = String(text || '').replace(/[“”„‟«»＂]/g, '"').replace(/[‘’‚‛`＇]/g, "'");
  const re =/["']?(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId|measurementId|databaseURL)["']?\s*:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(text))) cfg[m[1]] = m[2];
  return cfg.apiKey && cfg.projectId && cfg.appId ? cfg : null;
}
const b64enc = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64dec = s => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return decodeURIComponent(escape(atob(s)));
};
function parseInvite(text) {
  text = String(text || '');
  try { text = decodeURIComponent(text); } catch (e) { /* 그대로 사용 */ }
  // 메신저가 긴 링크 중간에 넣은 줄바꿈·공백 제거
  const at = text.indexOf('join=');
  if (at < 0) return null;
  const m = /join=([A-Za-z0-9_-]+)/.exec('join=' + text.slice(at + 5).replace(/\s+/g, ''));
  if (!m) return null;
  try {
    const o = JSON.parse(b64dec(m[1]));
    return o && o.fb && o.fb.apiKey && o.fb.projectId && o.room ? o : null;
  } catch (e) { return null; }
}
function inviteLink() {
  const payload = b64enc(JSON.stringify({ fb: settings.fb, room: settings.room, as: other() }));
  return `${location.origin}${location.pathname}#join=${payload}`;
}
function randomRoom() {
  const a = new Uint8Array(20);
  crypto.getRandomValues(a);
  return Array.from(a, b => (b % 36).toString(36)).join('');
}
function swapSides() {
  const sw = k => (k === 'a' ? 'b' : k === 'b' ? 'a' : k);
  const p = data.profile;
  data.profile = { names: { a: p.names.b, b: p.names.a }, colors: { a: p.colors.b, b: p.colors.a }, since: p.since };
  Object.values(data.events).forEach(e => { e.owner = sw(e.owner); if (e.by) e.by = sw(e.by); });
  Object.values(data.items).forEach(i => { if (i.by) i.by = sw(i.by); });
  saveData();
}
function applyInvite(inv) {
  const as = inv.as === 'a' ? 'a' : 'b';
  if (settings.me !== as) {
    if (settings.onboarded) swapSides();
    settings.me = as;
  }
  settings.fb = inv.fb; settings.room = inv.room; settings.migratedRoom = ''; settings.pendingProfile = null;
  saveSettings();
}
let bootToast = '';
function handleJoinHash() {
  if (location.hash.indexOf('join=') < 0) return;
  const inv = parseInvite(location.hash);
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* file:// 등 */ }
  if (!inv) { bootToast = '초대 링크가 올바르지 않아요'; return; }
  if (settings.room === inv.room) return;
  if (settings.room && !confirm('이미 다른 캘린더에 연결되어 있어요. 초대받은 캘린더로 바꿀까요?')) return;
  applyInvite(inv);
  bootToast = '초대받은 캘린더에 연결했어요';
}

/* =====================================================================
   6. 렌더: 헤더 / 탭
   ===================================================================== */
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  setTimeout(() => { renderQueued = false; render(); }, 0); // rAF는 백그라운드에서 멈추므로 타이머 사용
}
function render() {
  renderHeader();
  if (state.tab === 'cal') renderCal();
  else if (state.tab === 'trips') renderTrips();
  if (state.trip) renderTrip();
  if (sheetEl && sheetCtx && sheetCtx.day) $('.sheet-body', sheetEl).innerHTML = daySheetHTML(sheetCtx.day); // 열려 있는 하루 일정도 실시간 반영
}
function renderHeader() {
  const p = data.profile, me = settings.me, ot = other();
  $('#hdr-names').innerHTML = (p.names[me] || p.names[ot])
    ? `${esc(nameOf(me))} <span class="hrt">♥</span> ${esc(nameOf(ot))}`
    : '우리 캘린더';
  const t = todayStr();
  $('#hdr-dday').textContent = isYmd(p.since) && p.since <= t ? `함께한 지 ${diffDays(p.since, t) + 1}일째` : fmtMD(t);
  updateSyncBadge();
}

const TABS = ['cal', 'trips', 'date', 'settings'];
const TAB_LABEL = { cal: '캘린더', trips: '여행', date: '데이트', settings: '설정' };
function buildTabbar() {
  $('#tabbar').innerHTML = '<i class="tab-ind"></i>' + TABS.map(t =>
    `<button type="button" data-action="tab" data-tab="${t}">${ICON[t]}<span>${TAB_LABEL[t]}</span></button>`).join('');
}
function switchTab(tab) {
  const prev = TABS.indexOf(state.tab), next = TABS.indexOf(tab);
  if (next < 0) return;
  const changed = state.tab !== tab;
  const main = $('#main');
  if (changed && state.tab === 'cal') cal.scroll = main.scrollTop; // 달력 스크롤 위치 기억
  state.tab = tab;
  TABS.forEach(t => {
    const v = $('#view-' + t);
    v.classList.toggle('active', t === tab);
    v.classList.toggle('from-left', t === tab && next < prev);
  });
  $('#tabbar').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('.tab-ind').style.setProperty('--i', next);
  $('#fab').classList.toggle('hide', !(tab === 'cal' || tab === 'trips'));
  if (changed) main.scrollTop = 0;
  if (tab === 'cal') {
    const focus = state.focus;
    state.focus = '';
    renderCal();
    if (changed) {
      if (cal.scroll == null) { gotoMonth(todayStr(), false); settleToday(); } else main.scrollTop = cal.scroll;
      updateCalTitle();
    }
    if (focus) revealDay(focus);
  }
  else if (tab === 'trips') renderTrips();
  else if (tab === 'date') enterDate();
  else renderSettings();
}

/* =====================================================================
   7. 렌더: 캘린더
   ===================================================================== */
const cmpEvent = (x, y) => (x.time || '').localeCompare(y.time || '') || (x.createdAt || 0) - (y.createdAt || 0);
const passFilter = e => state.filter === 'all' || e.owner === state.filter || (state.filter !== 'both' && e.owner === 'both');
const ownerCls = o => (o === 'a' || o === 'b' ? 'o-' + o : 'o-both');

function eventsByDate(from, to) {
  const map = {};
  Object.values(data.events).forEach(e => {
    if (!e || !isYmd(e.date) || !passFilter(e)) return;
    const end = isYmd(e.endDate) && e.endDate > e.date ? e.endDate : e.date;
    if (end < from || e.date > to) return;
    let d = e.date < from ? from : e.date;
    const last = end > to ? to : end;
    while (d <= last) { (map[d] || (map[d] = [])).push(e); d = addDays(d, 1); }
  });
  Object.keys(map).forEach(k => map[k].sort(cmpEvent));
  return map;
}
const validTrips = () => Object.values(data.trips).filter(t => t && isYmd(t.start) && isYmd(t.end));

/* ----- 공휴일 (기기에서 직접 계산: 인터넷 불필요) ----- */
const LUNAR_FALLBACK = { // 음력 계산을 지원하지 않는 브라우저용
  seol: { 2025: '01-29', 2026: '02-17', 2027: '02-07', 2028: '01-27', 2029: '02-13', 2030: '02-03' },
  buddha: { 2025: '05-05', 2026: '05-24', 2027: '05-13', 2028: '05-02', 2029: '05-20', 2030: '05-09' },
  chuseok: { 2025: '10-06', 2026: '09-25', 2027: '09-15', 2028: '10-03', 2029: '09-22', 2030: '09-12' },
};
const EXTRA_HOLIDAYS = { '2026-06-03': '지방선거', '2028-04-12': '국회의원선거' };
const lunarFmt = (() => {
  for (const c of ['dangi', 'chinese']) {
    try {
      const f = new Intl.DateTimeFormat('en-u-ca-' + c, { month: 'numeric', day: 'numeric' });
      if (f.resolvedOptions().calendar === c) return f;
    } catch (e) { /* 다음 후보 */ }
  }
  return null;
})();
function lunarDate(y, key, lunarMD, m0, d0) { // 음력 lunarMD('1-1' 등)에 해당하는 양력 날짜
  if (lunarFmt) {
    try {
      for (let i = 0; i < 50; i++) {
        const dt = new Date(y, m0, d0 + i, 12);
        let m = '', d = '';
        lunarFmt.formatToParts(dt).forEach(p => { if (p.type === 'month') m = p.value; else if (p.type === 'day') d = p.value; });
        if (m + '-' + d === lunarMD) return ymd(dt); // 윤달은 '6bis'처럼 나와서 자동 제외
      }
    } catch (e) { /* 아래 표 사용 */ }
  }
  const fb = LUNAR_FALLBACK[key][y];
  return fb ? y + '-' + fb : '';
}
const holCache = {};
function holidaysOf(y) {
  if (holCache[y]) return holCache[y];
  const list = []; // r: 'w' 토·일이면 대체, 's' 일요일이면 대체
  const add = (d, n, r) => list.push({ d, n, r: r || '' });
  add(y + '-01-01', '새해');
  add(y + '-03-01', '삼일절', 'w');
  add(y + '-05-01', '노동절');
  add(y + '-05-05', '어린이날', 'w');
  add(y + '-06-06', '현충일');
  if (y >= 2026) add(y + '-07-17', '제헌절');
  add(y + '-08-15', '광복절', 'w');
  add(y + '-10-03', '개천절', 'w');
  add(y + '-10-09', '한글날', 'w');
  add(y + '-12-25', '성탄절', 'w');
  const seol = lunarDate(y, 'seol', '1-1', 0, 20);
  const buddha = lunarDate(y, 'buddha', '4-8', 3, 25);
  const chuseok = lunarDate(y, 'chuseok', '8-15', 8, 5);
  if (seol) [-1, 0, 1].forEach(o => add(addDays(seol, o), o ? '설날 연휴' : '설날', 's'));
  if (buddha) add(buddha, '부처님오신날', 'w');
  if (chuseok) [-1, 0, 1].forEach(o => add(addDays(chuseok, o), o ? '추석 연휴' : '추석', 's'));

  const map = {}, byDate = {};
  list.forEach(h => {
    map[h.d] = map[h.d] ? map[h.d] + '·' + h.n : h.n;
    (byDate[h.d] || (byDate[h.d] = [])).push(h);
  });
  Object.keys(EXTRA_HOLIDAYS).forEach(d => { if (d.slice(0, 4) === String(y) && !map[d]) map[d] = EXTRA_HOLIDAYS[d]; });
  // 대체공휴일: 해당 공휴일 다음의 첫 평일(다른 공휴일 제외)
  Object.keys(byDate).sort().forEach(d => {
    const hs = byDate[d], dow = parseYmd(d).getDay();
    const need = hs.some(h => (h.r === 'w' && (dow === 0 || dow === 6)) || (h.r === 's' && dow === 0))
      || (hs.length > 1 && hs.some(h => h.r === 's' || h.n === '어린이날'));
    if (!need) return;
    let s = addDays(d, 1);
    for (let i = 0; i < 10 && (map[s] || parseYmd(s).getDay() === 0 || parseYmd(s).getDay() === 6); i++) s = addDays(s, 1);
    map[s] = '대체공휴일';
  });
  return (holCache[y] = map);
}
const holidayName = d => (isYmd(d) ? holidaysOf(Number(d.slice(0, 4)))[d] || '' : '');

/* ----- 세로 스크롤 달력 ----- */
const cal = { built: false, from: 0, to: -1, bFrom: 0, bTo: -1, els: {}, html: {}, io: null, ttl: '', cur: null, scroll: null, ticking: false };
const mIdx = d => { const p = parseYmd(d); return p.getFullYear() * 12 + p.getMonth(); };
const idxFirst = i => ymd(new Date(Math.floor(i / 12), i % 12, 1));
const idxLast = i => ymd(new Date(Math.floor(i / 12), i % 12 + 1, 0));
const topIn = el => {
  const main = $('#main');
  if (el.offsetParent === main) return el.offsetTop; // 등장 애니메이션(transform) 중에도 정확
  return el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
};
const calTopH = () => { const t = $('.cal-top'); return t ? t.offsetHeight : 0; };

function monthHTML(idx, map, trips, today) {
  const y = Math.floor(idx / 12), m = idx % 12;
  const lead = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const hol = holidaysOf(y);
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<i class="cell blank"></i>';
  for (let n = 1; n <= days; n++) {
    const d = `${y}-${pad(m + 1)}-${pad(n)}`;
    const evs = map[d] || [];
    const cover = trips.filter(t => t.start <= d && d <= t.end);
    const h = hol[d] || '';
    const cls = ['cell', 'd' + ((lead + n - 1) % 7)];
    if (h) cls.push('hol');
    if (d === today) cls.push('today');
    if (d === state.sel) cls.push('sel');
    const room = h ? 2 : 3; // 공휴일 이름이 한 줄을 차지
    const shown = evs.length > room ? evs.slice(0, room - 1) : evs;
    const pills = shown.map(e => `<span class="pill ${ownerCls(e.owner)}">${e.type === 'date' ? '♥' : ''}${esc(e.title)}</span>`).join('');
    const more = evs.length > shown.length ? `<span class="more">+${evs.length - shown.length}</span>` : '';
    const band = cover.length
      ? `<i class="tripband${cover.some(t => t.start === d) ? ' s' : ''}${cover.some(t => t.end === d) ? ' e' : ''}"></i>` : '';
    cells += `<button type="button" class="${cls.join(' ')}" data-action="pick-day" data-date="${d}" aria-label="${fmtMD(d)}${h ? ' ' + esc(h) : ''} 일정 ${evs.length}개"><span class="num">${n}</span>${h ? `<span class="hname">${esc(h)}</span>` : ''}${pills}${more}${band}</button>`;
  }
  return `<h3 class="m-title"><b>${m + 1}</b>월<small>${y}</small></h3><div class="grid">${cells}</div>`;
}

function renderCal() {
  if (!cal.built) {
    const t = mIdx(todayStr());
    cal.from = t - 12; cal.to = t + 18;
    $('#view-cal').innerHTML = `
      <div class="cal-top">
        <div class="cal-head">
          <button type="button" class="cal-title" data-action="today" aria-label="오늘로 이동"><span id="cal-ttl"></span></button>
          <button type="button" class="btn sm ghost" data-action="today">오늘</button>
        </div>
        <div class="chips" id="cal-chips"></div>
        <div class="dow-row">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
      </div>
      <div id="months"></div>`;
    cal.built = true;
    if ('IntersectionObserver' in window) {
      document.documentElement.classList.add('io');
      cal.io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('seen'); cal.io.unobserve(e.target); }
      }), { root: $('#main'), rootMargin: '0px 0px -6% 0px' });
    }
  }
  const me = settings.me, ot = other();
  const fchip = (v, label, cls) => `<button type="button" class="chip ${cls} ${state.filter === v ? 'on' : ''}" data-action="filter" data-v="${v}">${v === 'all' ? '' : '<i></i>'}${esc(label)}</button>`;
  const chips = fchip('all', '전체', '') + fchip(me, nameOf(me), 'o-' + me) + fchip(ot, nameOf(ot), 'o-' + ot) + fchip('both', '함께', 'o-both');
  if (cal.chips !== chips) { $('#cal-chips').innerHTML = chips; cal.chips = chips; }

  const box = $('#months');
  const fromD = idxFirst(cal.from), toD = idxLast(cal.to);
  const map = eventsByDate(fromD, toD);
  const trips = validTrips().filter(t => t.end >= fromD && t.start <= toD);
  const today = todayStr();
  const hadAny = cal.bTo >= cal.bFrom, oldFrom = cal.bFrom;
  for (let i = cal.from; i <= cal.to; i++) {
    let el = cal.els[i];
    if (!el) {
      el = document.createElement('section');
      el.className = 'month';
      box.insertBefore(el, hadAny && i < oldFrom ? cal.els[oldFrom] : null);
      cal.els[i] = el;
      if (cal.io) cal.io.observe(el);
    }
    const html = monthHTML(i, map, trips, today);
    if (cal.html[i] !== html) { el.innerHTML = html; cal.html[i] = html; } // 바뀐 달만 다시 그림
  }
  cal.bFrom = cal.from; cal.bTo = cal.to;
  updateCalTitle();
  if (state.focus && state.tab === 'cal') { const d = state.focus; state.focus = ''; revealDay(d); }
}

function updateCalTitle() {
  if (!cal.built || state.tab !== 'cal') return;
  const line = $('#main').scrollTop + calTopH() + 40;
  let cur = cal.from;
  for (let i = cal.from; i <= cal.to; i++) {
    const el = cal.els[i];
    if (el && topIn(el) <= line) cur = i; else break;
  }
  const txt = `${Math.floor(cur / 12)}년 ${cur % 12 + 1}월`;
  if (txt === cal.ttl) return;
  const el = $('#cal-ttl');
  el.textContent = txt;
  if (cal.ttl) {
    el.classList.remove('up', 'dn');
    void el.offsetWidth;
    el.classList.add(cal.cur != null && cur < cal.cur ? 'dn' : 'up');
  }
  cal.ttl = txt; cal.cur = cur;
}

function growCal(dir) { // 스크롤이 끝에 가까워지면 6개월씩 이어 붙임
  const main = $('#main'), box = $('#months');
  if (dir < 0) {
    if (cal.from <= 1900 * 12) return;
    const h = box.offsetHeight;
    cal.from -= 6;
    renderCal();
    main.scrollTop += box.offsetHeight - h; // 위에 붙인 만큼 보정해서 화면이 튀지 않게
  } else {
    if (cal.to >= 2200 * 12) return;
    cal.to += 6;
    renderCal();
  }
}
function onMainScroll() {
  if (state.tab !== 'cal' || !cal.built || cal.ticking) return;
  cal.ticking = true;
  const run = () => {
    if (!cal.ticking) return;
    cal.ticking = false;
    if (state.tab !== 'cal') return;
    const main = $('#main');
    if (main.scrollTop < 600) growCal(-1);
    else if (main.scrollHeight - main.scrollTop - main.clientHeight < 900) growCal(1);
    updateCalTitle();
  };
  requestAnimationFrame(run);
  setTimeout(run, 150); // 화면 갱신이 멈춘 상태(백그라운드)에서도 처리되도록
}
function ensureMonth(idx) { // 그 달이 아직 안 그려졌으면 범위를 넓힘
  if (!cal.built || (idx >= cal.from && idx <= cal.to)) return;
  const main = $('#main'), box = $('#months');
  if (idx < cal.from - 36 || idx > cal.to + 36) { // 너무 멀면 그 달 주변으로 새로 그림
    if (cal.io) cal.io.disconnect();
    box.innerHTML = '';
    cal.els = {}; cal.html = {}; cal.bFrom = 0; cal.bTo = -1;
    cal.from = idx - 6; cal.to = idx + 12;
    renderCal();
  } else if (idx < cal.from) {
    const h = box.offsetHeight;
    cal.from = idx - 3;
    renderCal();
    main.scrollTop += box.offsetHeight - h;
  } else {
    cal.to = idx + 6;
    renderCal();
  }
}
function scrollMain(top, smooth) { // 화면이 꺼져 있을 땐 부드러운 스크롤이 멈추므로 즉시 이동
  $('#main').scrollTo({ top: Math.max(0, top), behavior: smooth && !document.hidden ? 'smooth' : 'auto' });
}
function gotoMonth(d, smooth) { // 그 달 제목이 맨 위에 오도록
  ensureMonth(mIdx(d));
  const el = cal.els[mIdx(d)];
  if (!el) return;
  const main = $('#main'), head = calTopH();
  let top = topIn(el) - head - 6;
  const cell = $(`#months [data-date="${d}"]`);
  if (cell) { // 월말처럼 그 날짜가 화면 아래로 잘리면, 날짜가 가운데 오도록
    const cellTop = topIn(cell);
    if (cellTop + cell.offsetHeight - top > main.clientHeight - 70) top = cellTop - head - (main.clientHeight - head - cell.offsetHeight) / 2;
  }
  scrollMain(top, smooth);
  updateCalTitle();
}
function goToday(smooth) { // 달력을 오늘 위치로
  const t = todayStr();
  state.sel = t;
  renderCal();
  gotoMonth(t, smooth);
}
// 앱을 열 때: 일부 기기(iOS)는 화면이 그려지기 전의 스크롤 지정을 무시하므로, 손대기 전까지 몇 번 다시 맞춘다
let userMoved = false;
function settleToday() {
  userMoved = false;
  [0, 60, 250, 700, 1500].forEach(ms => setTimeout(() => {
    if (userMoved || state.tab !== 'cal' || layers.length) return;
    const t = todayStr();
    if (state.sel !== t) { state.sel = t; renderCal(); }
    gotoMonth(t, false);
  }, ms));
}
function popCell(d) {
  const c = $(`#months [data-date="${d}"]`);
  if (!c) return;
  c.classList.remove('pop');
  void c.offsetWidth;
  c.classList.add('pop');
}
function revealDay(d) { // 저장한 날짜가 화면 밖이면 보이는 곳으로 이동
  if (!isYmd(d) || !cal.built) return;
  ensureMonth(mIdx(d));
  const cell = $(`#months [data-date="${d}"]`), main = $('#main');
  if (!cell) return;
  const r = cell.getBoundingClientRect(), mr = main.getBoundingClientRect();
  if (r.top < mr.top + calTopH() || r.bottom > mr.bottom - 90) {
    scrollMain(topIn(cell) - main.clientHeight / 2, true);
  }
  popCell(d);
}
function jumpTo(dateStr) {
  state.sel = dateStr; state.focus = dateStr;
}

/* ----- 날짜를 눌렀을 때 뜨는 하루 일정 시트 ----- */
function daySheetHTML(d) {
  const evs = eventsByDate(d, d)[d] || [];
  const trips = validTrips().filter(t => t.start <= d && d <= t.end);
  const h = holidayName(d);
  const gap = diffDays(todayStr(), d);
  const when = gap === 0 ? '오늘' : gap === 1 ? '내일' : gap === -1 ? '어제' : gap > 0 ? `${gap}일 뒤` : `${-gap}일 전`;
  const rows = trips.map(t => `
      <button type="button" class="ev-row trip" data-action="open-trip" data-id="${esc(t.id)}"><i class="bar"></i>
        <span class="ev-main"><span class="ev-title">✈ ${esc(t.title)}</span><span class="ev-sub">${fmtShort(t.start)} – ${fmtShort(t.end)}${t.dest ? ' · ' + esc(t.dest) : ''}</span></span>
        <span class="who trip">여행</span></button>`).join('') +
    evs.map(e => {
      const sub = [e.time, isYmd(e.endDate) && e.endDate > e.date ? `${fmtShort(e.date)} – ${fmtShort(e.endDate)}` : '', e.place].filter(Boolean).map(esc).join(' · ');
      return `
      <button type="button" class="ev-row ${ownerCls(e.owner)}" data-action="edit-event" data-id="${esc(e.id)}"><i class="bar"></i>
        <span class="ev-main"><span class="ev-title">${e.type === 'date' ? '<span class="hrt">♥</span> ' : ''}${esc(e.title)}</span>${sub ? `<span class="ev-sub">${sub}</span>` : ''}</span>
        <span class="who ${ownerCls(e.owner)}">${esc(nameOf(e.owner))}</span></button>`;
    }).join('');
  return `
    <div class="dp-head">
      <div><h3>${fmtMD(d)}</h3><span class="sub">${when}</span>${h ? `<span class="hbadge">${esc(h)}</span>` : ''}</div>
      <button type="button" class="btn sm" data-action="add-event">+ 일정</button>
    </div>
    <div class="day-list">${rows || '<div class="empty"><span class="big">🗓️</span>등록된 일정이 없어요</div>'}</div>`;
}
function openDaySheet(d) { openSheet(daySheetHTML(d), { day: d }); }

/* ----- 데이트 일정을 등록하면 하트가 날아오름 ----- */
function burstHearts() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'burst';
  box.style.left = window.innerWidth / 2 + 'px';
  box.style.top = window.innerHeight * 0.66 + 'px';
  let html = '';
  for (let i = 0; i < 18; i++) {
    const x = Math.round((Math.random() - 0.5) * 300), y = -Math.round(120 + Math.random() * 260);
    html += `<i style="--x:${x}px;--y:${y}px;--r:${Math.round((Math.random() - 0.5) * 80)}deg;--s:${14 + Math.round(Math.random() * 16)}px;--t:${900 + Math.round(Math.random() * 700)}ms;--dl:${Math.round(Math.random() * 180)}ms;--c:var(--c${i % 2 ? 'a' : 'b'})">♥</i>`;
  }
  box.innerHTML = html;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2000);
}

/* ----- 일정 등록/수정 시트 ----- */
function openEventSheet(existing, preset) {
  const isNew = !existing;
  const e = existing ? Object.assign({}, existing) : Object.assign({
    id: uid(), title: '', date: state.sel, endDate: '', time: '', owner: settings.me, type: 'normal',
    place: '', memo: '', by: settings.me, createdAt: Date.now(),
  }, preset || {});
  const me = settings.me, ot = other();
  const own = (v, cls) => `<label class="${cls}"><input type="radio" name="owner" value="${v}" ${e.owner === v ? 'checked' : ''}><span>${esc(nameOf(v))}</span></label>`;
  const hasMore = !!(e.endDate || e.place || e.memo);
  openSheet(`
    <form class="stack" data-form="event" novalidate>
      <input class="title-input" type="text" name="title" placeholder="일정 제목" maxlength="60" autocomplete="off" enterkeyhint="done" value="${esc(e.title)}" ${isNew ? 'data-autofocus' : ''}>
      <div class="seg">${own(me, 'o-' + me)}${own(ot, 'o-' + ot)}${own('both', 'o-both')}</div>
      <div class="seg">
        <label class="plain"><input type="radio" name="type" value="normal" ${e.type !== 'date' ? 'checked' : ''}><span>일반 일정</span></label>
        <label class="plain"><input type="radio" name="type" value="date" ${e.type === 'date' ? 'checked' : ''}><span>♥ 데이트</span></label>
      </div>
      <div class="row2">
        <label class="field"><span>날짜</span><input type="date" name="date" value="${esc(e.date)}"></label>
        <label class="field"><span>시간 (선택)</span><input type="time" name="time" value="${esc(e.time)}"></label>
      </div>
      <details class="more" ${hasMore ? 'open' : ''}>
        <summary>종료일 · 장소 · 메모</summary>
        <div class="stack">
          <label class="field"><span>종료일 (여러 날 일정일 때)</span><input type="date" name="endDate" value="${esc(e.endDate)}"></label>
          <label class="field"><span>장소</span><input type="text" name="place" maxlength="80" autocomplete="off" value="${esc(e.place)}"></label>
          <label class="field"><span>메모</span><textarea name="memo" maxlength="500">${esc(e.memo)}</textarea></label>
        </div>
      </details>
      <div class="sheet-actions">
        ${isNew ? '' : '<button type="button" class="btn danger" data-action="del-event" data-confirm>삭제</button>'}
        <button type="submit" class="btn">${isNew ? '등록' : '저장'}</button>
      </div>
    </form>`, { doc: e, isNew });
}

/* =====================================================================
   8. 렌더: 여행
   ===================================================================== */
const tripDays = t => Math.max(1, Math.min(60, diffDays(t.start, t.end) + 1));
const itemsOf = id => Object.values(data.items).filter(i => i && i.tripId === id);
function tripBadge(t) {
  const today = todayStr();
  if (today < t.start) return `D-${diffDays(today, t.start)}`;
  if (today > t.end) return '다녀옴';
  return `여행 중 · ${diffDays(t.start, today) + 1}일차`;
}
function tripRange(t) {
  const n = tripDays(t);
  return `${fmtShort(t.start)} – ${fmtShort(t.end)} · ${n === 1 ? '당일' : `${n - 1}박 ${n}일`}`;
}
function renderTrips() {
  const today = todayStr();
  const all = validTrips();
  const up = all.filter(t => t.end >= today).sort((a, b) => a.start.localeCompare(b.start));
  const past = all.filter(t => t.end < today).sort((a, b) => b.start.localeCompare(a.start));
  const card = (t, cls) => {
    const its = itemsOf(t.id);
    const plan = its.filter(i => i.kind === 'plan').length;
    const chk = its.filter(i => i.kind === 'check');
    return `<button type="button" class="trip-card ${cls}" data-action="open-trip" data-id="${esc(t.id)}">
      <div class="tc-top"><b>${esc(t.title)}</b><span class="dbadge">${tripBadge(t)}</span></div>
      <div class="tc-sub">${t.dest ? esc(t.dest) + ' · ' : ''}${tripRange(t)}</div>
      <div class="tc-sub">일정 ${plan}개 · 준비물 ${chk.filter(i => i.done).length}/${chk.length}</div>
    </button>`;
  };
  $('#view-trips').innerHTML = `
    <div class="sec-head"><h2>여행</h2><button type="button" class="btn sm ghost" data-action="new-trip">+ 새 여행</button></div>
    ${all.length ? '' : '<div class="empty"><span class="big">✈️</span>함께 떠날 여행을 등록해 보세요<br><button type="button" class="btn" data-action="new-trip">여행 만들기</button></div>'}
    ${up.map(t => card(t, '')).join('')}
    ${past.length ? '<div class="group-label">지난 여행</div>' + past.map(t => card(t, 'past')).join('') : ''}`;
}

function openTripSheet(existing) {
  const isNew = !existing;
  const t = existing ? Object.assign({}, existing) : {
    id: uid(), title: '', dest: '', start: state.sel, end: addDays(state.sel, 1), memo: '', by: settings.me, createdAt: Date.now(),
  };
  openSheet(`
    <form class="stack" data-form="trip" novalidate>
      <input class="title-input" type="text" name="title" placeholder="여행 이름 (예: 제주 가을 여행)" maxlength="40" autocomplete="off" value="${esc(t.title)}" ${isNew ? 'data-autofocus' : ''}>
      <label class="field"><span>여행지</span><input type="text" name="dest" placeholder="예: 제주, 오사카" maxlength="40" autocomplete="off" value="${esc(t.dest)}"></label>
      <div class="row2">
        <label class="field"><span>출발</span><input type="date" name="start" value="${esc(t.start)}"></label>
        <label class="field"><span>도착</span><input type="date" name="end" value="${esc(t.end)}"></label>
      </div>
      <label class="field"><span>메모 (숙소, 예약번호 등)</span><textarea name="memo" maxlength="500">${esc(t.memo)}</textarea></label>
      <div class="sheet-actions">
        ${isNew ? '' : '<button type="button" class="btn danger" data-action="del-trip" data-confirm>삭제</button>'}
        <button type="submit" class="btn">${isNew ? '여행 만들기' : '저장'}</button>
      </div>
    </form>`, { doc: t, isNew });
}

function openTrip(id) {
  whenIdle(() => {
    const t = data.trips[id];
    if (!t || state.trip) return;
    state.trip = id; state.tripSeg = 'plan'; state.anim.list = true;
    const today = todayStr();
    state.tripDay = today >= t.start && today <= t.end ? Math.min(diffDays(t.start, today), tripDays(t) - 1) : 0;
    const el = document.createElement('div');
    el.className = 'page'; el.id = 'trip-page';
    el.innerHTML = `
      <div class="page-head">
        <button type="button" class="nav-btn" data-action="close-layer" aria-label="뒤로">${ICON.prev}</button>
        <div class="ph-title" id="tp-title"></div>
        <button type="button" class="btn sm ghost" data-action="edit-trip">수정</button>
      </div>
      <div class="page-body">
        <div class="hero" id="tp-hero"></div>
        <button type="button" class="link-row" data-action="trip-reco"><span id="tp-reco"></span><span>›</span></button>
        <div class="seg2" id="tp-seg" data-v="plan"><i class="thumb"></i>
          <button type="button" data-action="trip-seg" data-v="plan">일정</button>
          <button type="button" data-action="trip-seg" data-v="check">준비물</button>
        </div>
        <div class="chips" id="tp-days"></div>
        <form class="add-row" id="tp-form" data-form="item" novalidate>
          <input type="time" name="time" aria-label="시간">
          <input type="text" name="text" maxlength="80" autocomplete="off" enterkeyhint="done">
          <button type="submit" class="btn">추가</button>
        </form>
        <div id="tp-list"></div>
      </div>`;
    $('#page-root').appendChild(el);
    pushLayer(closeTripNow);
    renderTrip();
  });
}
function closeTripNow() {
  const el = $('#trip-page');
  state.trip = null;
  if (!el) return;
  el.removeAttribute('id');
  el.classList.add('closing');
  setTimeout(() => el.remove(), 270);
}
function renderTrip() {
  if (!state.trip || !$('#trip-page')) return;
  const t = data.trips[state.trip];
  if (!t || !isYmd(t.start) || !isYmd(t.end)) {
    $('#tp-title').textContent = '삭제된 여행';
    $('#tp-hero').innerHTML = '<p>이 여행은 삭제되었어요.</p>';
    $('#tp-days').innerHTML = ''; $('#tp-list').innerHTML = '';
    return;
  }
  const n = tripDays(t);
  if (state.tripDay >= n) state.tripDay = n - 1;
  const seg = state.tripSeg;
  $('#tp-title').textContent = t.title;
  $('#tp-hero').innerHTML = `<div class="big">${tripBadge(t)}</div><p>${t.dest ? esc(t.dest) + ' · ' : ''}${tripRange(t)}</p>${t.memo ? `<p>${esc(t.memo)}</p>` : ''}`;
  $('#tp-reco').textContent = `📍 ${t.dest || t.title} 주변 가볼 곳 찾아보기`;
  const segEl = $('#tp-seg');
  segEl.dataset.v = seg;
  segEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === seg));
  const form = $('#tp-form');
  form.classList.toggle('check', seg === 'check');
  form.elements.text.placeholder = seg === 'plan' ? '할 일 · 갈 곳 추가' : '챙길 것 추가 (예: 충전기)';

  const its = itemsOf(t.id);
  let list;
  if (seg === 'plan') {
    let chips = '';
    for (let i = 0; i < n; i++) {
      const d = addDays(t.start, i);
      chips += `<button type="button" class="chip ${i === state.tripDay ? 'on' : ''}" data-action="trip-day" data-i="${i}">${i + 1}일차 · ${fmtShort(d)}(${DOW[parseYmd(d).getDay()]})</button>`;
    }
    $('#tp-days').innerHTML = chips;
    $('#tp-days').style.display = '';
    list = its.filter(i => i.kind === 'plan' && Math.min(i.day || 0, n - 1) === state.tripDay)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || (a.createdAt || 0) - (b.createdAt || 0));
  } else {
    $('#tp-days').innerHTML = '';
    $('#tp-days').style.display = 'none';
    list = its.filter(i => i.kind === 'check').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }
  $('#tp-list').innerHTML = list.length
    ? `<div class="item-list ${state.anim.list ? 'in' : ''}">${list.map(i => `
        <div class="item ${i.done ? 'done' : ''}">
          <button type="button" class="item-toggle" data-action="toggle-item" data-id="${esc(i.id)}" aria-pressed="${i.done ? 'true' : 'false'}">
            <i class="tick">${ICON.check}</i><span class="txt">${i.time ? `<small>${esc(i.time)}</small>` : ''}${esc(i.text)}</span>
          </button>
          <button type="button" class="x" data-action="del-item" data-id="${esc(i.id)}" data-confirm="삭제" aria-label="삭제">✕</button>
        </div>`).join('')}</div>`
    : `<div class="empty">${seg === 'plan' ? '이 날의 일정을 추가해 보세요' : '준비물을 추가해 보세요'}</div>`;
  state.anim.list = false;
}

/* =====================================================================
   9. 렌더: 데이트 장소 (인터넷 연동)
   ===================================================================== */
const PRESETS = [
  ['성수', 37.5446, 127.0559], ['홍대', 37.5572, 126.9245], ['강남', 37.4979, 127.0276], ['잠실', 37.5133, 127.1001],
  ['이태원', 37.5345, 126.9946], ['여의도', 37.5216, 126.9242], ['익선동', 37.5744, 126.9896], ['수원 행궁동', 37.2823, 127.0145],
  ['인천 송도', 37.3923, 126.6395], ['부산 해운대', 35.1587, 129.1604], ['부산 광안리', 35.1532, 129.1187], ['대구 동성로', 35.8690, 128.5955],
  ['전주 한옥마을', 35.8150, 127.1530], ['경주 황리단길', 35.8377, 129.2098], ['강릉 안목', 37.7716, 128.9475], ['속초', 38.2046, 128.5903],
  ['제주시', 33.4996, 126.5312], ['제주 애월', 33.4625, 126.3096], ['서귀포', 33.2496, 126.5600],
].map(p => ({ name: p[0], lat: p[1], lon: p[2] }));
const CATS = {
  cafe: { label: '카페', r: 1200, terms: ['cafe'] },
  food: { label: '맛집', r: 1000, terms: ['restaurant'] },
  sight: { label: '볼거리', r: 4000, terms: ['attraction', 'museum'] },
  park: { label: '산책', r: 2500, terms: ['park'] },
  fun: { label: '놀거리', r: 3000, terms: ['cinema', 'theatre'] },
  bar: { label: '술집', r: 1000, terms: ['bar'] },
};
const KIND = {
  cafe: '카페', ice_cream: '아이스크림', bakery: '베이커리', pastry: '디저트', confectionery: '디저트', restaurant: '음식점',
  attraction: '명소', museum: '박물관', gallery: '갤러리', viewpoint: '전망대', theme_park: '테마파크', zoo: '동물원', aquarium: '아쿠아리움',
  park: '공원', garden: '정원', cinema: '영화관', theatre: '공연장', arts_centre: '문화공간', bowling_alley: '볼링장',
  amusement_arcade: '오락실', escape_game: '방탈출', ice_rink: '아이스링크', bar: '바', pub: '펍',
};
const CUISINE = {
  korean: '한식', japanese: '일식', chinese: '중식', italian: '이탈리안', pizza: '피자', burger: '버거', chicken: '치킨',
  sushi: '스시', noodle: '면요리', ramen: '라멘', barbecue: '고기구이', seafood: '해산물', western: '양식',
  thai: '태국 음식', vietnamese: '베트남 음식', indian: '인도 음식', mexican: '멕시칸', french: '프렌치', steak_house: '스테이크', dessert: '디저트',
};
const WX = [
  [0, '☀️', '맑음'], [2, '🌤️', '구름 조금'], [3, '☁️', '흐림'], [48, '🌫️', '안개'], [57, '🌦️', '이슬비'], [67, '🌧️', '비'],
  [77, '🌨️', '눈'], [82, '🌧️', '소나기'], [86, '🌨️', '눈'], [99, '⛈️', '뇌우'],
];
const dv ={ built: false, region: null, cat: 'cafe', status: 'idle', places: [], wx: null, seq: 0, wxSeq: 0 };
const placeCache = {};

async function fetchT(url, opts, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, Object.assign({}, opts, { signal: ctl.signal })); }
  finally { clearTimeout(timer); }
}
function haversine(aLat, aLon, bLat, bLon) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// OpenStreetMap Nominatim: 키 없이 쓰는 대신 요청 간격(초당 1회)을 반드시 지킨다
let nmChain = Promise.resolve(), nmLast = 0;
function nominatim(params) {
  const run = async () => {
    const gap = nmLast + 1100 - Date.now();
    if (gap > 0) await new Promise(r => setTimeout(r, gap));
    nmLast = Date.now();
    const res = await fetchT(`https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ko&${params}`, {}, 15000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const arr = await res.json();
    return Array.isArray(arr) ? arr : [];
  };
  const p = nmChain.then(run, run);
  nmChain = p.catch(() => {});
  return p;
}
const fmtDist = m => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)}m` : `${(m / 1000).toFixed(1)}km`);
const enc = encodeURIComponent;

function enterDate() {
  if (!dv.built) {
    dv.built = true;
    const r = settings.region;
    dv.region = r && typeof r.lat === 'number' && typeof r.lon === 'number' && r.name ? r : PRESETS[0];
    $('#view-date').innerHTML = `
      <div class="sec-head"><h2>데이트 장소 찾기</h2></div>
      <form class="search" data-form="region" novalidate>
        <input type="search" name="q" placeholder="지역 검색 (예: 연남동, 오사카)" autocomplete="off" enterkeyhint="search" maxlength="40">
        <button type="submit" class="btn">검색</button>
      </form>
      <div class="chips" id="date-presets"></div>
      <div class="weather" id="date-weather"></div>
      <div class="chips" id="date-cats"></div>
      <div class="links" id="date-links"></div>
      <div id="date-list"></div>
      <div class="credit">장소 © OpenStreetMap 기여자 · 날씨 Open-Meteo</div>`;
  }
  renderDateChips();
  if (dv.status === 'idle' || dv.status === 'error') loadPlaces();
  if (!dv.wx) loadWeather();
}
function renderDateChips() {
  if (!dv.built) return;
  const r = dv.region;
  const custom = PRESETS.some(p => p.name === r.name) ? '' : `<button type="button" class="chip on">${esc(r.name)}</button>`;
  $('#date-presets').innerHTML = custom + PRESETS.map((p, i) =>
    `<button type="button" class="chip ${p.name === r.name ? 'on' : ''}" data-action="preset" data-i="${i}">${esc(p.name)}</button>`).join('');
  $('#date-cats').innerHTML = Object.keys(CATS).map(k =>
    `<button type="button" class="chip ${k === dv.cat ? 'on' : ''}" data-action="cat" data-k="${k}">${CATS[k].label}</button>`).join('');
  const q = `${r.name} ${CATS[dv.cat].label}`;
  const a = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  $('#date-links').innerHTML =
    a(`https://map.naver.com/p/search/${enc(q)}`, `네이버 지도 · ${q}`) +
    a(`https://map.kakao.com/?q=${enc(q)}`, `카카오맵 · ${q}`) +
    a(`https://www.google.com/maps/search/?api=1&query=${enc(q)}`, '구글 지도에서 보기') +
    a(`https://search.naver.com/search.naver?where=blog&query=${enc(r.name + ' 데이트 코스')}`, '블로그 데이트 코스 후기');
  const on = $('#date-presets .on');
  if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function setRegion(r) {
  dv.region = r; dv.wx = null;
  settings.region = r; saveSettings();
  if (!dv.built) return;
  renderDateChips();
  loadWeather();
  loadPlaces();
}
async function searchRegion(q) {
  q = String(q || '').trim();
  if (!q) return;
  const hit = PRESETS.find(p => p.name === q);
  if (hit) { setRegion(hit); return; }
  toast(`'${q}' 찾는 중…`);
  try {
    const arr = await nominatim(`limit=1&q=${enc(q)}`);
    if (!arr.length || !isFinite(Number(arr[0].lat)) || !isFinite(Number(arr[0].lon))) { toast('지역을 찾지 못했어요. 다른 이름으로 검색해 보세요'); return; }
    setRegion({ name: q, lat: Number(arr[0].lat), lon: Number(arr[0].lon) });
  } catch (e) {
    toast('검색에 실패했어요. 인터넷 연결을 확인해 주세요');
  }
}
async function loadWeather() {
  const r = dv.region, seq = ++dv.wxSeq, el = $('#date-weather');
  if (!el) return;
  el.innerHTML = '';
  try {
    const res = await fetchT(`https://api.open-meteo.com/v1/forecast?latitude=${r.lat}&longitude=${r.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`, {}, 12000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (seq !== dv.wxSeq || !j.daily || !Array.isArray(j.daily.time)) return;
    dv.wx = j.daily;
    el.innerHTML = j.daily.time.map((d, i) => {
      const code = j.daily.weather_code[i];
      const w = WX.find(x => code <= x[0]) || WX[2];
      const rain = j.daily.precipitation_probability_max ? j.daily.precipitation_probability_max[i] : null;
      const label = i === 0 ? '오늘' : i === 1 ? '내일' : `${fmtShort(d)}(${DOW[parseYmd(d).getDay()]})`;
      return `<div class="wx" style="animation-delay:${i * 35}ms" title="${w[2]}">${label}<b>${w[1]}</b><em>${Math.round(j.daily.temperature_2m_max[i])}° / ${Math.round(j.daily.temperature_2m_min[i])}°</em>${rain == null ? w[2] : '비 ' + rain + '%'}</div>`;
    }).join('');
  } catch (e) { /* 날씨는 부가 정보: 실패해도 조용히 넘어감 */ }
}
async function loadPlaces() {
  const r = dv.region, c = dv.cat, cat = CATS[c];
  const key = `${r.lat.toFixed(4)},${r.lon.toFixed(4)},${c}`;
  const seq = ++dv.seq;
  if (placeCache[key]) { dv.places = placeCache[key]; dv.status = 'ok'; renderDateList(); return; }
  dv.status = 'loading'; renderDateList();
  const dLat = cat.r / 111000, dLon = dLat / Math.max(0.2, Math.cos(r.lat * Math.PI / 180));
  const box = [r.lon - dLon, r.lat + dLat, r.lon + dLon, r.lat - dLat].map(n => n.toFixed(5)).join(',');
  const best = {};
  let okCount = 0;
  for (const term of cat.terms) {
    try {
      const arr = await nominatim(`limit=40&extratags=1&bounded=1&viewbox=${box}&q=${enc(term)}`);
      okCount++;
      arr.forEach(x => {
        const name = String(x.name || '').trim(), lat = Number(x.lat), lon = Number(x.lon);
        if (!name || !isFinite(lat) || !isFinite(lon)) return;
        const cuisine = CUISINE[String((x.extratags && x.extratags.cuisine) || '').split(';')[0].trim()] || '';
        const dist = haversine(r.lat, r.lon, lat, lon);
        if (!best[name] || best[name].dist > dist) best[name] = { name, kind: cuisine || KIND[x.type] || cat.label, dist };
      });
    } catch (e) { /* 한 검색어가 실패해도 나머지 결과는 사용 */ }
  }
  if (okCount) placeCache[key] = Object.values(best).sort((a, b) => a.dist - b.dist).slice(0, 40);
  if (seq !== dv.seq) return; // 그 사이 다른 지역/분류를 골랐으면 화면은 건드리지 않음
  if (okCount) { dv.places = placeCache[key]; dv.status = 'ok'; } else dv.status = 'error';
  renderDateList();
}
function renderDateList() {
  const el = $('#date-list');
  if (!el) return;
  if (dv.status === 'loading') { el.innerHTML = '<div class="skel"></div>'.repeat(6); return; }
  if (dv.status === 'error') {
    el.innerHTML = '<div class="empty">주변 장소를 불러오지 못했어요.<br>위의 지도 버튼으로 바로 검색할 수 있어요.<br><button type="button" class="btn ghost" data-action="reload-places">다시 시도</button></div>';
    return;
  }
  if (!dv.places.length) {
    el.innerHTML = '<div class="empty">이 지역은 등록된 장소가 적어요.<br>위의 지도 버튼으로 검색해 보세요.</div>';
    return;
  }
  const rn = dv.region.name;
  el.innerHTML = dv.places.map((p, i) => `
    <div class="place" style="animation-delay:${Math.min(i, 10) * 30}ms">
      <div class="p-main"><b>${esc(p.name)}</b><span>${esc(p.kind)} · ${fmtDist(p.dist)}</span></div>
      <div class="p-act">
        <a class="btn sm ghost" href="https://map.naver.com/p/search/${enc(rn + ' ' + p.name)}" target="_blank" rel="noopener noreferrer">지도</a>
        <button type="button" class="btn sm" data-action="place-add" data-i="${i}">+ 일정</button>
      </div>
    </div>`).join('');
}

/* =====================================================================
   10. 렌더: 설정
   ===================================================================== */
const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /couples/{room}/{document=**} {
      allow read, write: if true;
    }
  }
}`;
let installEvt = null;
function renderSettings() {
  const p = data.profile, me = settings.me, ot = other();
  const sw = k => `<div class="swatches">${PALETTE.map(c =>
    `<button type="button" class="sw ${p.colors[k] === c ? 'on' : ''}" style="--c:${c}" data-action="set-color" data-k="${k}" data-c="${c}" aria-label="색상 ${c}"></button>`).join('')}</div>`;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].indexOf(location.hostname) >= 0;

  const syncCard = cloud.on ? `
      <div class="status-line" id="sync-status" data-s="${cloud.status}"></div>
      <p class="sub" style="margin-bottom:12px">상대방은 아래 초대 링크를 열기만 하면 같은 캘린더에 연결돼요. 아이폰에서 홈 화면에 설치한 뒤라면, 설치한 앱의 설정 화면에 링크를 붙여넣어 주세요.</p>
      <div class="btn-col">
        <button type="button" class="btn block" data-action="share-invite">초대 링크 보내기</button>
        <button type="button" class="btn ghost block" data-action="copy-invite">초대 링크 복사</button>
        <button type="button" class="btn danger block" data-action="disconnect" data-confirm="한 번 더 누르면 연결 해제">연결 해제</button>
      </div>` : `
      <div class="status-line" id="sync-status" data-s="local"></div>
      <div class="guide">
        <p>지금은 이 기기에만 저장돼요. 아래를 한 번만 해 두면 두 사람 화면이 실시간으로 같이 바뀌어요. <b>초대받은 사람은 받은 링크만 붙여넣으면 끝</b>이에요.</p>
        <details class="more" style="margin-top:8px">
          <summary>처음 연결하는 방법 (무료, 약 5분)</summary>
          <ol>
            <li><b>console.firebase.google.com</b> 에서 프로젝트를 만들어요.</li>
            <li>왼쪽 메뉴 <b>빌드 → Firestore Database → 데이터베이스 만들기</b> (위치: asia-northeast3 서울).</li>
            <li>Firestore의 <b>규칙</b> 탭에 아래 내용을 붙여넣고 <b>게시</b>를 눌러요.
              <pre class="code">${esc(RULES)}</pre>
              <button type="button" class="btn sm ghost" data-action="copy-rules">규칙 복사</button></li>
            <li><b>프로젝트 설정(톱니바퀴) → 내 앱 → 웹(&lt;/&gt;)</b> 으로 앱을 추가하면 나오는 <b>firebaseConfig</b> 를 복사해요.</li>
            <li>아래 칸에 붙여넣고 <b>연결하기</b>를 눌러요.</li>
          </ol>
        </details>
      </div>
      <form class="stack" data-form="connect" novalidate style="margin-top:12px">
        <textarea name="cfg" placeholder="firebaseConfig 또는 초대 링크를 붙여넣으세요" autocomplete="off" spellcheck="false"></textarea>
        <button type="submit" class="btn block">연결하기</button>
      </form>`;

  $('#view-settings').innerHTML = `
    <div class="sec-head"><h2>설정</h2></div>
    <div class="card"><h3>프로필</h3>
      <div class="stack">
        <label class="field"><span>내 이름</span><input type="text" maxlength="12" autocomplete="off" value="${esc(p.names[me])}" data-change="name" data-k="${me}" placeholder="나"></label>
        ${sw(me)}
        <label class="field"><span>상대 이름</span><input type="text" maxlength="12" autocomplete="off" value="${esc(p.names[ot])}" data-change="name" data-k="${ot}" placeholder="상대"></label>
        ${sw(ot)}
        <label class="field"><span>처음 만난 날</span><input type="date" value="${esc(p.since)}" data-change="since"></label>
        <div class="field"><span>이 기기를 쓰는 사람</span>
          <div class="seg">
            <label class="o-${me}"><input type="radio" name="whoami" value="${me}" checked data-change="me"><span>${esc(nameOf(me))}</span></label>
            <label class="o-${ot}"><input type="radio" name="whoami" value="${ot}" data-change="me"><span>${esc(nameOf(ot))}</span></label>
          </div>
        </div>
      </div>
    </div>
    <div class="card"><h3>실시간 동기화</h3>${syncCard}</div>
    <div class="card"><h3>홈 화면에 설치</h3>
      <p class="sub">${standalone ? '이미 앱으로 설치되어 실행 중이에요.'
        : !secure ? '설치는 https 주소로 올린 뒤에 할 수 있어요.'
        : '안드로이드: 아래 버튼 또는 브라우저 메뉴 → 앱 설치<br>아이폰: Safari 공유 버튼 → 홈 화면에 추가'}</p>
      ${!standalone && installEvt ? '<button type="button" class="btn block" style="margin-top:12px" data-action="install">앱 설치하기</button>' : ''}
    </div>
    <div class="card"><h3>백업</h3>
      <p class="sub" style="margin-bottom:12px">일정·여행 전체를 파일로 저장해 둘 수 있어요.</p>
      <button type="button" class="btn ghost block" data-action="export">백업 파일 내려받기</button>
    </div>`;
  updateSyncBadge();
}

function openOnboarding(joined) {
  const me = settings.me, p = data.profile;
  openSheet(`
    <form class="stack" data-form="onboard" novalidate>
      <div><h3>${joined ? '초대받은 캘린더에 연결됐어요 💌' : '반가워요 👋'}</h3><p class="sub">이름과 내 색상만 정하면 바로 시작할 수 있어요.</p></div>
      <label class="field"><span>내 이름</span><input type="text" name="name" maxlength="12" autocomplete="off" value="${esc(p.names[me])}" placeholder="예: 민수"></label>
      <div class="field"><span>내 일정 색상</span>
        <div class="swatches">${PALETTE.map(c => `<label class="sw" style="--c:${c}"><input type="radio" name="color" value="${c}" ${p.colors[me] === c ? 'checked' : ''}></label>`).join('')}</div>
      </div>
      <button type="submit" class="btn block">시작하기</button>
    </form>`, { onboard: true });
}

/* =====================================================================
   11. 이벤트 처리
   ===================================================================== */
async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e2) { /* 무시 */ }
    ta.remove();
  }
  toast(okMsg);
}

const actions = {
  'tab': t => switchTab(t.dataset.tab),
  'go-settings': () => switchTab('settings'),
  'close-layer': () => closeLayers(1),
  'fab': () => { if (state.tab === 'trips') openTripSheet(); else openEventSheet(); },

  // 캘린더
  'today': () => {
    userMoved = true;
    goToday(true);
    popCell(todayStr());
  },
  'filter': t => { state.filter = t.dataset.v; renderCal(); },
  'pick-day': t => {
    const d = t.dataset.date;
    if (!isYmd(d)) return;
    state.sel = d;
    renderCal();
    popCell(d);
    openDaySheet(d);
  },
  'add-event': () => openEventSheet(),
  'edit-event': t => { const e = data.events[t.dataset.id]; if (e) openEventSheet(e); },
  'del-event': () => { if (sheetCtx && sheetCtx.doc && delDoc('events', sheetCtx.doc.id)) closeLayers(1); },

  // 여행
  'new-trip': () => openTripSheet(),
  'open-trip': t => {
    const id = t.dataset.id;
    if (sheetEl) closeLayers(1); // 하루 일정 시트에서 눌렀으면 시트를 먼저 닫고 연다
    openTrip(id);
  },
  'edit-trip': () => { const t = data.trips[state.trip]; if (t) openTripSheet(t); },
  'del-trip': () => {
    if (!sheetCtx || !sheetCtx.doc || !canWrite()) return;
    const id = sheetCtx.doc.id;
    itemsOf(id).forEach(i => delDoc('items', i.id));
    delDoc('trips', id);
    closeLayers(layers.length);
  },
  'trip-seg': t => { state.tripSeg = t.dataset.v; state.anim.list = true; renderTrip(); },
  'trip-day': t => { state.tripDay = Number(t.dataset.i) || 0; state.anim.list = true; renderTrip(); },
  'toggle-item': t => { const i = data.items[t.dataset.id]; if (i) putDoc('items', Object.assign({}, i, { done: !i.done })); },
  'del-item': t => delDoc('items', t.dataset.id),
  'trip-reco': () => {
    const t = data.trips[state.trip];
    if (!t) return;
    const q = t.dest || t.title;
    closeLayers(layers.length);
    switchTab('date');
    searchRegion(q);
  },

  // 데이트
  'preset': t => { const p = PRESETS[Number(t.dataset.i)]; if (p) setRegion(p); },
  'cat': t => { if (CATS[t.dataset.k]) { dv.cat = t.dataset.k; renderDateChips(); loadPlaces(); } },
  'reload-places': () => loadPlaces(),
  'place-add': t => {
    const p = dv.places[Number(t.dataset.i)];
    if (p) openEventSheet(null, { title: p.name, place: `${dv.region.name} ${p.name}`, type: 'date', owner: 'both' });
  },

  // 설정
  'set-color': t => { setProfile({ colors: { [t.dataset.k]: t.dataset.c } }); renderSettings(); },
  'copy-rules': () => copyText(RULES, '규칙을 복사했어요'),
  'copy-invite': () => copyText(inviteLink(), '초대 링크를 복사했어요'),
  'share-invite': () => {
    const url = inviteLink();
    if (navigator.share) navigator.share({ title: '우리 캘린더', text: '우리 캘린더에 초대할게 💌', url }).catch(() => {});
    else copyText(url, '초대 링크를 복사했어요');
  },
  'disconnect': () => {
    settings.fb = null; settings.room = ''; settings.migratedRoom = ''; settings.pendingProfile = null;
    saveSettings();
    location.reload();
  },
  'install': async () => {
    if (!installEvt) return;
    const evt = installEvt; installEvt = null;
    evt.prompt();
    try { await evt.userChoice; } catch (e) { /* 무시 */ }
    if (state.tab === 'settings') renderSettings();
  },
  'export': () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `우리캘린더-백업-${todayStr()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
};

const forms = {
  event: (f, fd) => {
    if (!sheetCtx || !sheetCtx.doc) return;
    const title = String(fd.get('title') || '').trim();
    if (!title) { shake(f.elements.title); return; }
    const date = isYmd(fd.get('date')) ? fd.get('date') : sheetCtx.doc.date;
    let endDate = isYmd(fd.get('endDate')) ? fd.get('endDate') : '';
    if (endDate <= date) endDate = '';
    if (endDate && diffDays(date, endDate) > 366) { toast('일정은 최대 1년까지 등록할 수 있어요'); return; }
    const owner = ['a', 'b', 'both'].indexOf(fd.get('owner')) >= 0 ? fd.get('owner') : settings.me;
    const doc = Object.assign({}, sheetCtx.doc, {
      title, date, endDate, owner,
      time: String(fd.get('time') || ''),
      type: fd.get('type') === 'date' ? 'date' : 'normal',
      place: String(fd.get('place') || '').trim(),
      memo: String(fd.get('memo') || '').trim(),
    });
    if (!putDoc('events', doc)) return;
    if (state.filter !== 'all' && !passFilter(doc)) state.filter = 'all';
    jumpTo(date);
    if (sheetCtx.isNew && doc.type === 'date') burstHearts();
    closeLayers(1);
  },
  trip: (f, fd) => {
    if (!sheetCtx || !sheetCtx.doc) return;
    const title = String(fd.get('title') || '').trim();
    if (!title) { shake(f.elements.title); return; }
    const start = isYmd(fd.get('start')) ? fd.get('start') : sheetCtx.doc.start;
    let end = isYmd(fd.get('end')) ? fd.get('end') : start;
    if (end < start) end = start;
    if (diffDays(start, end) > 59) { toast('여행은 최대 60일까지 등록할 수 있어요'); return; }
    const doc = Object.assign({}, sheetCtx.doc, {
      title, start, end,
      dest: String(fd.get('dest') || '').trim(),
      memo: String(fd.get('memo') || '').trim(),
    });
    if (!putDoc('trips', doc)) return;
    closeLayers(1);
  },
  item: (f, fd) => {
    const t = data.trips[state.trip];
    if (!t) return;
    const text = String(fd.get('text') || '').trim();
    if (!text) { shake(f.elements.text); return; }
    const plan = state.tripSeg === 'plan';
    const ok = putDoc('items', {
      id: uid(), tripId: t.id, kind: plan ? 'plan' : 'check', day: plan ? state.tripDay : 0,
      time: plan ? String(fd.get('time') || '') : '', text, done: false, by: settings.me, createdAt: Date.now(),
    });
    if (!ok) return;
    f.elements.text.value = ''; f.elements.time.value = '';
    f.elements.text.focus();
  },
  region: (f, fd) => {
    const q = String(fd.get('q') || '').trim();
    if (!q) { shake(f.elements.q); return; }
    f.elements.q.blur();
    searchRegion(q);
  },
  connect: (f, fd) => {
    const text = String(fd.get('cfg') || '');
    const inv = parseInvite(text);
    if (inv) { applyInvite(inv); location.reload(); return; }
    const cfg = parseFbConfig(text);
    if (!cfg) {
      shake(f.elements.cfg);
      toast(text.indexOf('join=') >= 0 ? '초대 링크가 잘렸어요. 링크 전체를 다시 복사해 주세요'
        : /apiKey|projectId|appId/.test(text) ? 'apiKey · projectId · appId 줄이 모두 들어가게 복사해 주세요'
        : 'firebaseConfig 또는 초대 링크를 붙여넣어 주세요');
      return;
    }
    settings.fb = cfg; settings.room = randomRoom(); settings.migratedRoom = ''; settings.pendingProfile = null;
    saveSettings();
    location.reload();
  },
  onboard: (f, fd) => {
    const name = String(fd.get('name') || '').trim().slice(0, 12);
    if (!name) { shake(f.elements.name); return; }
    const color = PALETTE.indexOf(fd.get('color')) >= 0 ? fd.get('color') : data.profile.colors[settings.me];
    settings.onboarded = true; saveSettings();
    setProfile({ names: { [settings.me]: name }, colors: { [settings.me]: color } });
    closeLayers(1);
  },
};

function bindEvents() {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const fn = actions[t.dataset.action];
    if (!fn) return;
    if (t.dataset.confirm !== undefined && !t.classList.contains('armed')) {
      const label = t.textContent;
      t.classList.add('armed');
      t.textContent = t.dataset.confirm || '한 번 더 누르면 삭제';
      setTimeout(() => { if (t.isConnected) { t.classList.remove('armed'); t.textContent = label; } }, 2600);
      return;
    }
    fn(t, e);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = forms[f.dataset.form];
    if (fn) fn(f, new FormData(f));
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.change === 'name') setProfile({ names: { [t.dataset.k]: t.value.trim().slice(0, 12) } });
    else if (t.dataset.change === 'since') setProfile({ since: isYmd(t.value) ? t.value : '' });
    else if (t.dataset.change === 'me') { settings.me = t.value === 'b' ? 'b' : 'a'; saveSettings(); renderHeader(); renderSettings(); }
    else if (t.name === 'type' && t.value === 'date' && sheetCtx && sheetCtx.isNew && t.form) {
      const both = t.form.querySelector('input[name="owner"][value="both"]');
      if (both) both.checked = true;
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && layers.length) closeLayers(1); });

  // 달력 세로 스크롤: 끝에 가까워지면 달을 이어 붙이고, 상단 제목을 현재 달로 갱신
  $('#main').addEventListener('scroll', onMainScroll, { passive: true });
  ['touchstart', 'wheel', 'pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { userMoved = true; }, { passive: true, capture: true }));

  // 키보드가 올라올 때 시트가 가려지지 않게
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const fit = () => document.documentElement.style.setProperty('--kb', Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + 'px');
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
  }

  // 앱이 열린 상태에서 초대 링크로 들어온 경우
  window.addEventListener('hashchange', () => {
    if (location.hash.indexOf('join=') < 0) return;
    const before = settings.room;
    handleJoinHash();
    if (settings.room !== before) location.reload();
    else if (bootToast) { toast(bootToast); bootToast = ''; }
  });
  window.addEventListener('online', () => { if (cloud.on && !cloud.ready) connectCloud(); });
  window.addEventListener('offline', () => { if (cloud.ready && cloud.status === 'on') setStatus('offline'); });
  // 다른 앱에 갔다가 돌아오면(10초 이상) 달력을 다시 오늘로
  let hiddenAt = 0;
  const onReturn = () => {
    scheduleRender();
    if (hiddenAt && Date.now() - hiddenAt > 10000 && state.tab === 'cal' && !layers.length) settleToday();
    hiddenAt = 0;
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else onReturn(); });
  window.addEventListener('pageshow', e => { if (e.persisted) { hiddenAt = hiddenAt || 1; onReturn(); } });
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvt = e;
    if (state.tab === 'settings') renderSettings();
  });
  window.addEventListener('appinstalled', () => { installEvt = null; if (state.tab === 'settings') renderSettings(); });
}

/* =====================================================================
   12. 시작
   ===================================================================== */
function boot() {
  try { history.replaceState({ cc: 0 }, ''); } catch (e) { histOK = false; }
  const hadRoom = settings.room;
  handleJoinHash();
  cloud.on = !!(settings.fb && settings.fb.projectId && settings.room);
  applyTheme();
  buildTabbar();
  bindEvents();
  switchTab('cal');
  renderHeader();
  if (cloud.on) connectCloud();
  if (!settings.onboarded) openOnboarding(cloud.on && settings.room !== hadRoom);
  if (bootToast) toast(bootToast);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
boot();
})();
