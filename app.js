'use strict';
const $ = (s) => document.querySelector(s);
const screen = $('#screen'), lock = $('#lock'), pass = $('#pass'), home = $('#home'), app = $('#app');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let ENC, DATA, code = '';

/* ---- 크기 맞추기 ---- */
const fit = () => document.getElementById('phone').style.setProperty('--s', Math.min((innerWidth - 40) / 430, (innerHeight - 30) / 900, 1.25));
addEventListener('resize', fit); fit();

/* ---- 화면 전환 ---- */
function show(name) {
  for (const [id, el] of [['lock', lock], ['pass', pass], ['home', home]]) el.classList.toggle('hidden', id !== name);
  app.classList.add('hidden'); app.className = 'layer hidden';
  screen.className = name === 'lock' ? 'st-lock' : '';
}
function relock() { DATA = null; app.innerHTML = ''; code = ''; show('lock'); }
$('#power').onclick = relock;

/* ---- 잠금 화면: 탭 또는 위로 쓸기 ---- */
lock.onpointerup = () => openPass();
$('#hind').onclick = () => { if (!app.classList.contains('hidden')) closeApp(); else if (!lock.classList.contains('hidden')) openPass(); };
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !app.classList.contains('hidden')) return closeApp();
  if (pass.classList.contains('hidden')) return;
  if (ENC.len && /^\d$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace' && ENC.len) del();
  else if (e.key === 'Enter' && !ENC.len) attempt($('#pwText').value);
});

