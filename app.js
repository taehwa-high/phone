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
let cur;
function show(name) {
  cur = name;
  for (const [id, el] of [['lock', lock], ['pass', pass], ['home', home]]) {
    if (id === name) { el.classList.remove('hidden', 'fade'); void el.offsetWidth; el.classList.add('fade'); el.style.zIndex = 2; }
    else { el.style.zIndex = 1; setTimeout(() => { if (cur !== id) el.classList.add('hidden'); }, 400); } // 새 화면이 페이드로 덮인 뒤 이전 화면 숨김
  }
  app.classList.add('hidden'); app.className = 'layer hidden';
  screen.className = name === 'lock' ? 'st-lock' : '';
}
/* ---- 공유 기록: 보낸 문자·찍은 사진이 모든 사람 폰에 남음 (Supabase phone_log 표) ---- */
const SB = 'https://uqxsqolcidnypqnxmcwo.supabase.co/rest/v1/phone_log', SBH = { apikey: 'sb_publishable_AxXOh5W_XIvEu6QjUbQyOQ_Ph4FLcse', 'Content-Type': 'application/json' };
let lastId = 0, posting = 0;
function addRow(r) {
  if (DATA.photos.some((p) => p.id === r.id) || DATA.threads.some((t) => t.msgs.some((m) => m.id === r.id))) return;
  if (r.kind === 'photo') return DATA.photos.push({ img: r.img, taken: r.taken, id: r.id });
  let t = DATA.threads.find((x) => x.name === r.thread);
  if (!t) { t = { name: r.thread, list: '', msgs: [] }; DATA.threads.unshift(t); }
  t.msgs.push({ from: 'me', day: '오늘', text: r.body, time: r.taken, fail: 1, id: r.id }); t.list = r.taken;
}
async function sync() {
  if (!DATA || posting) return;
  try {
    const [rows, alive] = await Promise.all([`${SB}?id=gt.${lastId}&order=id`, `${SB}?kind=eq.photo&select=id`].map(async (u) => (await fetch(u, { headers: SBH, cache: 'no-store' })).json()));
    if (!DATA || posting || !Array.isArray(rows) || !Array.isArray(alive)) return;
    // 다른 사람이 지운 사진은 내 폰에서도 사라짐 (원래 있던 사진은 id가 없어 그대로)
    const ids = new Set(alive.map((r) => r.id)), before = DATA.photos.length;
    DATA.photos = DATA.photos.filter((p) => !p.id || ids.has(p.id));
    const gone = DATA.photos.length !== before;
    if (gone && st.name === 'photos') st.v = null;
    if (!rows.length && !gone) return;
    rows.forEach(addRow); if (rows.length) lastId = rows[rows.length - 1].id;
    if (st.name === 'msg' || st.name === 'photos') { const sc = $('.tscroll'), y = sc && sc.scrollTop, inp = $('.compose input'), v = inp && inp.value; render(); if (inp) { $('.compose input').value = v; } if (sc && $('.tscroll')) $('.tscroll').scrollTop = $('.tscroll').scrollHeight; }
  } catch { /* 연결 안 되면 다음 확인 때 다시 */ }
}
setInterval(sync, 4000);
async function post(row, local) {
  posting++;
  try {
    const [r] = await (await fetch(SB, { method: 'POST', headers: { ...SBH, Prefer: 'return=representation' }, body: JSON.stringify(row) })).json();
    local.id = r.id;
    // 내가 올린 것 앞에 남이 올린 게 있으면 놓치지 않게 lastId는 sync가 올림
  } catch { /* 저장 실패해도 내 화면엔 남음 */ }
  posting--;
}
function relock() { lastId = 0; unlocked.clear(); stopPlay(); DATA = null; app.innerHTML = ''; code = ''; show('lock'); }
$('#power').onclick = relock;

/* ---- 잠금 화면: 탭 또는 위로 쓸기 ---- */
let y0 = null;
lock.onpointerdown = (e) => { y0 = e.clientY; lock.style.transition = 'none'; };
lock.onpointermove = (e) => { if (y0 == null) return; const dy = Math.min(0, e.clientY - y0); lock.style.transform = `translateY(${dy}px)`; lock.style.opacity = 1 + dy / 400; };
lock.onpointerup = (e) => {
  const dy = y0 == null ? 0 : e.clientY - y0; y0 = null;
  lock.style.transition = 'transform .25s,opacity .25s'; lock.style.transform = ''; lock.style.opacity = '';
  if (dy < -50 || Math.abs(dy) < 8) openPass(); // 위로 쓸거나 탭하면 열림, 아래로 끌면 제자리
};
/* ---- 시계: 매일 밤 10:30(한국 시각)에 오전 8:30으로 초기화, 그 뒤 실제 시간만큼 흐름 (모든 방문자 같은 시각) ---- */
const DAY = 864e5, KST = 9 * 36e5, RESET = 22.5 * 36e5;
let AP = '오전';
const clock = () => { const m = (510 + Math.floor(((Date.now() + KST - RESET) % DAY + DAY) % DAY / 60000)) % 1440; AP = m < 720 ? '오전' : '오후'; const t = `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')}`; $('#sl').textContent = t; $('.lk-time').textContent = t; $('#poTime').textContent = t; };
setInterval(clock, 5000); clock();
$('#hind').onclick = () => { if (!app.classList.contains('hidden')) closeApp(); else if (!lock.classList.contains('hidden')) openPass(); };
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !app.classList.contains('hidden')) return closeApp();
  if (st.name === 'photos' && st.v != null && /^Arrow(Left|Right)$/.test(e.key)) return flip(e.key === 'ArrowRight' ? 1 : -1);
  if (pass.classList.contains('hidden')) return;
  if (ENC.len && /^\d$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace' && ENC.len) del();
  else if (e.key === 'Enter' && !ENC.len) attempt($('#pwText').value);
});

