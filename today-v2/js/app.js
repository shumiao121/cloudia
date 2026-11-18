// 网页「今天这朵」的页面逻辑（11-17 第二版，11-18 第三版「工作台」）：
// 挑图 → 画（12 支笔 / 形状 / 填色 / 对称 / 贴纸 / 文字）→ 起名 → 揭晓「我们看见的」→ 两张图分享 → 屋子里换一张。
import { Board, PENS, PEN_NAMES, SHAPES, COLORS, sizeToWidth, drawStroke } from './board.js';
import { STICKERS, PACKS, FONTS, icon, textRatio } from './stickers.js';

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
// 白纸（11-18）：纸是现画的，没有图片文件、没有「我们看见的」；画完带到一朵真云上
const paperMode = meta.kind === 'paper';
const PAPERS = {
  warm: { name: 'Warm', bg: '#F6F1E6' }, white: { name: 'White', bg: '#FFFFFF' },
  dots: { name: 'Dots', bg: '#F8F5EE', dot: '#C9C1B1' }, grid: { name: 'Grid', bg: '#FFFFFF', line: '#CFE0F2', major: '#A9C6E6' },
  night: { name: 'Night', bg: '#151C2C', dark: true },
};
const ASPECTS = { wide: [1600, 1200, 'Wide'], square: [1400, 1400, 'Square'], tall: [1200, 1600, 'Tall'] };
let paperKind = paperMode ? id.replace('paper-', '') : null, aspect = 'wide';
function makePaper(kind, asp, scale = 1) {
  const P = PAPERS[kind] || PAPERS.warm, [W0, H0] = ASPECTS[asp] || ASPECTS.wide, W = Math.round(W0 * scale), H = Math.round(H0 * scale);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = P.bg; g.fillRect(0, 0, W, H);
  const step = 40 * scale;
  if (P.dot) { g.fillStyle = P.dot; for (let y = step; y < H; y += step) for (let x = step; x < W; x += step) { g.beginPath(); g.arc(x, y, Math.max(1, 2.2 * scale), 0, 7); g.fill(); } }
  if (P.line) { for (let i = 1, x = step; x < W; x += step, i++) { g.fillStyle = i % 5 ? P.line : P.major; g.fillRect(Math.round(x), 0, Math.max(1, scale * 1.5), H); }
    for (let i = 1, y = step; y < H; y += step, i++) { g.fillStyle = i % 5 ? P.line : P.major; g.fillRect(0, Math.round(y), W, Math.max(1, scale * 1.5)); } }
  return c.toDataURL('image/png');
}
$('date').textContent = isToday ? day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ({ oldsky: 'Old skies', paper: 'Blank page' }[meta.kind] || 'Clouds');

const touchy = matchMedia('(pointer: coarse)').matches;
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const android = /Android/.test(navigator.userAgent);
if (meta.kind === 'oldsky') { $('ask').textContent = 'What do you see in this sky?'; document.title = 'What do you see in this sky? · Cloudia'; }
if (paperMode) { $('ask').textContent = 'Draw anything — then put it on a real sky.'; document.title = 'Blank page · Cloudia'; }
$('how').textContent = paperMode ? 'Start on paper. When you’re done, your drawing can move onto a cloud.' : touchy ? 'Trace it with your finger — then give it some eyes.' : 'Trace it with your mouse or trackpad. Hold space to move around, ⌘/Ctrl + scroll to zoom.';
if (android) { const s = $('store'); s.removeAttribute('href'); s.textContent = 'Cloudia is on iPhone & iPad'; s.style.opacity = .6; }
if (ios) $('notIOS').hidden = true;
$('store').addEventListener('click', () => count('store'));
for (const w of window.WORDS) { const o = document.createElement('option'); o.value = w; $('words').appendChild(o); }

// ---------- 画板 ----------
const photo = $('photo'), fig = $('mine');
const key = paperMode ? 'cloudia-v2-paper' : `cloudia-v2-${id}`;
let stage = 'draw', said = '', started = false, focused = false, tabNow = 'draw', lastTool = 'pen';
const board = new Board(fig, photo, {
  onChange: changed,
  onZoom: z => { $('zoomReset').hidden = z <= 1.01; },
  onPick: c => { setColor(c); setTool(lastTool); toast('Picked a color from the picture'); },
  onNote: what => { if (what === 'fill') toast('Close the shape first — the color would spill out.'); },
});
$('zoomReset').onclick = () => board.resetZoom();
$('zoomIn').onclick = () => board.zoomBy(1.5);
$('zoomOut').onclick = () => board.zoomBy(1 / 1.5);