/* ---- 암호 ---- */
function openPass() {
  code = ''; drawDots(); show('pass');
  if (!ENC.len) { $('#pwText').value = ''; $('#pwText').focus(); }
}
function drawDots() {
  $('#pwDots').innerHTML = Array.from({ length: ENC.len }, (_, i) => `<i class="${i < code.length ? 'on' : ''}"></i>`).join('');
  $('#pwCancel').textContent = code ? '삭제' : '취소';
}
function press(d) { if (code.length >= ENC.len) return; code += d; drawDots(); if (code.length === ENC.len) attempt(code); }
function del() { code = code.slice(0, -1); drawDots(); }
$('#pwCancel').onclick = () => (code ? del() : show('lock'));
async function attempt(c) {
  try {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(c), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(ENC.salt), iterations: ENC.iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(ENC.iv) }, key, b64(ENC.ct));
    DATA = JSON.parse(new TextDecoder().decode(pt));
    goHome();
  } catch {
    const d = $('#pwDots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
    code = ''; setTimeout(drawDots, 450);
    if (!ENC.len) $('#pwText').value = '';
  }
}
$('#pwPad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, ''].map((k) => (k === '' ? '<span></span>' : `<button data-k="${k}">${k}</button>`)).join('');
$('#pwPad').onclick = (e) => { const k = e.target.dataset.k; if (k !== undefined) press(k); };

/* ---- 아이콘 ---- */
const G = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const ICON = {
  phone: `<defs>${G('gp', '#5ee27a', '#1db944')}</defs><rect width="60" height="60" fill="url(#gp)"/><path transform="translate(15 15) scale(1.25)" fill="#fff" d="M6.6 10.8c1.400 2.800 3.800 5.100 6.600 6.600l2.200-2.200c.3-.3.700-.4 1-.2 1.100.4 2.300.6 3.600.6.600 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.600 21 3 13.400 3 4c0-.6.4-1 1-1h3.500c.6 0 1 .4 1 1 0 1.300.2 2.500.6 3.600.1.3 0 .7-.2 1l-2.300 2.200z"/>`,
  msg: `<defs>${G('gm', '#5ee27a', '#1db944')}</defs><rect width="60" height="60" fill="url(#gm)"/><ellipse cx="30" cy="28" rx="19" ry="15" fill="#fff"/><path d="M16 40c1 3-1 6-4 7 5 1 10-1 13-4z" fill="#fff"/>`,
  photos: `<rect width="60" height="60" fill="#fff"/>${['#f7d34a', '#f59e42', '#ef5d5d', '#c05cc9', '#5e7be0', '#45b7e8', '#4cc27a', '#a5d84c'].map((c, i) => `<ellipse cx="30" cy="18" rx="7" ry="12" fill="${c}" opacity=".8" transform="rotate(${i * 45} 30 30)" style="mix-blend-mode:multiply"/>`).join('')}`,
  camera: `<defs>${G('gc', '#d4d4d9', '#9a9aa0')}</defs><rect width="60" height="60" fill="url(#gc)"/><rect x="11" y="19" width="38" height="25" rx="6" fill="#222"/><rect x="22" y="15" width="16" height="6" rx="3" fill="#222"/><circle cx="30" cy="31.500" r="8.500" fill="#555"/><circle cx="30" cy="31.500" r="5.500" fill="#111"/>`,
  web: `<rect width="60" height="60" fill="#fff"/><circle cx="30" cy="30" r="19" fill="none" stroke="#1a82f7" stroke-width="3"/><path d="M38 22L33 33 22 38 27 27z" fill="#f33"/><path d="M38 22L33 33 27 27z" fill="#1a82f7" opacity=".9"/>`,
  cal: `<rect width="60" height="60" fill="#fff"/><text x="30" y="17" text-anchor="middle" font-size="10" font-weight="700" fill="#ff3b30">월</text><text x="30" y="46" text-anchor="middle" font-size="32" font-weight="300" fill="#111">31</text>`,
  clock: `<rect width="60" height="60" fill="#000"/><circle cx="30" cy="30" r="24" fill="#fff"/><path d="M30 14v16l9 6" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M30 10v3M30 47v3M10 30h3M47 30h3" stroke="#333" stroke-width="2"/>`,
  maps: `<defs>${G('gmp', '#8fe3a1', '#5cc7e8')}</defs><rect width="60" height="60" fill="url(#gmp)"/><path d="M0 44L60 22" stroke="#fff" stroke-width="7"/><path d="M26 0L38 60" stroke="#f7d27a" stroke-width="5"/><circle cx="32" cy="27" r="7" fill="#ff3b30"/><circle cx="32" cy="27" r="2.500" fill="#fff"/>`,
  weather: `<defs>${G('gw', '#3b8cf0', '#7cc6ff')}</defs><rect width="60" height="60" fill="url(#gw)"/><circle cx="22" cy="24" r="9" fill="#ffd83b"/><ellipse cx="34" cy="38" rx="16" ry="9" fill="#fff"/><circle cx="27" cy="34" r="8" fill="#fff"/>`,
  notes: `<rect width="60" height="60" fill="#fff"/><rect width="60" height="16" fill="#ffd60a"/><path d="M10 28h40M10 38h40M10 48h40" stroke="#e5e5ea" stroke-width="2"/>`,
  settings: `<defs>${G('gs', '#b9b9bf', '#7d7d83')}</defs><rect width="60" height="60" fill="url(#gs)"/><circle cx="30" cy="30" r="15" fill="none" stroke="#4a4a4f" stroke-width="7" stroke-dasharray="5 4.500"/><circle cx="30" cy="30" r="10" fill="#4a4a4f"/><circle cx="30" cy="30" r="4.500" fill="#a0a0a6"/>`,
};
const icon = (k) => `<svg viewBox="0 0 60 60">${ICON[k]}</svg>`;

/* ---- 홈 화면 ---- */
const APPS = [['cal', '캘린더'], ['photos', '사진', 'photos'], ['clock', '시계'], ['maps', '지도'], ['weather', '날씨'], ['notes', '메모'], ['settings', '설정']];
const DOCK = [['phone', '전화', 'phone'], ['web', '인터넷'], ['msg', '메시지', 'msg'], ['camera', '카메라']];
const tile = ([k, n, open]) => `<button class="ap" ${open ? `data-open="${open}"` : ''} aria-label="${n}">${icon(k)}<span>${n}</span></button>`;
function goHome() {
  show('home');
  home.innerHTML = `<div class="grid">${APPS.map(tile).join('')}</div><div class="dots"><i></i><i></i></div><div class="dock">${DOCK.map(tile).join('')}</div>`;
}
home.onclick = (e) => { const b = e.target.closest('[data-open]'); if (b) openApp(b.dataset.open); };

/* ---- 앱 열고 닫기 ---- */
let st = {};
function openApp(name) {
  st = { name, tab: name === 'phone' ? 'recent' : 'lib' };
  app.className = `layer pre ${name === 'msg' ? 'msgs' : name}`; app.classList.remove('hidden');
  screen.classList.add('dark');
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('pre')));
}
function closeApp() { app.classList.add('hidden'); screen.classList.remove('dark'); app.innerHTML = ''; }
function go(patch) { Object.assign(st, patch); render(); }
app.onclick = (e) => {
  const t = e.target.closest('[data-go]'); if (!t) return;
  const patch = JSON.parse(t.dataset.go);
  go(patch);
};
const g = (o) => `data-go='${JSON.stringify(o)}'`;
const back = (label, o) => `<div class="nav"><button class="back" ${g(o)}><svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" stroke="#0a84ff" stroke-width="2.600" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${label}</button></div>`;
const avatar = (n) => `<div class="av">${esc(n.trim()[0])}</div>`;
function render() { ({ phone: phoneApp, msg: msgApp, photos: photosApp })[st.name](); }

