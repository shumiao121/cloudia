// 网页「今天这朵」第二版的页面逻辑（11-17）：挑图 → 画（笔 / 贴纸）→ 起名 → 揭晓「我们看见的」→ 两张图分享 → 屋子里换一张。
import { Board, PENS, COLORS, SIZES, drawStroke } from './board.js';
import { STICKERS, icon } from './stickers.js';

const $ = id => document.getElementById(id);
const M = window.MANIFEST;
const params = new URLSearchParams(location.search);
const store = (() => { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch (_) { return null; } })();

// ---------- 计数器：只数动作，不带任何个人信息。GC 留空就什么都不发 ----------
const GC = '';
function count(name) {
  if (!GC) return;
  try { navigator.sendBeacon(`https://${GC}.goatcounter.com/count?p=${encodeURIComponent('/today/' + name)}&e=true&rnd=${Math.random().toString(36).slice(2)}`); } catch (_) {}
}

// ---------- 今天是哪张 ----------
function today() {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(params.get('d') || '');
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
const day = today();
const n = Math.round((day - new Date(2026, 10, 19)) / 864e5);
const daily = M.daily[((n % M.daily.length) + M.daily.length) % M.daily.length];
const asked = params.get('i') || params.get('c');
const id = asked && M.items[asked] ? asked : daily;
const isToday = id === daily;
const meta = M.items[id];
$('date').textContent = isToday ? day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : (meta.kind === 'oldsky' ? 'Old skies' : 'Clouds');

const touchy = matchMedia('(pointer: coarse)').matches;
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const android = /Android/.test(navigator.userAgent);
if (meta.kind === 'oldsky') { $('ask').textContent = 'What do you see in this sky?'; document.title = 'What do you see in this sky? · Cloudia'; }
$('how').textContent = touchy ? 'Trace it with your finger — then give it some eyes.' : 'Trace it with your mouse — or open this on your phone.';
if (android) { const s = $('store'); s.removeAttribute('href'); s.textContent = 'Cloudia is on iPhone & iPad'; s.style.opacity = .6; }
if (ios) $('notIOS').hidden = true;
$('store').addEventListener('click', () => count('store'));
for (const w of window.WORDS) { const o = document.createElement('option'); o.value = w; $('words').appendChild(o); }

// ---------- 画板 ----------
const photo = $('photo'), fig = $('mine');
const key = `cloudia-v2-${id}`;
let stage = 'draw', said = '', started = false;
const board = new Board(fig, photo, { onChange: changed, onZoom: z => { $('zoomReset').hidden = z <= 1.01; } });
let focused = false;
$('zoomReset').onclick = () => board.resetZoom();

// ---------- 画得更大：手机上横图贴边；「Bigger」整屏只剩画和工具，两指放大 ----------
function bleed() {
  for (const f of [fig, $('ours')]) f.classList.toggle('bleed', !focused && innerWidth < 600 && ITEM.w >= ITEM.h);
}
function fitFocus() {
  const a = $('canvasArea');
  fig.style.maxWidth = 'none';
  fig.style.width = Math.floor(Math.min(a.clientWidth, a.clientHeight * ITEM.w / ITEM.h)) + 'px';
}
function focusTip() {
  const wide = ITEM.w > ITEM.h * 1.15, upright = innerHeight > innerWidth;
  if (!touchy) return 'Ctrl + scroll (or pinch the trackpad) to zoom in.';
  return wide && upright ? 'Turn your phone sideways for more room · pinch to zoom' : 'Pinch with two fingers to zoom in';
}
function setFocus(on) {
  focused = on;
  $('stage').classList.toggle('focus', on); document.body.classList.toggle('focus', on);
  board.resetZoom();
  if (on) { $('focusTip').textContent = focusTip(); fitFocus(); }
  else { fig.style.width = ''; fitFigure(fig, ITEM.w, ITEM.h); }
  bleed();
  requestAnimationFrame(() => board.resize(1));
  if (!on) setTimeout(() => fig.scrollIntoView({ block: 'center' }), 30);
  count(on ? 'focus' : 'focus-close');
}
$('bigBtn').onclick = () => setFocus(true);
$('focusClose').onclick = () => setFocus(false);
addEventListener('keydown', e => { if (e.key === 'Escape' && focused) setFocus(false); });

function fitFigure(f, w, h) {   // 竖的老画别撑出屏幕：限制画框宽，让整张图落在一屏里
  const maxH = Math.max(300, innerHeight * 0.6);
  f.style.maxWidth = Math.round(maxH * w / h) + 'px';   // 只按高度限；宽度交给 CSS 的 100%（藏着的时候量不到父元素宽）
}

function changed() {
  const empty = board.isEmpty();
  $('undo').disabled = !board.canUndo() || stage !== 'draw';
  $('redo').disabled = !board.canRedo() || stage !== 'draw';
  $('clear').disabled = empty || stage !== 'draw';
  $('done').disabled = empty || stage !== 'draw';
  $('hint').style.opacity = empty && stage === 'draw' ? 1 : 0;
  $('bigBtn').hidden = stage !== 'draw';
  if (!empty && !started) { started = true; count('first-stroke'); }
  save();
}

// 笔
const PEN_NAMES = { ink: 'Ink', marker: 'Marker', crayon: 'Crayon', rainbow: 'Rainbow', eraser: 'Eraser' };
for (const p of PENS) {
  const b = document.createElement('button'); b.className = 'pen'; b.dataset.pen = p; b.setAttribute('aria-pressed', p === board.pen);
  const c = document.createElement('canvas'); const dpr = Math.min(devicePixelRatio || 1, 2); c.width = 40 * dpr; c.height = 18 * dpr;
  b.append(c, document.createTextNode(PEN_NAMES[p]));
  b.onclick = () => { board.pen = p; pressed('#pens .pen', b); };
  $('pens').appendChild(b);
}
function penPreviews() {
  for (const b of document.querySelectorAll('#pens .pen')) {
    const c = b.querySelector('canvas'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    const p = b.dataset.pen, pts = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([0.08 + t * 0.84, 0.5 + Math.sin(t * Math.PI * 2) * 0.22]); }
    if (p === 'eraser') { g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink-soft'); g.font = `${c.height * 0.8}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⌫', c.width / 2, c.height / 2); continue; }
    const inkVar = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();   // 深色模式下深色墨线的小样看不见，跟着页面文字色
    const shown = board.color === '#FFFFFF' ? '#9AA3AD' : board.color === COLORS[0] ? inkVar : board.color;
    const s = { t: p, c: p === 'rainbow' ? '#000' : shown, w: { ink: 0.05, marker: 0.11, crayon: 0.08, rainbow: 0.07 }[p], p: pts, h0: 0 };
    g.save(); if (p === 'marker') g.globalAlpha = 0.55; drawStroke(g, s, c.width, c.height); g.restore();
  }
}
// 颜色
for (const col of COLORS) {
  const b = document.createElement('button'); b.className = 'sw'; b.style.background = col; b.setAttribute('aria-label', 'Color'); b.setAttribute('aria-pressed', col === board.color);
  b.onclick = () => { board.color = col; if (board.pen === 'eraser' || board.pen === 'rainbow') { board.pen = 'ink'; pressed('#pens .pen', document.querySelector('[data-pen="ink"]')); } pressed('#colors .sw', b); penPreviews(); };
  $('colors').appendChild(b);
}
// 粗细
SIZES.forEach((_, i) => {
  const b = document.createElement('button'); b.className = 'sz'; b.setAttribute('aria-label', ['Thin', 'Medium', 'Thick'][i]); b.setAttribute('aria-pressed', i === board.size);
  const dot = document.createElement('i'); dot.style.width = dot.style.height = [6, 11, 18][i] + 'px'; b.appendChild(dot);
  b.onclick = () => { board.size = i; pressed('#sizes .sz', b); };
  $('sizes').appendChild(b);
});
function pressed(sel, on) { for (const b of document.querySelectorAll(sel)) b.setAttribute('aria-pressed', b === on); }
// 贴纸
{
  const dpr = Math.min(devicePixelRatio || 1, 2);
  for (const st of STICKERS) {
    const b = document.createElement('button'); b.setAttribute('aria-label', st.name); b.title = st.name;
    const c = icon(st, 44, dpr); b.appendChild(c);
    b.onclick = () => { board.addSticker(st.id); count('sticker'); };
    $('tray').appendChild(b);
  }
}
function tab(which) {
  $('tabDraw').setAttribute('aria-selected', which === 'draw'); $('tabStk').setAttribute('aria-selected', which === 'stickers');
  $('drawTools').hidden = which !== 'draw'; $('stkTools').hidden = which !== 'stickers'; $('sizes').hidden = which !== 'draw';
  board.setMode(stage === 'draw' ? which : 'locked');
}
$('tabDraw').onclick = () => tab('draw');
$('tabStk').onclick = () => tab('stickers');
$('undo').onclick = () => board.undo();
$('redo').onclick = () => board.redo();
$('clear').onclick = () => board.clear();
$('done').onclick = () => { if (focused) setFocus(false); setStage('name'); count('done'); setTimeout(() => $('word').focus({ preventScroll: true }), 60); $('naming').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
$('back').onclick = () => setStage('draw');
$('skip').onclick = () => { said = ''; setStage('reveal'); };
$('askForm').onsubmit = e => {
  e.preventDefault();
  said = $('word').value.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!said) { $('word').focus(); return; }
  $('word').blur(); setStage('reveal');
};