let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

// ---------- 画框多大：电脑上按窗口高度铺满；手机上横图贴边；「Bigger」整屏 ----------
const wide = () => innerWidth >= 980;
function fitFigure(f, w, h) {
  const maxH = wide() ? Math.max(360, innerHeight - 150) : Math.max(300, innerHeight * 0.6);
  f.style.maxWidth = Math.round(maxH * w / h) + 'px';   // 只按高度限；宽度交给 CSS 的 100%
}
function bleed() { for (const f of [fig, $('ours')]) f.classList.toggle('bleed', !focused && innerWidth < 600 && ITEM.w >= ITEM.h); }
function fitFocus() {
  const a = $('canvasArea');
  fig.style.maxWidth = 'none';
  fig.style.width = Math.floor(Math.min(a.clientWidth, a.clientHeight * ITEM.w / ITEM.h)) + 'px';
}
function focusTip() {
  const wideImg = ITEM.w > ITEM.h * 1.15, upright = innerHeight > innerWidth;
  if (!touchy) return 'Hold space and drag to move · ⌘/Ctrl + scroll to zoom · Esc to close';
  return wideImg && upright ? 'Turn your phone sideways for more room · pinch to zoom' : 'Pinch with two fingers to zoom in';
}
function setFocus(on) {
  focused = on;
  $('stage').classList.toggle('focus', on); document.body.classList.toggle('focus', on);
  board.resetZoom();
  if (on) { $('focusTip').textContent = focusTip(); fitFocus(); }
  else { fig.style.width = ''; fitFigure(fig, ITEM.w, ITEM.h); }
  bleed();
  requestAnimationFrame(() => { board.resize(1); previews(); });
  if (!on) setTimeout(() => fig.scrollIntoView({ block: 'center' }), 30);
  count(on ? 'focus' : 'focus-close');
}
$('bigBtn').onclick = () => setFocus(true);
$('focusClose').onclick = () => setFocus(false);

function changed() {
  const empty = board.isEmpty();
  $('undo').disabled = !board.canUndo() || stage !== 'draw';
  $('redo').disabled = !board.canRedo() || stage !== 'draw';
  $('clear').disabled = empty || stage !== 'draw';
  $('done').disabled = empty || stage !== 'draw';
  $('hint').style.opacity = empty && stage === 'draw' ? 1 : 0;
  $('bigBtn').hidden = stage !== 'draw';
  const objTab = tabNow === 'stickers' || tabNow === 'text';
  $('objTools').hidden = !objTab || board.selected < 0;
  $('objTip').hidden = !objTab || board.selected >= 0 || !board.stickers.length;
  if (paperMode) for (const b of $('aspects').children) { b.disabled = !empty; b.title = empty ? '' : 'Start over to change the shape'; }
  if (!empty && !started) { started = true; count('first-stroke'); }
  save();
}

// ---------- 工具：笔 / 填色 / 形状（按钮上画一小段样子） ----------
const cssVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function previewColor() { return board.color === '#FFFFFF' ? '#9AA3AD' : board.color === COLORS[0] ? cssVar('--ink') : board.color; }
function wave() { const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push([0.1 + t * 0.8, 0.5 + Math.sin(t * Math.PI * 2) * 0.24, 0]); } return pts; }
const PREVIEW_W = { ink: 0.05, pencil: 0.03, brush: 0.08, marker: 0.11, highlighter: 0.14, crayon: 0.08, calligraphy: 0.11, airbrush: 0.22, neon: 0.05, rainbow: 0.07, dashed: 0.045 };
function toolButton(parent, label, data) {
  const b = document.createElement('button'); b.className = 'pen'; Object.assign(b.dataset, data); b.title = label;
  const c = document.createElement('canvas'); const dpr = Math.min(devicePixelRatio || 1, 2); c.width = 44 * dpr; c.height = 20 * dpr;
  b.append(c, document.createTextNode(label)); parent.appendChild(b); return b;
}
for (const p of PENS) toolButton($('pens'), PEN_NAMES[p], { pen: p }).onclick = () => { board.pen = p; setTool('pen'); };
toolButton($('pens'), 'Fill', { tool: 'fill' }).onclick = () => setTool('fill');
for (const k of SHAPES) toolButton($('shapes'), { line: 'Line', arrow: 'Arrow', rect: 'Box', ellipse: 'Circle' }[k], { shape: k }).onclick = () => { board.shape = k; setTool('shape'); };
$('shapeFill').onchange = e => { board.shapeFilled = e.target.checked; previews(); };