/* ---- 전화 ---- */
const SVG = {
  star: 'M12 2l3 6.500 7 .8-5.200 4.800 1.500 7L12 17.500 5.700 21l1.500-7L2 9.300l7-.8z',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zm1 4v5.200l4 2.300-.8 1.300L11 13V7z',
  person: 'M12 12a4.500 4.500 0 100-9 4.500 4.500 0 000 9zm0 2c-4.400 0-8 2.200-8 5v2h16v-2c0-2.800-3.600-5-8-5z',
  keypad: 'M6 3a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zM6 9.500a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zM6 16a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4zm6 0a2 2 0 100 4 2 2 0 000-4z',
  vm: 'M7 7a5 5 0 100 10h10a5 5 0 100-10 5 5 0 00-4.600 7H11.600A5 5 0 007 7z',
  call: 'M6.600 10.800c1.400 2.800 3.800 5.100 6.600 6.600l2.200-2.200c.3-.3.7-.4 1-.2 1.100.4 2.300.6 3.600.6.600 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.600 21 3 13.400 3 4c0-.6.4-1 1-1h3.500c.6 0 1 .4 1 1 0 1.300.2 2.500.6 3.600.1.3 0 .7-.2 1z',
  msg: 'M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H9l-5 4v-4a2 2 0 01-2-2V6a2 2 0 012-2z',
  video: 'M3 6h12a2 2 0 012 2v2l5-3v10l-5-3v2a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2z',
  mail: 'M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm1 2l8 6 8-6',
  photo: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm3 12h10l-3.500-5-2.500 3-1.500-2z',
  folder: 'M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  trash: 'M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z',
};
const sv = (k) => `<svg viewBox="0 0 24 24"><path d="${SVG[k]}"/></svg>`;
const tabbar = (tabs, cur) => `<div class="tabbar glass">${tabs.map(([id, n, ic]) => `<button class="${cur === id ? 'on' : ''}" ${g({ tab: id, i: null, v: null })}>${sv(ic)}<span>${n}</span></button>`).join('')}</div>`;
const outArrow = '<svg width="13" height="13" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" stroke="#8a8a8e" stroke-width="2.500" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function phoneApp() {
  const tabs = [['fav', '즐겨찾기', 'star'], ['recent', '최근 기록', 'clock'], ['contacts', '연락처', 'person'], ['keypad', '키패드', 'keypad'], ['vm', '음성 사서함', 'vm']];
  const sorted = [...DATA.contacts].sort((a, b) => a.localeCompare(b, 'ko'));
  let body;
  if (st.i != null) {
    const c = DATA.calls[st.i];
    const act = [['msg', '메시지'], ['call', '통화'], ['video', '비디오'], ['mail', '메일']].map(([i, n]) => `<div>${sv(i)}${n}</div>`).join('');
    app.innerHTML = `${back('최근 기록', { i: null })}<div class="scr"><div class="cd">${avatar(c.name)}<h2>${esc(c.name)}</h2></div><div class="acts">${act}</div>
      <div class="list"><div class="kv"><b>${esc(c.day)}</b><small>${c.time ? esc(c.time) + ' · ' : ''}${c.dir === 'out' ? '발신 전화' : '수신 전화'}${c.dur ? ' · ' + esc(c.dur) : ''}</small></div></div></div>`;
    return;
  }
  if (st.tab === 'recent') {
    body = `<h1 class="lg">최근 기록</h1><div class="seg"><span class="on">전체</span><span>부재중</span></div><div class="list">${DATA.calls.map((c, i) => `
      <button class="row" ${g({ i })}><div class="rb"><b>${esc(c.name)}</b><small>${c.dir === 'out' ? outArrow : ''}휴대전화</small></div><div class="rt">${esc(c.list)}<span class="info">i</span></div></button>`).join('')}</div>`;
  } else if (st.tab === 'contacts') {
    body = `<h1 class="lg">연락처</h1><div class="list">${sorted.map((n) => `<div class="row">${avatar(n)}<div class="rb"><b>${esc(n)}</b></div></div>`).join('')}</div>`;
  } else if (st.tab === 'keypad') {
    const n = st.num || '';
    body = `<div class="kp-num">${esc(n)}</div><div class="kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((k) => `<button ${g({ num: n + k })}>${k}</button>`).join('')}</div><div class="call">${sv('call')}</div>`;
  } else {
    body = `<div class="empty">${st.tab === 'fav' ? '즐겨찾기 없음' : '음성 사서함 없음'}<small>${st.tab === 'fav' ? '' : '서비스 없음'}</small></div>`;
  }
  app.innerHTML = `<div class="scr">${body}</div>${tabbar(tabs, st.tab)}`;
}