function setStage(s) {
  stage = s;
  $('dock').hidden = s !== 'draw';
  $('naming').hidden = s !== 'name';
  $('reveal').hidden = s !== 'reveal';
  board.setMode(s === 'draw' ? ($('tabStk').getAttribute('aria-selected') === 'true' ? 'stickers' : 'draw') : 'locked');
  if (s === 'reveal') {
    showYou(); showOurs(Math.max(0, (ITEM.saw || []).findIndex(x => x.word.toLowerCase() === said.toLowerCase())));
    makePair();
    setTimeout(() => $('reveal').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
  changed();
}

// ---------- 揭晓 ----------
const article = w => /^[aeiou]/i.test(w) ? 'an' : 'a';
const named = w => /s$/i.test(w) ? w : `${article(w)} ${w}`;
function showYou() {
  const ours = (ITEM.saw || []).map(s => s.word.toLowerCase());
  if (!said) { $('you').textContent = 'You kept it to yourself. Fair.'; return; }
  $('you').textContent = ours.includes(said.toLowerCase()) ? `You saw ${named(said)} — so did we.` : `You saw ${named(said)}.`;
}
let showing = 0;
function showOurs(i) {
  showing = i;
  [...$('chips').children].forEach((c, j) => c.setAttribute('aria-pressed', String(j === i)));
  const c = $('ourInk'), r = $('photo2').getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2.5);
  if (!r.width) return;
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  for (const p of (ITEM.saw[i] || { strokes: [] }).strokes) drawStroke(g, { t: 'ink', c: '#1A1B24', w: 0.0058, p }, c.width, c.height);
  c.animate && c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });
}