function previews() {
  const col = previewColor();
  for (const b of document.querySelectorAll('#pens .pen, #shapes .pen')) {
    const c = b.querySelector('canvas'), g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H);
    if (b.dataset.pen === 'eraser' || b.dataset.tool === 'fill') {
      g.fillStyle = b.dataset.tool === 'fill' ? col : cssVar('--ink-soft'); g.font = `${H * 0.82}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(b.dataset.tool === 'fill' ? '◉' : '⌫', W / 2, H / 2); continue;
    }
    if (b.dataset.shape) { drawStroke(g, { t: 'shape', kind: b.dataset.shape, c: col, w: 0.05, p: [[0.22, 0.22], [0.78, 0.8]], filled: board.shapeFilled }, W, H); continue; }
    const p = b.dataset.pen;
    g.save(); g.globalAlpha = { marker: 0.55, highlighter: 0.45 }[p] || 1;
    drawStroke(g, { t: p, c: p === 'rainbow' ? '#000' : col, w: PREVIEW_W[p] || 0.06, p: wave(), h0: 0, seed: 3 }, W, H); g.restore();
  }
  const d = $('sizeDot'), px = Math.max(2, Math.min(30, sizeToWidth(board.sizeN) * (fig.offsetWidth || 340)));
  d.style.width = d.style.height = px + 'px'; d.style.background = col; d.style.opacity = board.opacity;
}

function setTool(t) {
  if (t !== 'pick') lastTool = t;
  board.setTool(t);
  for (const b of document.querySelectorAll('#pens .pen')) b.setAttribute('aria-pressed', t === 'pen' ? b.dataset.pen === board.pen : (t === 'fill' && b.dataset.tool === 'fill'));
  for (const b of document.querySelectorAll('#shapes .pen')) b.setAttribute('aria-pressed', t === 'shape' && b.dataset.shape === board.shape);
  $('pickBtn').setAttribute('aria-pressed', t === 'pick');
  if (t === 'pick') toast('Tap the picture to pick its color');
}

// ---------- 颜色、粗细、透明度、对称、照片淡化 ----------
function setColor(c) {
  board.color = c;
  for (const b of document.querySelectorAll('#colors .sw')) b.setAttribute('aria-pressed', b.dataset.c === c);
  const custom = !COLORS.includes(c), lab = $('customColor').parentElement;
  lab.setAttribute('aria-pressed', custom);
  if (custom) { $('customColor').value = c.toLowerCase(); lab.style.background = c; }
  if (board.pen === 'eraser' || board.pen === 'rainbow') { board.pen = 'ink'; if (board.tool === 'pen') setTool('pen'); }
  const s = board.stickers[board.selected];   // 正选着的文字跟着换色
  if (s && s.k === 'text' && s.c !== c) { const before = board._stk(); s.c = c; board._push({ kind: 'stickers', before, after: board._stk() }); board.renderStickers(); }
  previews();
}
for (const col of COLORS) {
  const b = document.createElement('button'); b.className = 'sw'; b.style.background = col; b.dataset.c = col; b.setAttribute('aria-label', 'Color ' + col);
  b.onclick = () => setColor(col); $('colors').appendChild(b);
}
$('customColor').oninput = e => setColor(e.target.value.toUpperCase());
$('pickBtn').onclick = () => setTool(board.tool === 'pick' ? lastTool : 'pick');
$('size').oninput = e => { board.sizeN = +e.target.value; previews(); };
$('opacity').oninput = e => { board.opacity = +e.target.value / 100; $('opNum').textContent = e.target.value + '%'; previews(); };
$('fade').oninput = e => { board.setPhotoFade(+e.target.value / 100); $('fadeNum').textContent = e.target.value + '%'; };
for (const [k, label, title] of [['off', 'Off', 'No mirror'], ['m2', '⇆', 'Mirror left and right'], ['m4', '✣', 'Mirror four ways'], ['r6', '❋', 'Six-petal kaleidoscope']]) {
  const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.dataset.sym = k; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
  b.setAttribute('aria-selected', k === 'off');
  b.onclick = () => { board.sym = k; for (const x of $('syms').children) x.setAttribute('aria-selected', x === b); if (k !== 'off') toast(title); };
  $('syms').appendChild(b);
}

// ---------- 贴纸 ----------
let packNow = 'faces';
function tray() {
  const dpr = Math.min(devicePixelRatio || 1, 2); $('tray').innerHTML = '';
  for (const st of STICKERS.filter(s => s.pack === packNow)) {
    const b = document.createElement('button'); b.setAttribute('aria-label', st.name); b.title = st.name;
    b.appendChild(icon(st, 44, dpr));
    b.onclick = () => { board.addSticker(st.id); count('sticker'); changed(); };
    $('tray').appendChild(b);
  }
  for (const b of $('packs').children) b.setAttribute('aria-pressed', b.dataset.pack === packNow);
}
for (const p of PACKS) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.pack = p.id; b.textContent = p.name; b.onclick = () => { packNow = p.id; tray(); }; $('packs').appendChild(b); }
$('objFront').onclick = () => board.arrangeSelected('front');
$('objBack').onclick = () => board.arrangeSelected('back');
$('objCopy').onclick = () => board.arrangeSelected('copy');
$('objFlip').onclick = () => board.arrangeSelected('flip');
$('objDel').onclick = () => { board.removeSelected(); changed(); };

// ---------- 文字 ----------
let fontNow = 'serif';
for (const [k, f] of Object.entries(FONTS)) {
  const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.textContent = f.name; b.style.font = f.css.replace('100px', '15px');
  b.setAttribute('aria-selected', k === fontNow);
  b.onclick = () => {
    fontNow = k; for (const x of $('fonts').children) x.setAttribute('aria-selected', x === b);
    const s = board.stickers[board.selected];   // 正选着的文字换字体，高度不变
    if (s && s.k === 'text' && s.f !== k) {
      const before = board._stk(), h = s.w / s.ratio; s.f = k; s.ratio = textRatio(s); s.w = h * s.ratio;
      board._push({ kind: 'stickers', before, after: board._stk() }); board.renderStickers();
    }
  };
  $('fonts').appendChild(b);
}
$('textForm').onsubmit = async e => {
  e.preventDefault();
  const t = $('textIn').value.trim(); if (!t) { $('textIn').focus(); return; }
  try { await document.fonts.load(FONTS[fontNow].css.replace('100px', '40px'), t); } catch (_) {}
  board.addText(t, fontNow, board.color);
  $('textIn').value = ''; $('textIn').blur(); count('text'); changed();
};

// ---------- 只在 app 里：四格真截图，点开看大图、去下载 ----------
const APP_ONLY = {
  light: ['Light it up', 'Give your drawing sunset, moonlight, dawn or gold — the light comes from the cloud itself.', 'img/app-light.jpg'],
  judge: ['It says what it sees', 'A little judge on your phone looks at your drawing and guesses what it is. No internet needed.', 'img/app-judge.jpg'],
  gallery: ['Your own gallery', 'Every drawing is kept, framed and hung in galleries that grow as you draw.', 'img/app-gallery.jpg'],
  sky: ['Any sky — even yours', 'Point your camera up and draw on today’s sky, or pick from more than a hundred real clouds, winter skies and rainbows.', 'img/app-sky.jpg'],
};
for (const b of document.querySelectorAll('.appgrid button')) b.onclick = () => {
  const [title, line, img] = APP_ONLY[b.dataset.app];
  $('appTitle').textContent = title; $('appLine').textContent = line; $('appImg').src = img; $('appImg').alt = 'Cloudia app: ' + title;
  $('appSheet').hidden = false; count('app-' + b.dataset.app);
};
$('appClose').onclick = () => { $('appSheet').hidden = true; };
$('appSheet').onclick = e => { if (e.target === $('appSheet')) $('appSheet').hidden = true; };
$('appStore').addEventListener('click', () => count('store-tools'));
if (android) { const a = $('appStore'); a.removeAttribute('href'); a.textContent = 'Cloudia is on iPhone & iPad'; a.style.opacity = .6; }

// ---------- 页签 ----------
function tab(which) {
  tabNow = which;
  for (const b of $('tabs').children) b.setAttribute('aria-selected', b.dataset.tab === which);
  for (const t of ['draw', 'shapes', 'stickers', 'text']) $('pane-' + t).hidden = t !== which;
  for (const r of document.querySelectorAll('#shared [data-for]')) r.hidden = !r.dataset.for.split(' ').includes(which);
  $('shared').querySelector('.colorrow').hidden = which === 'stickers';
  if (which === 'shapes') setTool('shape'); else if (which === 'draw' && board.tool === 'shape') setTool('pen');
  board.setMode(stage !== 'draw' ? 'locked' : (which === 'stickers' || which === 'text') ? 'stickers' : 'draw');
  changed();
}
for (const b of $('tabs').children) b.onclick = () => tab(b.dataset.tab);
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

// ---------- 键盘（电脑上） ----------
const typing = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !/^(range|checkbox|color)$/.test(a.type); };
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('appSheet').hidden) { $('appSheet').hidden = true; return; }
  if (e.key === 'Escape') { if (board.tool === 'pick') setTool(lastTool); else if (focused) setFocus(false); return; }
  if (stage !== 'draw' || typing()) return;
  const cmd = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (cmd && k === 'z') { e.preventDefault(); e.shiftKey ? board.redo() : board.undo(); return; }
  if (cmd && k === 'y') { e.preventDefault(); board.redo(); return; }
  if (cmd || e.altKey) return;
  if (e.key === ' ') { e.preventDefault(); if (!board.spaceDown) { board.spaceDown = true; board._cursor(); } return; }
  const penKeys = { b: 'ink', p: 'pencil', m: 'marker', h: 'highlighter', e: 'eraser', n: 'neon', a: 'airbrush', c: 'crayon' };
  if (penKeys[k]) { tab('draw'); board.pen = penKeys[k]; setTool('pen'); }
  else if (k === 'g') { tab('draw'); setTool('fill'); }
  else if (k === 'i') setTool('pick');
  else if (k === 'u') tab('shapes');
  else if (k === 's') tab('stickers');
  else if (k === 't') { tab('text'); setTimeout(() => $('textIn').focus(), 0); e.preventDefault(); }
  else if (k === '[' || k === ']') { board.sizeN = Math.max(1, Math.min(100, board.sizeN + (k === ']' ? 6 : -6))); $('size').value = board.sizeN; previews(); }
  else if (k === '=' || k === '+') board.zoomBy(1.5);
  else if (k === '-') board.zoomBy(1 / 1.5);
  else if (k === '0') board.resetZoom();
  else if ((k === 'backspace' || k === 'delete') && board.selected >= 0) { e.preventDefault(); board.removeSelected(); changed(); }
});
addEventListener('keyup', e => { if (e.key === ' ') { board.spaceDown = false; board._cursor(); } });

function setStage(s) {
  stage = s;
  $('dock').hidden = s !== 'draw';
  $('naming').hidden = s !== 'name';
  $('reveal').hidden = paperMode || s !== 'reveal';
  $('paperOut').hidden = !paperMode || s !== 'reveal';
  $('paperbar').hidden = !paperMode || s !== 'draw';
  tab(tabNow);
  if (s === 'reveal' && paperMode) { paperExits(); setTimeout(() => $('paperOut').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
  else if (s === 'reveal') {
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
  const lines = { clouds: 'Real clouds, photographed and given to the public domain.', oldskies: 'Painters’ skies, 1770s–1910s, from the Met’s open collection.', blank: 'Start on paper, then put your drawing on a real sky.' };
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
      const im = new Image(); im.loading = 'lazy'; im.alt = M.items[i].label || '';
      im.src = M.items[i].kind === 'paper' ? makePaper(i.replace('paper-', ''), 'wide', 0.18) : `thumbs/${i}.jpg`;
      if (M.items[i].kind === 'paper') { im.alt = PAPERS[i.replace('paper-', '')].name + ' paper'; a.classList.add('paperthumb'); a.dataset.name = PAPERS[i.replace('paper-', '')].name; }
      a.appendChild(im); $('grid').appendChild(a);
    }
  };
  draw();
}

// ---------- 存取（只在这台设备上） ----------
let restored = false;   // 读回存着的画以前一律不存：起步时切页签会触发 changed()，那时板子还是空的，存了就把旧画盖掉了
function save() {
  if (!store || !ITEM || !restored) return;
  try {
    const s = JSON.stringify({ board: board.toJSON(), stage: stage === 'name' ? 'draw' : stage, said, paper: paperKind, aspect });
    if (s.length < 1.5e6) store.setItem(key, s);
  } catch (_) {}
}
function restore() {
  try {
    const s = store && JSON.parse(store.getItem(key) || 'null');
    if (s) { board.load(s.board); said = s.said || ''; started = !board.isEmpty(); }
    restored = true;
    if (s && s.stage === 'reveal') setStage('reveal');
  } catch (_) { restored = true; }
}

// ---------- 白纸：换纸、换画幅（下笔以前） ----------
function paperControls() {
  $('papers').innerHTML = '';
  for (const [k, P] of Object.entries(PAPERS)) {
    const b = document.createElement('button'); b.className = 'chip'; b.setAttribute('role', 'tab'); b.setAttribute('aria-pressed', k === paperKind);
    const sw = document.createElement('i'); sw.style.background = P.bg; b.append(sw, P.name);
    b.onclick = () => setPaper(k); $('papers').appendChild(b);
  }
  $('aspects').innerHTML = '';
  for (const [k, A] of Object.entries(ASPECTS)) {
    const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.textContent = A[2]; b.setAttribute('aria-selected', k === aspect);
    b.disabled = !board.isEmpty(); b.title = board.isEmpty() ? '' : 'Start over to change the shape';
    b.onclick = () => setAspect(k); $('aspects').appendChild(b);
  }
  $('paperbar').hidden = stage !== 'draw';
  if (PAPERS[paperKind]?.dark && board.color === COLORS[0]) setColor('#FFFFFF');
}
function setPaper(k) {
  const wasDark = PAPERS[paperKind]?.dark;
  paperKind = k; photo.src = makePaper(k, aspect);
  history.replaceState(null, '', '?i=paper-' + k);
  if (PAPERS[k].dark && board.color === COLORS[0]) setColor('#FFFFFF');
  else if (!PAPERS[k].dark && wasDark && board.color === '#FFFFFF') setColor(COLORS[0]);
  paperControls(); save(); count('paper-' + k);
}
function setAspect(k) {
  if (!board.isEmpty()) return;
  aspect = k; const [W, H] = ASPECTS[k]; ITEM.w = W; ITEM.h = H;
  fitFigure(fig, W, H); bleed(); photo.src = makePaper(paperKind, k); paperControls(); save();
}

// ---------- 白纸画完：放到一朵真云上 / 我们也看见过它 ----------
function allSkies() { return M.rooms.filter(r => r.id !== 'blank').flatMap(r => r.items); }
function thumbLink(i, onClick) {
  const a = document.createElement('a'); a.href = '?i=' + encodeURIComponent(i);
  const im = new Image(); im.loading = 'lazy'; im.src = `thumbs/${i}.jpg`; im.alt = M.items[i].label ? `A sky where we saw ${named(M.items[i].label)}` : 'A sky'; a.appendChild(im);
  if (onClick) a.onclick = e => { e.preventDefault(); onClick(i); };
  return a;
}
function paperExits() {
  $('youPaper').textContent = said ? `You drew ${named(said)}.` : 'Nice one.';
  const skies = [daily, ...allSkies().filter(i => i !== daily)];
  const fill = n => { $('skyPick').innerHTML = ''; for (const i of skies.slice(0, n)) $('skyPick').appendChild(thumbLink(i, carryOut)); $('moreSkies').hidden = n >= skies.length; };
  fill(8); $('moreSkies').onclick = () => fill(skies.length);
  const w = said.toLowerCase(), hits = w ? allSkies().filter(i => (M.items[i].words || []).includes(w)) : [];
  $('sawToo').hidden = !hits.length;
  if (hits.length) {
    $('sawTooTitle').textContent = `We saw ${named(said)} too — in ${hits.length === 1 ? 'this sky' : 'these skies'}`;
    $('sawTooGrid').innerHTML = ''; for (const i of hits.slice(0, 6)) $('sawTooGrid').appendChild(thumbLink(i, carryOut));
  }
}
/** 白纸上的画（线和贴纸，不要纸）裁到刚好包住，出一张透明 PNG */
function artPNG(maxLong = 1200) {
  const W = ITEM.w, H = ITEM.h, c = document.createElement('canvas'); c.width = W; c.height = H;
  board.composeInto(c.getContext('2d'), 0, 0, W, H, { photo: false });
  const d = c.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const pad = 14; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min(1, maxLong / Math.max(cw, ch));
  const o = document.createElement('canvas'); o.width = Math.round(cw * k); o.height = Math.round(ch * k);
  o.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, o.width, o.height);
  return { canvas: o, ratio: cw / ch };
}
function carryOut(skyId) {
  const art = artPNG(900); if (!art) { location.href = '?i=' + skyId; return; }
  try { localStorage.setItem('cloudia-v2-carry', JSON.stringify({ src: art.canvas.toDataURL('image/png'), ratio: art.ratio, said })); } catch (_) { toast('Your browser would not hold the drawing — try Save image instead.'); return; }
  count('paper-to-sky'); location.href = '?i=' + encodeURIComponent(skyId);
}
/** 到了云这页：把带来的画当贴纸摆上去，选中，让人拖到合适的地方 */
function carryIn() {
  let c = null; try { c = JSON.parse(localStorage.getItem('cloudia-v2-carry') || 'null'); localStorage.removeItem('cloudia-v2-carry'); } catch (_) {}
  if (!c || !c.src) return;
  if (stage !== 'draw') setStage('draw');
  const w = Math.max(0.25, Math.min(0.62, c.ratio >= 1 ? 0.55 : 0.5 * c.ratio));
  board.addImage(c.src, c.ratio, w); tab('stickers');
  if (c.said) $('word').value = c.said;
  toast('Your drawing is on the sky — drag it into place, then tap Done.');
  setTimeout(() => fig.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
}
$('backPaper').onclick = () => setStage('draw');
$('savePaper').onclick = async () => {
  const W = ITEM.w, H = ITEM.h, c = document.createElement('canvas'); c.width = W; c.height = H;
  board.composeInto(c.getContext('2d'), 0, 0, W, H);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  urls.forEach(u => URL.revokeObjectURL(u)); urls = [URL.createObjectURL(blob)]; count('save-paper'); sheet();
};
$('saveLines').onclick = async () => {
  const art = artPNG(2048); if (!art) return;
  const blob = await new Promise(r => art.canvas.toBlob(r, 'image/png'));
  urls.forEach(u => URL.revokeObjectURL(u)); urls = [URL.createObjectURL(blob)]; count('save-lines'); sheet();
};

// ---------- 起步 ----------
function credit() {
  if (paperMode) { $('credit').textContent = 'The paper is drawn by this page.'; return; }
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
  credit(); rooms(); tray(); tab('draw'); setTool('pen'); setColor(COLORS[0]);
  (ITEM.saw || []).forEach((s, i) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = named(s.word); b.onclick = () => showOurs(i); $('chips').appendChild(b); });
  photo.alt = ITEM.kind === 'oldsky' ? `${ITEM.credit.title}, a painting of the sky` : 'A real cloud';
  fitFigure(fig, ITEM.w, ITEM.h); fitFigure($('ours'), ITEM.w, ITEM.h); bleed();
  photo.onload = () => {
    board.resize(); restore(); changed(); previews();
    photo.onload = () => { board.resize(); previews(); };   // 之后换纸、换画幅只重排，不再读档
    if (paperMode) paperControls(); else carryIn();
  };
  if (paperMode) { const sky = document.querySelector('.appgrid [data-app=sky]'); sky.parentElement.prepend(sky); }
  photo.src = ITEM.src; $('photo2').src = ITEM.src;
  $('photo2').onload = () => { if (stage === 'reveal') showOurs(showing); };
  let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => {
    board.resetZoom();
    if (focused) { $('focusTip').textContent = focusTip(); fitFocus(); } else fitFigure(fig, ITEM.w, ITEM.h);
    fitFigure($('ours'), ITEM.w, ITEM.h); bleed(); board.resize(1); previews(); if (stage === 'reveal') showOurs(showing);
  }, 150); });
  count(isToday ? 'view-today' : 'view-' + ITEM.kind);
}
let ITEM;
if (paperMode) {
  // 存着的那张纸先读出来：纸色以网址为准（从屋子里点了别的纸），画幅以存档为准
  try { const old = store && JSON.parse(store.getItem(key) || 'null'); if (old && ASPECTS[old.aspect]) aspect = old.aspect; } catch (_) {}
  const [W, H] = ASPECTS[aspect];
  ITEM = { id: 'paper', kind: 'paper', src: makePaper(paperKind, aspect), w: W, h: H, saw: [] };
  boot();
} else {
  const s = document.createElement('script'); s.src = `items/${id}.js`;
  s.onload = () => { ITEM = window.ITEM; boot(); };
  document.head.appendChild(s);
}