/* ---- 메시지 ---- */
function msgApp() {
  if (st.i != null) {
    const t = DATA.threads[st.i]; let last = '';
    const items = t.msgs.map((m) => {
      const dv = m.day !== last ? `<div class="dv">${esc(m.day)}</div>` : ''; last = m.day;
      return `${dv}<div class="bw ${m.from}"><div class="bb">${esc(m.text)}</div>${m.time ? `<time>${esc(m.time)}</time>` : ''}</div>`;
    }).join('');
    app.innerHTML = `<div class="thread"><div class="nav"><button class="back" ${g({ i: null })}><svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" stroke="#0a84ff" stroke-width="2.600" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      <div class="tavatar">${avatar(t.name)}<small>${esc(t.name)}</small></div><div class="tscroll">${items}</div>
      <div class="compose"><i class="glass"></i><span class="glass">메시지</span></div></div>`;
    return;
  }
  app.innerHTML = `<div class="scr"><h1 class="lg">메시지</h1><div class="list" style="background:transparent;margin:0">${DATA.threads.map((t, i) => {
    const m = t.msgs[t.msgs.length - 1];
    return `<button class="row msg" ${g({ i })}>${avatar(t.name)}<div class="rb"><b>${esc(t.name)}</b><p>${esc(m.text)}</p></div><div class="rt">${esc(t.list)}${t.unread ? '<span class="dot"></span>' : ''}</div></button>`;
  }).join('')}</div></div>`;
}

/* ---- 사진 ---- */
function photosApp() {
  const tabs = [['lib', '보관함', 'photo'], ['col', '컬렉션', 'folder']];
  const n = DATA.trash.length;
  if (st.v != null) {
    app.innerHTML = `${back('최근 삭제', { v: null })}<div class="viewer"><div class="vp"><div class="pic"></div></div><div class="vcap">${esc(DATA.trash[st.v].deleted)}</div><div class="vbar"><span>복구</span><span>삭제</span></div></div>`;
    return;
  }
  if (st.tab === 'trash') {
    app.innerHTML = `${back('컬렉션', { tab: 'col' })}<div class="scr"><h1 class="lg">최근 삭제</h1><div class="pgrid">${DATA.trash.map((_, i) => `<button ${g({ v: i })}><div class="pic"></div><span class="days">30일</span></button>`).join('')}</div>
      <div class="note">사진 및 비디오는 30일 동안 이곳에 보관된 후 영구적으로 삭제됩니다.</div></div>`;
    return;
  }
  const body = st.tab === 'col'
    ? `<h1 class="lg">컬렉션</h1><div class="hdr">유틸리티</div><div class="list"><button class="alb" ${g({ tab: 'trash' })}>${sv('trash')}최근 삭제<em>${n}</em></button></div>`
    : `<h1 class="lg">보관함</h1><div class="empty">사진 또는 비디오 없음<small>iPhone으로 사진과 비디오를 찍으면 여기에 표시됩니다.</small></div>`;
  app.innerHTML = `<div class="scr">${body}</div>${tabbar(tabs, st.tab)}`;
}

/* ---- 시작 ---- */
fetch('data.enc.json').then((r) => r.json()).then((j) => { ENC = j; show('lock'); });