/* ---- 암호 ---- */
// 실패 횟수·잠금: 모든 방문자가 공유(Supabase phone_lock 표, 계산은 서버 함수라 기기 시계와 무관).
// 기본 3회 실패에서 시작, 5회부터 틀릴 때마다 1분 잠금, 누가 암호를 맞히면 다시 3회로
const SBL = SB.replace('phone_log', 'phone_lock'), SBS = SB.replace('phone_log', 'rpc/phone_lock_state');
let fails = 3, until = 0, lockT;
const lockedOut = () => Date.now() < until;
function drawFails() {
  const lo = lockedOut(); pass.classList.toggle('out', lo);
  $('#lkNoti').classList.toggle('hidden', !fails); $('#lkNotiTxt').textContent = `암호를 ${fails}회 잘못 입력했습니다.`; // 아이폰처럼 잠금 화면 알림으로
  clearTimeout(lockT); if (lo) lockT = setTimeout(drawFails, until - Date.now() + 50);
}
async function pullLock() {
  try {
    const r = await (await fetch(SBS, { method: 'POST', headers: SBH, body: '{}', cache: 'no-store' })).json();
    if (typeof r.fails !== 'number') return;
    fails = r.fails; until = r.wait > 0 ? Date.now() + r.wait * 1000 : 0; drawFails();
  } catch { /* 연결 안 되면 지금 상태 유지 */ }
}
const pushLock = (ok) => fetch(SBL, { method: 'POST', headers: SBH, body: JSON.stringify({ ok }) }).then(pullLock, () => {});
drawFails(); pullLock(); setInterval(() => { if (!DATA) pullLock(); }, 3000);
function openPass() {
  code = ''; drawDots(); show('pass');
  $('#pwPad').classList.toggle('hidden', !ENC.len); $('#pwText').classList.toggle('hidden', !!ENC.len);
  if (!ENC.len) { $('#pwText').value = ''; $('#pwText').focus(); }
}
function drawDots() {
  $('#pwDots').innerHTML = Array.from({ length: ENC.len }, (_, i) => `<i class="${i < code.length ? 'on' : ''}"></i>`).join('');
  $('#pwCancel').textContent = code ? '삭제' : '취소';
}
function press(d) { if (lockedOut() || code.length >= ENC.len) return; code += d; drawDots(); if (code.length === ENC.len) attempt(code); }
function del() { code = code.slice(0, -1); drawDots(); }
$('#pwCancel').onclick = () => (code ? del() : show('lock'));
async function attempt(c) {
  if (lockedOut()) return;
  try {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(c), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(ENC.salt), iterations: ENC.iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(ENC.iv) }, key, b64(ENC.ct));
    DATA = JSON.parse(new TextDecoder().decode(pt));
  } catch {
    DATA = null;
  }
  if (DATA) { pushLock(true); lastId = 0; await sync(); return goHome(); }
  {
    const d = $('#pwDots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
    code = ''; setTimeout(drawDots, 450);
    if (!ENC.len) $('#pwText').value = '';
    if (++fails >= 5) until = Date.now() + 60000; // 서버 답 오기 전에 바로 반영
    pushLock(false);
    setTimeout(drawFails, 450);
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
// 실제 앱 아이콘(앱스토어 공식 이미지). 캘린더(오늘 날짜 표시)·전화·설정은 직접 그린 것 유지
const ICON_URL = {
  kakao: 'Purple221/v4/57/29/03/572903d9-dde2-3750-92e0-5c43f5822f3f/AppIcon-0-0-1x_U007epad-0-0-0-1-0-0-sRGB-85-220.png',
  naver: 'Purple221/v4/68/48/00/68480028-fc16-1661-a947-cd4b727bfe39/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-0-85-220.png',
  youtube: 'Purple211/v4/82/43/be/8243be7f-17c3-33ae-720a-ffcde48bed61/logo_youtube_2024_q4_color-0-0-1x_U007emarketing-0-0-0-7-0-0-0-85-220.png',
  insta: 'Purple221/v4/44/b0/cc/44b0cc3a-e91f-2824-d98f-3e5e095a73f3/Prod-0-0-1x_U007epad-0-0-0-1-0-0-sRGB-85-220.png',
  hiclass: 'Purple221/v4/85/28/29/852829dc-36c8-e77f-08ba-f20010b8aad0/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png',
  cool: 'Purple211/v4/66/7f/ce/667fce92-29e1-beb1-4200-6d888497c8a6/AppIcon-0-0-1x_U007emarketing-0-11-0-0-85-220.png',
  ealimi: 'Purple211/v4/a0/59/d4/a059d44f-9d01-5ea2-00b9-81e611b0becf/ealimi-AppIcon-0-0-1x_U007emarketing-0-6-85-220.png',
  band: 'Purple211/v4/3a/9b/ca/3a9bcac6-6d0a-d0b5-a1ce-92148c120c44/pumpkin-0-0-1x_U007epad-0-0-0-1-0-0-85-220.png',
  run: 'Purple221/v4/c5/18/1e/c5181ed9-14c4-af84-d580-35438a4c7b53/AppIconProd-0-0-1x_U007ephone-0-1-0-85-220.png',
  carrot: 'Purple211/v4/58/42/24/58422462-4525-61e1-3fb5-426c880701ef/AppIcon-0-0-1x_U007ephone-0-1-85-220.png',
  toss: 'Purple221/v4/a6/14/86/a61486b9-aa38-7e88-43dd-cff5f5f8b6e9/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png',
  kbank: 'Purple221/v4/b6/29/64/b6296447-20d3-0a74-2141-6e2ff327ac1b/AppIcon_real-0-0-1x_U007ephone-0-1-0-85-220.png',
  coupang: 'Purple221/v4/a6/57/6c/a6576ca9-0239-3505-b6c2-2894b1a519f8/AppIcon-0-0-1x_U007emarketing-0-11-0-sRGB-85-220.png',
  baemin: 'Purple211/v4/a5/25/af/a525af37-1e7e-36f3-3df8-f551bf1acd30/AppIcon-Default-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png',
  clock: 'Purple211/v4/c0/8e/d2/c08ed244-21b1-9bce-7199-2417712ae123/clockCalistoga-0-0-1x_U007epad-0-1-0-85-220.png',
  maps: 'Purple211/v4/98/53/2e/98532ed4-879d-02f7-5021-84082f28593e/mapsCalistoga-0-0-1x_U007epad-0-1-0-85-220.png',
  notes: 'Purple211/v4/e8/53/65/e853659a-0888-7264-743e-0e3875d1505f/notesCalistoga-0-0-1x_U007epad-0-1-85-220.png',
  weather: 'Purple211/v4/66/d6/cf/66d6cf2c-91a7-6c10-8bd6-54b2dc7b558e/weatherCalistoga-0-0-1x_U007epad-0-1-0-85-220.png',
  fitness: 'Purple221/v4/5b/48/75/5b487566-14e4-804f-609b-1a57e7d69c78/fitnessCalistoga-0-0-1x_U007epad-0-1-0-sRGB-85-220.png',
  music: 'Purple211/v4/d5/45/38/d5453893-7719-0067-ed45-1de44d0d8eb9/musicValkyrie-0-0-1x_U007epad-0-1-0-85-220.png',
  web: 'Purple211/v4/9b/4a/12/9b4a12c2-7ea9-9e38-4d4f-f1342b310519/safariCalistoga-0-0-1x_U007epad-0-1-0-85-220.png',
  photos: 'Purple221/v4/72/6e/79/726e7943-4a7d-091d-3c55-1d46477cdf08/photosCalistoga-0-0-1x_U007epad-0-1-0-85-220.png',
  camera: 'Purple211/v4/fd/d6/b2/fdd6b24d-071d-b41d-045c-b72aa99cf9fa/cameraCalistoga-0-0-1x_U007epad-0-1-0-85-220.png',
  health: 'Purple221/v4/c4/38/d1/c438d148-1fe2-67a3-c768-6158621cc13f/healthCalistoga-0-0-1x_U007epad-0-1-0-85-220.png',
  voice: 'Purple221/v4/6c/83/7e/6c837e02-a3f3-d035-1d29-436281c11d08/voice.memosCalistoga-0-0-1x_U007epad-0-1-0-85-220.png',
  msg: 'Purple221/v4/fc/8d/32/fc8d32a0-86a7-83d8-7045-57b4b3e71a0b/messagesCalistoga-0-0-1x_U007epad-0-1-0-85-220.png',
};
const icon = (k) => ICON_URL[k] ? `<img class="aicon" src="https://is1-ssl.mzstatic.com/image/thumb/${ICON_URL[k]}/180x180bb.png" alt="">` : `<svg viewBox="0 0 60 60">${ICON[k]}</svg>`;

/* ---- 홈 화면 ---- */
// 체육 교사(34세) 폰다운 앱. 로고는 실제 로고를 베끼지 않고 색·글자로만 비슷하게
const T = (bg, txt, fg = '#fff', fs = 22, fw = 800) => `<rect width="60" height="60" fill="${bg}"/><text x="30" y="${30 + fs * .36}" text-anchor="middle" font-size="${fs}" font-weight="${fw}" fill="${fg}" font-family="-apple-system,'Apple SD Gothic Neo',sans-serif">${txt}</text>`;
Object.assign(ICON, {
  kakao: `<rect width="60" height="60" fill="#fee500"/><ellipse cx="30" cy="28" rx="18" ry="14" fill="#3a1d1d"/><path d="M20 38l-2 8 8-5z" fill="#3a1d1d"/><text x="30" y="32" text-anchor="middle" font-size="10" font-weight="800" fill="#fee500" font-family="sans-serif">TALK</text>`,
  naver: T('#03c75a', 'N', '#fff', 30, 900),
  youtube: `<rect width="60" height="60" fill="#fff"/><rect x="10" y="17" width="40" height="27" rx="8" fill="#ff0000"/><path d="M26 24v13l11-6.500z" fill="#fff"/>`,
  insta: `<defs><linearGradient id="gi" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".35" stop-color="#fa7e1e"/><stop offset=".65" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><rect width="60" height="60" fill="url(#gi)"/><rect x="15" y="15" width="30" height="30" rx="9" fill="none" stroke="#fff" stroke-width="3.500"/><circle cx="30" cy="30" r="7" fill="none" stroke="#fff" stroke-width="3.500"/><circle cx="39" cy="21" r="2" fill="#fff"/>`,
  hiclass: T('#2f6bff', '하이', '#fff', 18),
  cool: T('#1a9be6', '쿨', '#fff', 26),
  ealimi: T('#ff8a00', 'e', '#fff', 34, 700),
  band: T('#06c755', 'b', '#fff', 32, 900),
  health: `<rect width="60" height="60" fill="#fff"/><path d="M30 46S13 35 13 24a8.500 8.500 0 0117-3 8.500 8.500 0 0117 3c0 11-17 22-17 22z" fill="#ff2d55"/>`,
  fitness: `<rect width="60" height="60" fill="#000"/><circle cx="30" cy="30" r="19" fill="none" stroke="#fa114f" stroke-width="5"/><circle cx="30" cy="30" r="13" fill="none" stroke="#92e82a" stroke-width="5"/><circle cx="30" cy="30" r="7" fill="none" stroke="#1eeaef" stroke-width="5"/>`,
  run: T('#111', 'RUN', '#fff', 17, 900),
  toss: T('#fff', 'T', '#0064ff', 32, 900),
  kbank: T('#fee500', 'bank', '#3a1d1d', 15, 800),
  coupang: T('#fff', '쿠팡', '#c4302b', 17, 800),
  baemin: T('#2ac1bc', '배민', '#fff', 18, 800),
  carrot: T('#ff6f0f', '당근', '#fff', 17, 800),
  music: T('#fa2d48', '♪', '#fff', 30, 700),
});
const APPS = [['cal', '캘린더', 'cal'], ['photos', '사진', 'photos'], ['camera', '카메라', 'cam'], ['clock', '시계', 'clock'],
  ['kakao', '카카오톡', 'net'], ['naver', '네이버', 'net'], ['youtube', 'YouTube', 'net'], ['insta', 'Instagram', 'net'],
  ['hiclass', '하이클래스', 'net'], ['cool', '쿨메신저', 'net'], ['ealimi', 'e알리미', 'net'], ['band', '밴드', 'net'],
  ['health', '건강', 'net'], ['fitness', '피트니스', 'net'], ['run', '런클럽', 'net'], ['voice', '음성 메모', 'voice'],
  ['toss', '토스', 'net'], ['kbank', '카카오뱅크', 'net'], ['coupang', '쿠팡', 'net'], ['baemin', '배달의민족', 'net'],
  ['weather', '날씨', 'net'], ['maps', '지도', 'net'], ['notes', '메모', 'notes'], ['settings', '설정', 'settings']];
const DOCK = [['phone', '전화', 'phone'], ['web', 'Safari', 'net'], ['msg', '메시지', 'msg'], ['music', '음악', 'net']];
const tile = ([k, n, open]) => `<button class="ap" data-k="${k}" ${open ? `data-open="${open}"` : ''} aria-label="${n}">${icon(k)}<span>${n}</span></button>`;
function goHome(toCam = true) {
  show('home');
  home.innerHTML = `<div class="grid">${APPS.map(tile).join('')}</div><div class="spill">${sv('search')}검색</div><div class="dock">${DOCK.map(tile).join('')}</div>`;
  if (toCam) openCam(); // 잠금 해제 직후엔 카메라가 켜져 있던 상태
}
const CORE = ['phone', 'msg', 'photos', 'cal', 'notes', 'voice'];
home.onclick = (e) => {
  const b = e.target.closest('[data-open]'); if (!b) return;
  const o = b.dataset.open, k = APPS.concat(DOCK).find((a) => a[0] === b.dataset.k);
  if (o === 'cam') return openCam();
  if (CORE.includes(o)) return openApp(o);
  openApp('stub'); go({ k: k[0], n: k[1], kind: o, splash: o === 'net' });
};

/* ---- 앱 열고 닫기 ---- */
let st = {};
function openApp(name) {
  st = { name, tab: name === 'phone' ? 'recent' : 'lib' };
  app.className = `layer pre ${name === 'msg' ? 'msgs' : name}`; app.classList.remove('hidden');
  screen.classList.add('dark');
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => app.classList.remove('pre')));
}
function openCam() {
  st = { name: 'cam' }; app.className = 'layer cam';
  app.innerHTML = `<canvas class="vf" id="vf" width="402" height="544"></canvas><div class="cm-top"><span>⚡︎</span><span>⌃</span><span>◎</span></div>
    <div class="cm-zoom">${['.5', '1×', '2'].map((z, i) => `<button data-cam="zoom" class="${i === 1 ? 'on' : ''}">${z}</button>`).join('')}</div>
    <div class="cm-modes">${['비디오', '사진', '인물 사진'].map((m) => `<button data-cam="mode" class="${m === '사진' ? 'on' : ''}">${m}</button>`).join('')}</div>
    <div class="cm-bar"><button class="th" data-cam="th" aria-label="최근 사진">${DATA.photos.length ? `<img src="${DATA.photos[DATA.photos.length - 1].img}" alt="">` : ''}</button><button class="sh" data-cam="sh" aria-label="촬영"></button><button class="fl" data-cam="fl" aria-label="카메라 전환">⟲</button></div>`;
  camLoop();
}
/* 렌즈가 깨진 카메라: 흐릿한 빛 번짐 + 노이즈 + 가끔 화면 찢김 + 유리 금 */
const CRACK = (() => {
  let sd = 31; const R = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const p = new Path2D(), cx = 250, cy = 190, rays = [];
  for (let i = 0; i < 15; i++) {
    let a = (i / 15) * Math.PI * 2 + R() * .3, x = cx, y = cy; const pts = [[x, y]], len = 120 + R() * 420;
    p.moveTo(x, y);
    for (let d = 0; d < len;) { const st = 14 + R() * 30; d += st; a += (R() - .5) * .5; x += Math.cos(a) * st; y += Math.sin(a) * st; p.lineTo(x, y); pts.push([x, y]);
      if (R() < .12) { const b = a + (R() < .5 ? -1 : 1) * (.5 + R() * .6), bl = 20 + R() * 60; p.moveTo(x, y); p.lineTo(x + Math.cos(b) * bl, y + Math.sin(b) * bl); p.moveTo(x, y); } }
    rays.push(pts);
  }
  [1, 3].forEach((k) => { rays.forEach((r, i) => { const q = rays[(i + 1) % rays.length]; if (r[k] && q[k]) { p.moveTo(...r[k]); p.lineTo(...q[k]); } }); });
  return p;
})();
const noise = document.createElement('canvas'); noise.width = 201; noise.height = 272;
function camFrame(c, t) {
  const x = c.getContext('2d'), w = c.width, h = c.height;
  x.fillStyle = '#16171c'; x.fillRect(0, 0, w, h);
  [[.3, .25, 160, 'rgba(255,214,170,.22)'], [.75, .7, 200, 'rgba(120,140,190,.18)'], [.5, .55, 120, 'rgba(255,255,240,.12)']].forEach(([px, py, r, col], i) => {
    const gx = px * w + Math.sin(t / 1500 + i) * 18, gy = py * h + Math.cos(t / 1900 + i) * 14, gr = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  const n = noise.getContext('2d'), d = n.createImageData(201, 272);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 45; }
  n.putImageData(d, 0, 0); x.imageSmoothingEnabled = false; x.drawImage(noise, 0, 0, w, h);
  if (Math.random() < .18) for (let k = 0; k < 1 + Math.random() * 3; k++) { const sy = Math.random() * h, sh = 4 + Math.random() * 30; x.drawImage(c, 0, sy, w, sh, (Math.random() - .5) * 40, sy, w, sh); }
  if (Math.random() < .06) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,40,80' : '40,255,200'},.15)`; x.fillRect(0, Math.random() * h, w, 3 + Math.random() * 12); }
  x.lineJoin = 'round'; x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 2.4; x.stroke(CRACK);
  x.strokeStyle = 'rgba(235,240,255,.55)'; x.lineWidth = 1; x.stroke(CRACK);
  const sp = x.createRadialGradient(250, 190, 0, 250, 190, 26); sp.addColorStop(0, 'rgba(255,255,255,.5)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = sp; x.fillRect(220, 160, 60, 60);
}
function camLoop() { const c = $('#vf'); if (!c || st.name !== 'cam') return; camFrame(c, performance.now()); setTimeout(() => requestAnimationFrame(camLoop), 50); }
function shoot() {
  const c = document.createElement('canvas'); c.width = 302; c.height = 408;
  c.getContext('2d').drawImage($('#vf'), 0, 0, 302, 408);
  const img = c.toDataURL('image/jpeg', .6), p = { img, taken: `2033년 10월 31일 ${AP} ${$('#sl').textContent}` };
  DATA.photos.push(p); $('.cm-bar .th').innerHTML = `<img src="${img}" alt="">`;
  post({ kind: 'photo', img, taken: p.taken }, p);
}
function camTap(b) {
  const k = b.dataset.cam;
  if (k === 'zoom' || k === 'mode') { b.parentNode.querySelector('.on').classList.remove('on'); b.classList.add('on'); }
  if (k === 'mode') $('.cm-bar .sh').classList.toggle('rec', b.textContent === '비디오');
  if (k === 'fl') { const v = $('.vf'); v.classList.remove('flip'); void v.offsetWidth; v.classList.add('flip'); }
  if (k === 'sh') { const v = $('.vf'); v.classList.remove('snap'); void v.offsetWidth; v.classList.add('snap'); shoot(); } // 찍은 사진은 사진첩에 쌓이고 다른 사람 폰에도 남음
  if (k === 'th') openApp('photos');
}
function closeApp() {
  stopPlay();
  clearTimeout(callT); const was = st.name; st = {};
  app.classList.add('pre'); screen.classList.remove('dark');
  setTimeout(() => { if (st.name) return; app.classList.add('hidden'); app.innerHTML = ''; }, was === 'cam' ? 0 : 250); // 닫히는 사이 다른 앱을 열었으면 그대로 둠
}
function go(patch) { Object.assign(st, patch); render(); }
app.onclick = (e) => {
  const c = e.target.closest('[data-cam]'); if (c) return camTap(c);
  const d = e.target.closest('[data-do]'); if (d) return doAct(d.dataset.do, d.dataset.n);
  const t = e.target.closest('[data-go]'); if (!t) return;
  const patch = JSON.parse(t.dataset.go);
  go(patch);
};
// 연락처·통화 기록의 메시지 버튼 → 그 사람과의 대화방(없으면 새 대화)
function doAct(k, n) {
  if (k === 'msg') { const i = DATA.threads.findIndex((t) => t.name === n); openApp('msg'); go(i >= 0 ? { i } : { i: -1, nn: n }); }
  if (k === 'vplay' || k === 'vback' || k === 'vfwd') return vAct(k);
  if (k === 'retry') { sendFail(DATA.threads[st.i].msgs[n]); go({ sheet: null }); }
  if (k === 'delphoto') { // 새로 찍은 사진만 삭제 가능, 모든 사람 폰에서 지워짐
    const p = DATA.photos[st.v]; if (!p || !p.id) return;
    DATA.photos.splice(st.v, 1); go({ v: null, sheet: null });
    fetch(`${SB}?id=eq.${p.id}`, { method: 'DELETE', headers: SBH }).catch(() => {});
  }
}
// 서비스 없음: 잠깐 '전송 중' → 실패. 잠그거나 새로고침하면 보낸 문자는 사라짐
function sendFail(m) {
  m.fail = 0; m.sending = 1;
  setTimeout(() => { m.sending = 0; m.fail = 1; if (st.name === 'msg' && st.i != null) render(); }, 1800);
}
app.onsubmit = (e) => {
  if (e.target.classList.contains('nlock')) { // 잠긴 메모 암호
    e.preventDefault(); const n = DATA.notes[st.n];
    if (e.target.querySelector('input').value === n.lock) { unlocked.add(st.n); go({ bad: null }); } else go({ bad: 1 });
    return;
  }
  e.preventDefault(); const inp = e.target.querySelector('input'), text = inp.value.trim(); if (!text) return;
  if (st.i === -1) { DATA.threads.unshift({ name: st.nn, list: '', msgs: [] }); st.i = 0; }
  const t = DATA.threads[st.i], now = $('#sl').textContent;
  const m = { from: 'me', day: '오늘', text, time: `${AP} ${now}` }; t.msgs.push(m); t.list = `${AP} ${now}`;
  sendFail(m); render(); post({ kind: 'msg', thread: t.name, body: text.slice(0, 500), taken: m.time }, m); $('.compose input').focus();
};
let callT;
const g = (o) => `data-go='${JSON.stringify(o)}'`;
const back = (label, o) => `<div class="nav"><button class="back" ${g(o)}><svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" stroke="#0a84ff" stroke-width="2.600" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>${label}</button></div>`;
const avatar = (n) => `<div class="av">${esc(n.trim()[0])}</div>`;
function render() { ({ phone: phoneApp, msg: msgApp, photos: photosApp, cal: calApp, stub: stubApp, notes: notesApp, voice: voiceApp })[st.name](); }

/* ---- 메모: 잠긴 메모는 암호(140915)를 넣어야 보임. 폰을 잠그면 다시 잠김 ---- */
const unlocked = new Set();
function notesApp() {
  const N = DATA.notes || [];
  if (st.n == null) {
    app.innerHTML = `<div class="scr"><h1 class="lg">메모</h1><div class="hdr">${N.length}개의 메모</div><div class="list">${N.map((n, i) => {
      const lk = n.lock && !unlocked.has(i), first = n.body.split('\n').find((l) => l.trim()) || '';
      return `<button class="row" ${g({ n: i })}><div class="rb"><b>${n.lock ? '🔒 ' : ''}${esc(n.title)}</b><small>${esc(n.date)}&nbsp; ${lk ? '잠김' : esc(first)}</small></div></button>`;
    }).join('')}</div></div>`;
    return;
  }
  const n = N[st.n];
  if (n.lock && !unlocked.has(st.n)) {
    app.innerHTML = `${back('메모', { n: null, bad: null })}<div class="nlocked"><div class="lk">🔒</div><b>이 메모는 잠겨 있습니다</b><small>이 메모를 보려면 메모 암호를 입력하십시오.</small>
      <form class="nlock"><input type="password" inputmode="numeric" placeholder="암호" autocomplete="off" aria-label="메모 암호"><button>확인</button></form><p class="bad">${st.bad ? '암호가 올바르지 않습니다.' : ''}</p></div>`;
    $('.nlock input').focus();
    return;
  }
  app.innerHTML = `${back('메모', { n: null })}<div class="scr memo"><small>${esc(n.date)}</small><h2>${esc(n.title)}</h2><p>${esc(n.body)}</p></div>`;
}

/* ---- 음성 메모: 재생하면 녹음 시각에 맞춰 대사가 한 줄씩 나타남(소리 없음) ---- */
let playT = null, playAt = 0;
function stopPlay() { clearInterval(playT); playT = null; }
const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
function voiceApp() {
  const V = DATA.voice || [];
  app.innerHTML = `<div class="scr"><h1 class="lg">모든 녹음</h1><div class="list">${V.map((v, i) => {
    const open = st.p === i;
    return `<div class="vm${open ? ' open' : ''}"><button class="vm-h" ${g({ p: open ? null : i })}><b>${esc(v.title)}</b><small>${esc(v.date)} ${esc(v.time)}<span>${mmss(v.dur)}</span></small></button>
      ${open ? `<div class="vm-bar"><i id="vmFill"></i></div><div class="vm-t"><span id="vmCur">0:00</span><span id="vmLeft">-${mmss(v.dur)}</span></div>
      <div class="vm-ctl"><button data-do="vback" aria-label="15초 뒤로">↺<small>15</small></button><button class="vm-play" data-do="vplay" aria-label="재생">▶</button><button data-do="vfwd" aria-label="15초 앞으로">↻<small>15</small></button></div>
      <div class="vm-tx" id="vmTx"><small>재생하면 녹음 내용이 여기에 표시됩니다.</small></div>` : ''}</div>`;
  }).join('')}</div></div>`;
  stopPlay(); playAt = 0;
}
function vDraw() {
  const v = DATA.voice[st.p], f = $('#vmFill'); if (!f) return stopPlay();
  f.style.width = `${(playAt / v.dur) * 100}%`; $('#vmCur').textContent = mmss(playAt); $('#vmLeft').textContent = `-${mmss(v.dur - playAt)}`;
  const shown = v.lines.filter((l) => l.t <= playAt), tx = $('#vmTx');
  if (tx.dataset.n !== String(shown.length)) {
    tx.dataset.n = shown.length;
    tx.innerHTML = shown.length ? shown.map((l) => l.who ? `<p><b>${esc(l.who)}</b>${esc(l.text)}</p>` : `<p class="sfx">${esc(l.text)}</p>`).join('') : '<small>재생하면 녹음 내용이 여기에 표시됩니다.</small>';
    tx.scrollTop = tx.scrollHeight;
  }
  $('.vm-play').textContent = playT ? '❚❚' : '▶';
}
function vAct(k) {
  const v = DATA.voice[st.p];
  if (k === 'vplay') { if (playT) stopPlay(); else { if (playAt >= v.dur) playAt = 0; playT = setInterval(() => { playAt = Math.min(v.dur, playAt + .25); if (playAt >= v.dur) stopPlay(); vDraw(); }, 250); } }
  if (k === 'vback') playAt = Math.max(0, playAt - 15);
  if (k === 'vfwd') playAt = Math.min(v.dur, playAt + 15);
  vDraw();
}
/* 나머지 앱: 서비스 없음이라 인터넷 앱은 로딩 후 오프라인 안내, 기본 앱은 간단한 화면 */
let splashT;
function stubApp() {
  clearTimeout(splashT); screen.classList.add('dark');
  if (st.splash) {
    app.innerHTML = `<div class="splash">${icon(st.k)}</div>`;
    splashT = setTimeout(() => { if (st.name === 'stub' && st.splash) go({ splash: false }); }, 900);
    return;
  }
  if (st.kind === 'net') {
    app.innerHTML = `<div class="offline">${icon(st.k)}<b>인터넷에 연결되어 있지 않습니다</b><small>셀룰러 데이터 또는 Wi‑Fi에 연결한 후<br>다시 시도해 주세요.</small><button ${g({ splash: true })}>다시 시도</button></div>`;
  } else if (st.kind === 'clock') {
    const body = st.tab === 'alarm'
      ? `<h1 class="lg">알람</h1><div class="list">${(DATA.alarms || []).map((a) => `<div class="row al${a.on ? '' : ' off'}"><div class="rb"><div class="wc"><small>${a.ap}</small>${a.t}</div><small>${esc(a.label)}, ${a.rep}</small></div><i class="sw${a.on ? ' on' : ''}"></i></div>`).join('')}</div>`
      : `<h1 class="lg">세계 시계</h1><div class="list"><div class="row"><div class="rb"><small>오늘, +0시간</small><b style="font-size:22px;font-weight:400">서울</b></div><div class="wc">${$('#sl').textContent}<small>${AP}</small></div></div></div>`;
    app.innerHTML = `<div class="scr">${body}</div>${tabbar([['world', '세계 시계', 'globe'], ['alarm', '알람', 'clock']], st.tab === 'alarm' ? 'alarm' : 'world')}`;
  } else if (st.kind === 'notes') {
    app.innerHTML = `<div class="scr"><h1 class="lg">메모</h1><div class="empty">메모 없음</div></div>`;
  } else {
    const r = (t, v, c) => `<div class="row"><i class="si" style="background:${c}"></i><div class="rb"><b style="font-weight:400">${t}</b></div><div class="rt" style="align-self:center">${v} ›</div></div>`;
    app.innerHTML = `<div class="scr"><h1 class="lg">설정</h1><div class="list"><div class="row">${avatar('남우혜')}<div class="rb"><b>남우혜</b><small>Apple 계정, iCloud 및 기타 항목</small></div><div class="rt">›</div></div></div>
      <div class="list" style="margin-top:20px">${r('에어플레인 모드', '', '#ff9500')}${r('Wi‑Fi', '끔', '#0a84ff')}${r('Bluetooth', '켬', '#0a84ff')}${r('셀룰러', '서비스 없음', '#34c759')}${r('개인용 핫스팟', '끔', '#34c759')}</div>
      <div class="list" style="margin-top:20px">${r('알림', '', '#ff3b30')}${r('사운드 및 햅틱', '', '#ff2d55')}${r('집중 모드', '', '#5e5ce6')}${r('스크린 타임', '', '#5e5ce6')}</div>
      <div class="list" style="margin-top:20px">${r('일반', '', '#8e8e93')}${r('배터리', '', '#34c759')}${r('개인정보 보호 및 보안', '', '#0a84ff')}</div></div>`;
  }
}

/* ---- 전화 ---- */
const SVG = {
  star: 'M12 2l3 6.500 7 .8-5.200 4.800 1.500 7L12 17.500 5.700 21l1.500-7L2 9.300l7-.8z',
  globe: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8 8 0 010-4h3.4a16 16 0 000 4zm.8 2h3a15 15 0 001.4 3.9A8 8 0 015.1 16zm3-8h-3a8 8 0 014.4-3.9A15 15 0 008.1 8zM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14 14 0 010-4h4.6a14 14 0 010 4zm.3 5.9a15 15 0 001.4-3.9h3a8 8 0 01-4.4 3.9zm1.8-5.9a16 16 0 000-4h3.4a8 8 0 010 4zm-.4-6a15 15 0 00-1.4-3.9A8 8 0 0118.9 8z',
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
SVG.search = 'M10 3a7 7 0 015.600 11.200l4.600 4.600-1.400 1.400-4.600-4.600A7 7 0 1110 3zm0 2a5 5 0 100 10 5 5 0 000-10z';
const sv = (k) => `<svg viewBox="0 0 24 24"><path d="${SVG[k]}"/></svg>`;
const tabbar = (tabs, cur) => `<div class="tabbar glass">${tabs.map(([id, n, ic]) => `<button class="${cur === id ? 'on' : ''}" ${g({ tab: id, i: null, v: null })}>${sv(ic)}<span>${n}</span></button>`).join('')}</div>`;
const outArrow = '<svg width="13" height="13" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" stroke="#8a8a8e" stroke-width="2.500" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function phoneApp() {
  const tabs = [['fav', '즐겨찾기', 'star'], ['recent', '최근 기록', 'clock'], ['contacts', '연락처', 'person'], ['keypad', '키패드', 'keypad'], ['vm', '음성 사서함', 'vm']];
  const sorted = [...DATA.contacts].sort((a, b) => a.localeCompare(b, 'ko'));
  screen.classList.toggle('dark', !st.calling);
  let body;
  if (st.calling) {
    const fail = st.cs === 'fail';
    app.innerHTML = `<div class="calling"><h2>${esc(st.calling)}</h2><p>${fail ? '통화 실패' : '휴대전화 연결 중…'}</p>${fail ? '<small>셀룰러 서비스를 사용할 수 없습니다</small>' : ''}
      <div class="cbtns">${fail ? `<button ${g({ calling: null, cs: null })}><i>✕</i>취소</button><button ${g({ cs: null, calling: st.calling })}><i class="g">${sv('call')}</i>다시 걸기</button>`
        : `<button ${g({ calling: null })}><i class="r">${sv('call')}</i>종료</button>`}</div></div>`;
    clearTimeout(callT);
    if (!fail) callT = setTimeout(() => { if (st.calling) go({ cs: 'fail' }); }, 2200);
    return;
  }
  clearTimeout(callT);
  const acts = (n) => `<div class="acts"><button data-do="msg" data-n="${esc(n)}">${sv('msg')}메시지</button><button ${g({ calling: n })}>${sv('call')}통화</button><button ${g({ calling: n })}>${sv('video')}비디오</button><button class="off">${sv('mail')}메일</button></div>`;
  const dirTxt = (c) => c.dir === 'out' ? '발신 전화' : c.dir === 'miss' ? '부재중 전화' : '수신 전화';
  if (st.c != null) {
    const mine = DATA.calls.filter((c) => c.name === st.c);
    app.innerHTML = `${back('연락처', { c: null })}<div class="scr"><div class="cd">${avatar(st.c)}<h2>${esc(st.c)}</h2></div>${acts(st.c)}
      ${mine.length ? `<div class="hdr">최근 통화</div><div class="list">${mine.map((c) => `<div class="kv"><b style="font-size:15px">${esc(c.day)}</b><small>${c.time ? esc(c.time) + ' · ' : ''}${dirTxt(c)}${c.dur ? ' · ' + esc(c.dur) : ''}</small></div>`).join('')}</div>` : ''}</div>`;
    return;
  }
  if (st.i != null) {
    const c = DATA.calls[st.i];
    app.innerHTML = `${back('최근 기록', { i: null, t: null })}<div class="scr"><div class="cd">${avatar(c.name)}<h2>${esc(c.name)}</h2></div>${acts(c.name)}
      <div class="list"><div class="kv"><b>${esc(c.day)}</b><small>${c.time ? esc(c.time) + ' · ' : ''}${dirTxt(c)}${c.dur ? ' · ' + esc(c.dur) : ''}</small></div></div>
      ${c.dir === 'miss' || !c.dur ? '' : `<div class="list" style="margin-top:14px"><button class="row" ${g({ t: st.t ? 0 : 1 })}><svg width="22" height="22" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="#0a84ff"/></svg><div class="rb"><b style="font-weight:500">통화 녹음</b></div></button>
      ${st.t ? `<div class="kv" style="border-top:.5px solid var(--sep)">${c.rec ? c.rec.map((r) => `<small>${esc(r.who)}</small><b style="font-weight:400;margin-bottom:8px">${esc(r.text)}</b>`).join('') : '<small>재생할 수 없는 녹음입니다.</small>'}</div>` : ''}</div>`}</div>`;
    return;
  }
  if (st.tab === 'recent') {
    body = `<h1 class="lg">최근 기록</h1><div class="seg"><button class="${st.f ? '' : 'on'}" ${g({ f: 0 })}>전체</button><button class="${st.f ? 'on' : ''}" ${g({ f: 1 })}>부재중</button></div><div class="list">${DATA.calls.map((c, i) => c.dir === 'miss' || !st.f ? `
      <button class="row" ${g({ i })}><div class="rb"><b${c.dir === 'miss' ? ' style="color:#ff3b30"' : ''}>${esc(c.name)}</b><small>${c.dir === 'out' ? outArrow : ''}휴대전화</small></div><div class="rt">${esc(c.list)}<span class="info">i</span></div></button>` : '').join('')}</div>`;
  } else if (st.tab === 'contacts') {
    body = `<h1 class="lg">연락처</h1><div class="list">${sorted.map((n) => `<button class="row" ${g({ c: n })}>${avatar(n)}<div class="rb"><b>${esc(n)}</b></div></button>`).join('')}</div>`;
  } else if (st.tab === 'keypad') {
    const n = st.num || '';
    body = `<div class="kpw"><div class="kp-num">${esc(n)}</div><div class="kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((k) => `<button ${g({ num: n + k })}>${k}</button>`).join('')}</div><div class="kp-act"><span></span><button class="call" ${n ? g({ calling: n }) : ''} aria-label="통화">${sv('call')}</button>${n ? `<button class="kdel" ${g({ num: n.slice(0, -1) })} aria-label="삭제">⌫</button>` : '<span></span>'}</div></div>`;
  } else {
    body = `<div class="empty">${st.tab === 'fav' ? '즐겨찾기 없음' : '음성 사서함 없음'}<small>${st.tab === 'fav' ? '' : '서비스 없음'}</small></div>`;
  }
  app.innerHTML = `<div class="scr">${body}</div>${tabbar(tabs, st.tab)}`;
}

/* ---- 메시지 ---- */
function msgApp() {
  if (st.i != null) {
    const t = st.i === -1 ? { name: st.nn, msgs: [] } : DATA.threads[st.i]; let last = '';
    const items = t.msgs.map((m) => {
      const dv = m.day !== last ? `<div class="dv">${esc(m.day)}</div>` : ''; last = m.day;
      return `${dv}<div class="bw ${m.from}"><div class="bb">${esc(m.text)}</div>${m.fail ? `<button class="fail" ${g({ sheet: t.msgs.indexOf(m) })} aria-label="전송되지 않음">!</button>` : m.sending ? '' : m.time ? `<time>${esc(m.time)}</time>` : ''}</div>${m.fail ? '<div class="failtxt">전송되지 않음</div>' : m.sending ? '<div class="sendtxt">전송 중…</div>' : ''}`;
    }).join('');
    app.innerHTML = `<div class="thread"><div class="nav"><button class="back" ${g({ i: null })}><svg width="12" height="20" viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" stroke="#0a84ff" stroke-width="2.600" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      <div class="tavatar">${avatar(t.name)}<small>${esc(t.name)}</small></div><div class="tscroll">${items}</div>
      <form class="compose"><i class="glass">+</i><input class="glass" placeholder="문자 메시지" autocomplete="off" enterkeyhint="send" aria-label="메시지"><button class="snd" aria-label="보내기">↑</button></form>
      ${st.sheet != null ? `<div class="sheet-bg" ${g({ sheet: null })}></div><div class="sheet"><div class="sh-box"><small>메시지가 전송되지 않았습니다.</small><button data-do="retry" data-n="${st.sheet}">다시 시도</button></div><button class="sh-cancel" ${g({ sheet: null })}>취소</button></div>` : ''}</div>`;
    const sc = $('.tscroll'); sc.scrollTop = sc.scrollHeight; // 실제처럼 최신 메시지부터 보이게
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
  const P = DATA.photos, img = (p) => `<img src="${p.img}">`;
  if (st.v != null) {
    app.innerHTML = `${back('보관함', { v: null })}<div class="viewer"><div class="vp" id="vp">${img(P[st.v])}</div><div class="vcap"><b>${esc(P[st.v].taken)}</b></div><div class="vbar"><span>${sv('photo')}</span><span class="vcnt">${P.length - st.v} / ${P.length}</span>${P[st.v].id ? `<button ${g({ sheet: 1 })} aria-label="삭제">${sv('trash')}</button>` : `<span class="off">${sv('trash')}</span>`}</div>
      ${st.sheet ? `<div class="sheet-bg" ${g({ sheet: null })}></div><div class="sheet"><div class="sh-box"><small>이 사진이 모든 기기에서 삭제됩니다.</small><button class="red" data-do="delphoto">사진 삭제</button></div><button class="sh-cancel" ${g({ sheet: null })}>취소</button></div>` : ''}</div>`;
    // 모바일: 손가락을 따라 사진이 움직이고 놓으면 넘어감 / PC: 사진 왼쪽 절반 클릭=이전, 오른쪽 절반=다음
    const vp = $('#vp'), im = vp.querySelector('img'), sc = parseFloat(getComputedStyle($('#phone')).getPropertyValue('--s')) || 1; let x0 = null, touch = false;
    vp.onpointerdown = (e) => { x0 = e.clientX; touch = e.pointerType !== 'mouse'; im.style.transition = 'none'; if (touch) vp.setPointerCapture(e.pointerId); };
    vp.onpointermove = (e) => { if (x0 == null || !touch || vp.classList.contains('zoom')) return; im.style.transform = `translateX(${(e.clientX - x0) / sc}px)`; };
    vp.onpointerup = (e) => {
      if (x0 == null) return; const dx = (e.clientX - x0) / sc; x0 = null; im.style.transition = '';
      if (!touch) { const r = vp.getBoundingClientRect(); return flip(e.clientX < r.left + r.width / 2 ? -1 : 1); }
      if (vp.classList.contains('zoom')) return;
      const d = dx < -50 ? 1 : dx > 50 ? -1 : 0, v = st.v - d;
      if (!d || v < 0 || v >= P.length) { im.style.transform = ''; return; } // 끝이면 제자리로 튕김
      im.style.transform = `translateX(${d > 0 ? -402 : 402}px)`; setTimeout(() => flip(d), 180);
    };
    vp.onpointercancel = () => { x0 = null; im.style.transition = ''; im.style.transform = ''; };
    vp.ondblclick = () => { if (touch) vp.classList.toggle('zoom'); }; // 두 번 탭 확대는 모바일만(PC 클릭은 넘기기)
    return;
  }
  if (st.tab === 'trash') {
    app.innerHTML = `${back('컬렉션', { tab: 'col' })}<div class="scr"><h1 class="lg" style="padding-top:44px">최근 삭제</h1><div class="empty" style="padding:60px 40px 20px">항목 없음</div>
      <div class="note">사진 및 비디오는 30일 동안 이곳에 보관된 후 영구적으로 삭제됩니다.</div></div>`;
    return;
  }
  const body = st.tab === 'col'
    ? `<h1 class="lg">컬렉션</h1><div class="hdr">유틸리티</div><div class="list"><button class="alb" ${g({ tab: 'trash' })}>${sv('trash')}최근 삭제<em>0</em></button></div>`
    : `<h1 class="lg">보관함</h1><div class="pgrid">${[...P.keys()].reverse().map((i) => `<button ${g({ v: i })}>${img(P[i])}</button>`).join('')}</div><div class="note">사진 ${P.length}장</div>`;
  app.innerHTML = `<div class="scr">${body}</div>${tabbar(tabs, st.tab)}`;
}

// 사진첩이 최신순이라 다음 = 더 오래된 사진
function flip(d) { const v = st.v - d; if (v >= 0 && v < DATA.photos.length) go({ v }); }

/* ---- 캘린더 ---- */
function calApp() {
  const Y = 2033, mo = st.mo || 10, d = st.d || (mo === 10 ? 31 : 1), first = new Date(Y, mo - 1, 1).getDay(), n = new Date(Y, mo, 0).getDate();
  const E = DATA.events.filter((e) => e.m === mo), has = (k) => E.some((e) => e.day === k);
  const cells = Array.from({ length: first }, () => '<span></span>').concat(Array.from({ length: n }, (_, i) => `<button class="${mo === 10 && i + 1 === 31 ? 'today' : ''} ${i + 1 === d ? 'sel' : ''}" ${g({ d: i + 1 })}><i>${i + 1}</i>${has(i + 1) ? '<u></u>' : ''}</button>`));
  while (cells.length % 7) cells.push('<span></span>');
  const evs = E.filter((e) => e.day === d);
  app.innerHTML = `<div class="scr"><div class="mh"><h1 class="lg">${Y}년 ${mo}월</h1><button ${g({ mo: mo - 1 || 12, d: 1 })}>‹</button><button ${g({ mo: mo === 12 ? 1 : mo + 1, d: 1 })}>›</button></div><div class="cal"><div class="wk">${['일', '월', '화', '수', '목', '금', '토'].map((w) => `<span>${w}</span>`).join('')}</div><div class="cg">${cells.join('')}</div></div>
    <div class="hdr">${mo}월 ${d}일</div><div class="list">${evs.length ? evs.map((e) => `<div class="row"><div class="rb"><b>${esc(e.title)}</b><small>${esc(e.time)}</small></div></div>`).join('') : '<div class="row"><div class="rb"><small>일정 없음</small></div></div>'}</div></div>`;
}

/* ---- 시작 ---- */
fetch('data.enc.json', { cache: 'no-store' }).then((r) => r.json()).then((j) => { ENC = j; show('lock'); });