// ---------- 两张 4:5：先问，再答 ----------
const PW = 1080, PH = 1350;
function footerLine() { return ITEM.kind === 'oldsky' ? `${ITEM.credit.artist}, ${ITEM.credit.date} · The Met` : 'A real cloud · Cloudia'; }
async function picture(answer) {
  const c = document.createElement('canvas'); c.width = PW; c.height = PH;
  const g = c.getContext('2d');
  g.fillStyle = '#F7F4EC'; g.fillRect(0, 0, PW, PH);
  // 图和底下三行字合成一组，整组在 4:5 里上下居中，留白不堆在一头
  const TEXT = 250, maxW = PW - 96, maxH = PH - 96 - TEXT;
  const k = Math.min(maxW / ITEM.w, maxH / ITEM.h), w = ITEM.w * k, h = ITEM.h * k;
  const top = Math.max(48, (PH - h - TEXT) / 2);
  const x = (PW - w) / 2, y = top;
  const base = y + h;
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, 18); g.clip();
  board.composeInto(g, x, y, w, h, { lines: answer, stickers: answer });
  g.restore();
  try { await document.fonts.load('600 64px Fraunces'); } catch (_) {}
  g.fillStyle = '#28343E'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '600 76px Fraunces, Georgia, serif';
  const line = answer ? (said ? `I saw ${named(said)}.` : 'Here’s what I saw.') : 'What do you see?';
  fitText(g, line, PW / 2, base + 110, PW - 120, 76);
  g.font = '28px -apple-system, system-ui, sans-serif'; g.fillStyle = '#5D6771';
  g.fillText(answer ? footerLine() : (ITEM.kind === 'oldsky' ? 'A sky from an old painting. Guess first →' : 'A real cloud. Guess first →'), PW / 2, base + 168);
  g.font = '600 26px Fraunces, Georgia, serif'; g.fillStyle = '#945D16';
  g.fillText('Cloudia', PW / 2, base + 222);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
}
function fitText(g, t, x, y, maxW, size) {
  while (g.measureText(t).width > maxW && size > 30) { size -= 4; g.font = g.font.replace(/\d+px/, size + 'px'); }
  g.fillText(t, x, y);
}
let pair = null, urls = [];
async function makePair() {
  const [q, a] = await Promise.all([picture(false), picture(true)]);
  pair = [new File([q], 'cloudia-1-guess.jpg', { type: 'image/jpeg' }), new File([a], 'cloudia-2-answer.jpg', { type: 'image/jpeg' })];
  urls.forEach(u => URL.revokeObjectURL(u)); urls = pair.map(f => URL.createObjectURL(f));
  $('pairPreview').innerHTML = '';
  for (const u of urls) { const im = new Image(); im.src = u; im.alt = ''; $('pairPreview').appendChild(im); }
}
function sheet() {
  $('sheetPics').innerHTML = '';
  for (const u of urls) { const im = new Image(); im.src = u; im.alt = 'Your picture'; $('sheetPics').appendChild(im); }
  $('sheet').hidden = false;
}
$('share').onclick = async () => {
  if (!pair) await makePair();
  count('share');
  if (navigator.canShare && navigator.canShare({ files: pair })) {
    try { await navigator.share({ files: pair, text: 'What do you see?' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  sheet();   // Threads、Instagram 自带的浏览器里常常没有分享单：给图，长按存
};
$('save').onclick = async () => { if (!pair) await makePair(); count('save'); sheet(); };
$('closeSheet').onclick = () => { $('sheet').hidden = true; };

// ---------- 屋子 ----------
function rooms() {
  const lines = { clouds: 'Real clouds, photographed and given to the public domain.', oldskies: 'Painters’ skies, 1770s–1910s, from the Met’s open collection.' };
  let cur = M.rooms.find(r => r.items.includes(id))?.id || M.rooms[0].id;
  const draw = () => {
    $('roomTabs').innerHTML = '';
    for (const r of M.rooms) {
      const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.textContent = r.title; b.setAttribute('aria-selected', r.id === cur);
      b.onclick = () => { cur = r.id; draw(); count('room-' + r.id); }; $('roomTabs').appendChild(b);
    }
    $('roomLine').textContent = lines[cur] || '';
    const room = M.rooms.find(r => r.id === cur); $('grid').innerHTML = '';
    for (const i of room.items) {
      const a = document.createElement('a'); a.href = '?i=' + encodeURIComponent(i); if (i === id) a.setAttribute('aria-current', 'true');
      const im = new Image(); im.loading = 'lazy'; im.src = `thumbs/${i}.jpg`; im.alt = M.items[i].label || ''; a.appendChild(im);
      $('grid').appendChild(a);
    }
  };
  draw();
}

// ---------- 存取（只在这台设备上） ----------
function save() {
  if (!store || !window.ITEM) return;
  try {
    const s = JSON.stringify({ board: board.toJSON(), stage: stage === 'name' ? 'draw' : stage, said });
    if (s.length < 1.5e6) store.setItem(key, s);
  } catch (_) {}
}
function restore() {
  if (!store) return;
  try {
    const s = JSON.parse(store.getItem(key) || 'null');
    if (!s) return;
    board.load(s.board); said = s.said || ''; started = !board.isEmpty();
    if (s.stage === 'reveal') setStage('reveal');
  } catch (_) {}
}

// ---------- 起步 ----------
function credit() {
  const c = ITEM.credit, el = $('credit'); el.textContent = '';
  const a = document.createElement('a'); a.href = c.url; a.target = '_blank'; a.rel = 'noopener';
  if (ITEM.kind === 'oldsky') {
    a.textContent = `${c.title}`; el.append(a, `, ${c.artist}, ${c.date}. The Metropolitan Museum of Art, Open Access (CC0).`);
    $('caption').textContent = `${c.title} — ${c.artist}, ${c.date} · The Met`; $('caption').hidden = false;
  } else {
    a.textContent = c.title.replace(/\.(jpe?g|png)$/i, ''); el.append('Photo: ', a, ' (CC0, Wikimedia Commons)');
  }
}
function boot() {
  credit(); rooms();
  (ITEM.saw || []).forEach((s, i) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = named(s.word); b.onclick = () => showOurs(i); $('chips').appendChild(b); });
  photo.alt = ITEM.kind === 'oldsky' ? `${ITEM.credit.title}, a painting of the sky` : 'A real cloud';
  fitFigure(fig, ITEM.w, ITEM.h); fitFigure($('ours'), ITEM.w, ITEM.h); bleed();
  photo.onload = () => { board.resize(); restore(); changed(); penPreviews(); };
  photo.src = ITEM.src; $('photo2').src = ITEM.src;
  $('photo2').onload = () => { if (stage === 'reveal') showOurs(showing); };
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => {
    board.resetZoom();
    if (focused) { $('focusTip').textContent = focusTip(); fitFocus(); } else fitFigure(fig, ITEM.w, ITEM.h);
    fitFigure($('ours'), ITEM.w, ITEM.h); bleed(); board.resize(1); if (stage === 'reveal') showOurs(showing);
  }, 150); });
  count(isToday ? 'view-today' : 'view-' + ITEM.kind);
}
let ITEM;
const s = document.createElement('script'); s.src = `items/${id}.js`;
s.onload = () => { ITEM = window.ITEM; boot(); };
document.head.appendChild(s);
