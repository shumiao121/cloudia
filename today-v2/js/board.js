// 画板（11-17 第二版，11-18 第三版「工作台」）：一张照片，上面几层——
//   填色层（围住的地方涂色，垫在线下面）→ 墨层（落定的笔）→ 湿层（正在画的这一笔 / 正在拉的形状）→ 贴纸层（贴纸和文字）。
// 笔 12 种（见 PENS），另有形状（直线、箭头、方框、椭圆）、填色桶、吸管、对称（左右、四向、六瓣）。
// 坐标一律存成照片里的 0…1，线宽按照片宽的比例存，换尺寸、导出大图都照着重画。
// 抬笔只把这一笔并进去；撤回从最近的快照往后重放。放大（两指 / Ctrl+滚轮）只动 .zoomer，停下再提高画布分辨率。
import { byId as STICKER, paint as paintSticker, paintText, textRatio } from './stickers.js';

export const PENS = ['ink', 'pencil', 'brush', 'marker', 'highlighter', 'crayon', 'calligraphy', 'airbrush', 'neon', 'rainbow', 'dashed', 'eraser'];
export const PEN_NAMES = { ink: 'Ink', pencil: 'Pencil', brush: 'Brush', marker: 'Marker', highlighter: 'Highlighter', crayon: 'Crayon', calligraphy: 'Calligraphy', airbrush: 'Airbrush', neon: 'Neon', rainbow: 'Rainbow', dashed: 'Dashed', eraser: 'Eraser' };
export const SHAPES = ['line', 'arrow', 'rect', 'ellipse'];
export const COLORS = ['#1A1B24', '#FFFFFF', '#E5484D', '#F28C28', '#F5C542', '#3FA45B', '#3B6FE0', '#E66FA8'];
export const SYMS = { off: 1, m2: 2, m4: 4, r6: 6 };
// k：线宽倍数；alpha：整笔的透明度（自己叠自己不变深）；full：画的时候整笔重画（虚线、霓虹要连起来）
const PEN = {
  ink: { k: 1, alpha: 1 }, pencil: { k: 0.5, alpha: 0.9 }, brush: { k: 1.7, alpha: 1 }, marker: { k: 2.6, alpha: 0.55 },
  highlighter: { k: 3.6, alpha: 0.38 }, crayon: { k: 1.6, alpha: 1 }, calligraphy: { k: 2.4, alpha: 1 }, airbrush: { k: 4.5, alpha: 1 },
  neon: { k: 1.2, alpha: 1, full: true }, rainbow: { k: 1.4, alpha: 1 }, dashed: { k: 1, alpha: 1, full: true }, eraser: { k: 3.2, alpha: 1 },
  shape: { k: 1, alpha: 1, full: true },
};
/** 粗细滑杆 1…100 → 线宽（照片宽的比例） */
export function sizeToWidth(n) { return 0.0012 + Math.pow(n / 100, 1.6) * 0.03; }
const SNAP_EVERY = 12;

// ---------- 纸纹：每种颜色一块颗粒图，当描边的图案（蜡笔粗、铅笔细） ----------
const grainCache = new Map();
function grain(ctx, color, fine) {
  const key = color + (fine ? 'f' : 'c');
  if (!grainCache.has(key)) {
    const n = fine ? 64 : 96, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n);
    const [r, gg, b] = hex(color);
    let seed = fine ? 11 : 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n * n; i++) {
      const a = rnd();
      img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = fine ? (a < 0.45 ? 0 : Math.round(120 + a * 135)) : (a < 0.28 ? 0 : Math.round(150 + a * 105));
    }
    g.putImageData(img, 0, 0);
    grainCache.set(key, c);
  }
  return ctx.createPattern(grainCache.get(key), 'repeat');
}
export function hex(c) { const v = parseInt(c.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }
function rng(seed) { let s = (seed % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------- 对称：同一笔按中心转 / 翻，画好几份 ----------
function symCount(s) { return SYMS[s.sym] || 1; }
function symApply(ctx, s, k, W, H) {
  if (!k) return;
  ctx.translate(W / 2, H / 2);
  if (s.sym === 'm2') ctx.scale(-1, 1);
  else if (s.sym === 'm4') ctx.scale(k & 1 ? -1 : 1, k & 2 ? -1 : 1);
  else if (s.sym === 'r6') ctx.rotate(k * Math.PI / 3);
  ctx.translate(-W / 2, -H / 2);
}

// ---------- 画一笔（整笔，或者从第 from 个点起的那几段） ----------
function widthAt(s, q, W) { return ((s.t === 'ink' || s.t === 'brush') ? (q[2] || s.w) : s.w) * W; }
export function drawStroke(ctx, s, W, H, from = 1, tail = true) {
  const n = symCount(s);
  if (n === 1) return drawOne(ctx, s, W, H, from, tail);
  for (let k = 0; k < n; k++) { ctx.save(); symApply(ctx, s, k, W, H); drawOne(ctx, s, W, H, from, tail); ctx.restore(); }
}
function drawOne(ctx, s, W, H, from, tail) {
  const p = s.p; if (!p || !p.length) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  const col = s.t === 'eraser' ? '#000' : s.c;
  if (s.t === 'shape') return drawShape(ctx, s, W, H);
  if (s.t === 'airbrush') return drawSpray(ctx, s, W, H, from);
  if (s.t === 'neon' || s.t === 'dashed') return drawWhole(ctx, s, W, H);
  if (s.t === 'crayon' || s.t === 'pencil') ctx.strokeStyle = ctx.fillStyle = grain(ctx, col, s.t === 'pencil');
  else ctx.strokeStyle = ctx.fillStyle = col;
  if (s.t === 'highlighter') ctx.lineCap = 'butt';
  if (p.length === 1) {
    if (s.t === 'rainbow') ctx.fillStyle = `hsl(${s.h0 || 0} 85% 55%)`;
    ctx.beginPath(); ctx.arc(p[0][0] * W, p[0][1] * H, widthAt(s, p[0], W) / 2, 0, Math.PI * 2); ctx.fill(); return;
  }
  let len = s.t === 'rainbow' ? lengthTo(p, Math.max(1, from) - 1, W, H) : 0;
  for (let i = Math.max(1, from); i < p.length; i++) {
    const a = p[i - 1], b = p[i], m = p[i - 2];
    const sx = m ? (m[0] + a[0]) / 2 : a[0], sy = m ? (m[1] + a[1]) / 2 : a[1];
    if (s.t === 'rainbow') { len += Math.hypot((b[0] - a[0]) * W, (b[1] - a[1]) * H); ctx.strokeStyle = `hsl(${((s.h0 || 0) + len / W * 900) % 360} 85% 55%)`; }
    let w = (widthAt(s, a, W) + widthAt(s, b, W)) / 2;
    if (s.t === 'calligraphy') {   // 斜 45° 的扁笔尖：横着走细、斜着走粗
      const th = Math.atan2((b[1] - a[1]) * H, (b[0] - a[0]) * W);
      w *= 0.18 + 0.82 * Math.abs(Math.sin(th - Math.PI / 4));
    }
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(sx * W, sy * H); ctx.quadraticCurveTo(a[0] * W, a[1] * H, (a[0] + b[0]) / 2 * W, (a[1] + b[1]) / 2 * H); ctx.stroke();
  }
  if (!tail) return;   // 边画边擦时不补收尾那一截，抬笔再补，和重放画出来的一模一样
  const z = p[p.length - 1], y = p[p.length - 2];
  ctx.lineWidth = widthAt(s, z, W) * (s.t === 'calligraphy' ? 0.5 : 1);
  ctx.beginPath(); ctx.moveTo((y[0] + z[0]) / 2 * W, (y[1] + z[1]) / 2 * H); ctx.lineTo(z[0] * W, z[1] * H); ctx.stroke();
}
function pathOf(ctx, p, W, H) {
  ctx.beginPath(); ctx.moveTo(p[0][0] * W, p[0][1] * H);
  if (p.length === 1) { ctx.lineTo(p[0][0] * W + 0.01, p[0][1] * H); return; }
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    ctx.quadraticCurveTo(a[0] * W, a[1] * H, (a[0] + b[0]) / 2 * W, (a[1] + b[1]) / 2 * H);
  }
  const z = p[p.length - 1]; ctx.lineTo(z[0] * W, z[1] * H);
}
function drawWhole(ctx, s, W, H) {
  const lw = s.w * W;
  if (s.t === 'dashed') {
    ctx.setLineDash([lw * 2.2, lw * 1.8]); ctx.strokeStyle = s.c; ctx.lineWidth = lw; pathOf(ctx, s.p, W, H); ctx.stroke(); ctx.setLineDash([]); return;
  }
  // 霓虹：外圈淡、里圈浓、芯发白，三遍整条路径
  const [r, g, b] = hex(s.c);
  pathOf(ctx, s.p, W, H);
  ctx.strokeStyle = `rgba(${r},${g},${b},0.18)`; ctx.lineWidth = lw * 4.2; ctx.stroke();
  ctx.strokeStyle = `rgba(${r},${g},${b},0.45)`; ctx.lineWidth = lw * 2.2; ctx.stroke();
  ctx.strokeStyle = s.c; ctx.lineWidth = lw * 1.1; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = lw * 0.45; ctx.stroke();
}
function drawSpray(ctx, s, W, H, from) {
  const p = s.p, R = s.w * W / 2, dot = Math.max(0.6, R * 0.07);
  ctx.fillStyle = s.c;
  for (let i = Math.max(0, from - 1); i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[i];
    const seg = Math.hypot((b[0] - a[0]) * W, (b[1] - a[1]) * H);
    const n = Math.min(120, Math.round(14 + seg * 0.9 * (R > 0 ? 6 / Math.max(2, R) : 1)));
    const rnd = rng((s.seed || 1) * 7919 + i);
    for (let j = 0; j < n; j++) {
      const t = rnd(), ang = rnd() * Math.PI * 2, rr = R * Math.sqrt(rnd());
      const x = (a[0] + (b[0] - a[0]) * t) * W + Math.cos(ang) * rr, y = (a[1] + (b[1] - a[1]) * t) * H + Math.sin(ang) * rr;
      ctx.globalAlpha = 0.35 + rnd() * 0.5;
      ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
    }
  }
  ctx.globalAlpha = 1;
}
function drawShape(ctx, s, W, H) {
  const [a, b] = [s.p[0], s.p[s.p.length - 1]], x0 = a[0] * W, y0 = a[1] * H, x1 = b[0] * W, y1 = b[1] * H, lw = s.w * W;
  ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = lw;
  ctx.beginPath();
  if (s.kind === 'rect') ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  else if (s.kind === 'ellipse') ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.max(0.5, Math.abs(x1 - x0) / 2), Math.max(0.5, Math.abs(y1 - y0) / 2), 0, 0, Math.PI * 2);
  else { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
  if (s.filled && (s.kind === 'rect' || s.kind === 'ellipse')) ctx.fill(); else ctx.stroke();
  if (s.kind === 'arrow') {
    const th = Math.atan2(y1 - y0, x1 - x0), L = Math.max(lw * 3.2, 10);
    ctx.beginPath(); ctx.moveTo(x1 - L * Math.cos(th - 0.45), y1 - L * Math.sin(th - 0.45)); ctx.lineTo(x1, y1); ctx.lineTo(x1 - L * Math.cos(th + 0.45), y1 - L * Math.sin(th + 0.45)); ctx.stroke();
  }
}
function lengthTo(p, n, W, H) { let L = 0; for (let i = 1; i <= n && i < p.length; i++) L += Math.hypot((p[i][0] - p[i - 1][0]) * W, (p[i][1] - p[i - 1][1]) * H); return L; }
function alphaOf(s) { return (PEN[s.t] ? PEN[s.t].alpha : 1) * (s.o == null ? 1 : s.o); }

/** 一笔（或一次填色）并进画布：半透明的整笔合成（自己叠自己不变深）；橡皮两层都擦 */
let scratch = null;
function scratchFor(t) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== t.width || scratch.height !== t.height) { scratch.width = t.width; scratch.height = t.height; }
  const g = scratch.getContext('2d'); g.clearRect(0, 0, scratch.width, scratch.height); return g;
}
export function commitOp(ink, fill, s) {
  const W = ink.width, H = ink.height;
  if (s.t === 'fill') return floodFill(ink, fill, s);
  if (s.t === 'eraser') {
    for (const c of [ink, fill]) { if (!c) continue; const g = c.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-out'; drawStroke(g, s, W, H); g.restore(); }
    return true;
  }
  const g = ink.getContext('2d'), a = alphaOf(s);
  if (a >= 1) { drawStroke(g, s, W, H); return true; }
  drawStroke(scratchFor(ink), s, W, H);
  g.save(); g.globalAlpha = a; g.drawImage(scratch, 0, 0); g.restore();
  return true;
}
/** 填色：墨层上的线当墙，从点下去的地方漫开；漫到画边就是没围住，不填。填的颜色放在填色层（线下面） */
export function floodFill(ink, fill, s) {
  const W = ink.width, H = ink.height;
  const sx = Math.floor(s.x * W), sy = Math.floor(s.y * H);
  if (sx < 0 || sy < 0 || sx >= W || sy >= H) return false;
  const data = ink.getContext('2d').getImageData(0, 0, W, H).data;
  const wall = new Uint8Array(W * H);
  for (let i = 0, j = 3; i < wall.length; i++, j += 4) wall[i] = data[j] > 70 ? 1 : 0;
  if (wall[sy * W + sx]) return false;
  const seen = new Uint8Array(W * H), stack = [sx, sy];
  let count = 0, edge = false;
  while (stack.length) {
    const y = stack.pop(), x0 = stack.pop();
    let x = x0;
    while (x >= 0 && !wall[y * W + x] && !seen[y * W + x]) x--;
    x++;
    let up = false, dn = false;
    while (x < W && !wall[y * W + x] && !seen[y * W + x]) {
      seen[y * W + x] = 1; count++;
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) edge = true;
      if (y > 0) { const k = (y - 1) * W + x; if (!wall[k] && !seen[k]) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
      if (y < H - 1) { const k = (y + 1) * W + x; if (!wall[k] && !seen[k]) { if (!dn) { stack.push(x, y + 1); dn = true; } } else dn = false; }
      x++;
    }
    if (edge) return false;
  }
  if (count < 4) return false;
  // 往外胖一两个像素，钻进线的毛边底下，不留白缝
  const r = Math.max(1, Math.round(W * 0.0018)), grow = new Uint8Array(seen);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!seen[y * W + x]) continue;
    for (let dy = -r; dy <= r; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx >= 0 && xx < W) grow[yy * W + xx] = 1; } }
  }
  const [cr, cg, cb] = hex(s.c), alpha = Math.round(255 * (s.o == null ? 1 : s.o));
  const g = fill.getContext('2d'), out = g.getImageData(0, 0, W, H), d = out.data;
  for (let i = 0, j = 0; i < grow.length; i++, j += 4) if (grow[i]) { d[j] = cr; d[j + 1] = cg; d[j + 2] = cb; d[j + 3] = alpha; }
  g.putImageData(out, 0, 0);
  return true;
}

export class Board {
  /**
   * @param {HTMLElement} figure  画框（裁掉放大后多出来的部分）
   * @param {HTMLImageElement} photo  照片；它的父元素是 .zoomer，几层画布都放进去
   */
  constructor(figure, photo, { onChange, onZoom, onPick, onNote } = {}) {
    this.figure = figure; this.photo = photo;
    this.onChange = onChange || (() => {}); this.onZoom = onZoom || (() => {}); this.onPick = onPick || (() => {}); this.onNote = onNote || (() => {});
    this.box = photo.parentElement;
    this.fill = mk('fill'); this.ink = mk('ink'); this.wet = mk('wet'); this.stk = mk('stk'); this.touch = mk('touch');
    this.box.append(this.fill, this.ink, this.wet, this.stk, this.touch);
    this.sel = document.createElement('div'); this.sel.className = 'sel'; this.sel.hidden = true;
    this.sel.innerHTML = '<button class="sel-x" aria-label="Remove">×</button><span class="sel-h" aria-hidden="true"></span>';
    this.box.append(this.sel);
    this.z = { s: 1, x: 0, y: 0 }; this.boost = 1; this.raw = new Map();
    this.strokes = []; this.stickers = [];       // strokes：笔、形状、填色，按先后；stickers：贴纸和文字
    this.history = []; this.future = []; this.snaps = [];
    this.tool = 'pen';                           // 'pen' | 'shape' | 'fill' | 'pick'
    this.pen = 'ink'; this.shape = 'line'; this.shapeFilled = false;
    this.color = COLORS[0]; this.sizeN = 30; this.opacity = 1; this.sym = 'off';
    this.mode = 'draw';                          // 'draw' | 'stickers' | 'locked'
    this.selected = -1; this.cur = null; this.pointers = new Map(); this.spaceDown = false;
    this._wire();
    function mk(cls) { const c = document.createElement('canvas'); c.className = 'layer ' + cls; return c; }
  }

  // ---------- 尺寸 ----------
  resize(boost = this.boost) {
    const cw = this.photo.offsetWidth, ch = this.photo.offsetHeight; if (!cw) return;
    const dpr = Math.min(devicePixelRatio || 1, 2.5);
    // 放大以后线不糊：画布跟着倍数加像素，但长边不超过 2560（手机上几层画布的内存）
    this.boost = Math.max(1, Math.min(boost, 2560 / (Math.max(cw, ch) * dpr)));
    const w = Math.round(cw * dpr * this.boost), h = Math.round(ch * dpr * this.boost);
    this.cssW = cw; this.cssH = ch; this.dpr = dpr;
    if (this.ink.width === w && this.ink.height === h) { this.renderStickers(); return; }
    for (const c of [this.fill, this.ink, this.wet, this.stk, this.touch]) { c.width = w; c.height = h; }
    this.snaps = []; this.rebuild(); this.renderStickers();
  }
  setPhotoFade(v) { this.photo.style.opacity = v; }

  // ---------- 重放：撤回时从最近的快照往后 ----------
  rebuild() {
    const W = this.ink.width, H = this.ink.height;
    for (const c of [this.fill, this.ink]) c.getContext('2d').clearRect(0, 0, W, H);
    let start = 0;
    const snap = [...this.snaps].reverse().find(s => s.n <= this.strokes.length && s.w === W);
    if (snap) { this.ink.getContext('2d').drawImage(snap.ink, 0, 0); this.fill.getContext('2d').drawImage(snap.fill, 0, 0); start = snap.n; }
    for (let i = start; i < this.strokes.length; i++) commitOp(this.ink, this.fill, this.strokes[i]);
  }
  _maybeSnap() {
    const n = this.strokes.length;
    if (n % SNAP_EVERY) return;
    const cp = src => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c; };
    this.snaps.push({ n, w: this.ink.width, ink: cp(this.ink), fill: cp(this.fill) });
    if (this.snaps.length > 2) this.snaps.shift();
  }

  // ---------- 贴纸和文字 ----------
  _ratio(s) { return s.k === 'text' ? (s.ratio || 3) : (STICKER[s.k]?.ratio || 1); }
  _paintObj(g, s, x, y, w) {
    if (s.k === 'text') paintText(g, s, x, y, w);
    else { const st = STICKER[s.k]; if (st) paintSticker(g, st, x, y, w, s.r, s.flip); }
  }
  renderStickers() {
    const g = this.stk.getContext('2d'), W = this.stk.width, H = this.stk.height;
    g.clearRect(0, 0, W, H);
    for (const s of this.stickers) this._paintObj(g, s, s.x * W, s.y * H, s.w * W);
    this._placeSel();
  }
  _placeSel() {
    const s = this.stickers[this.selected];
    if (!s || this.mode !== 'stickers') { this.sel.hidden = true; return; }
    const w = s.w * this.cssW, h = w / this._ratio(s);
    Object.assign(this.sel.style, { width: w + 'px', height: h + 'px', left: (s.x * this.cssW - w / 2) + 'px', top: (s.y * this.cssH - h / 2) + 'px', transform: `rotate(${s.r}rad)` });
    this.sel.hidden = false;
  }
  _addObj(o) {
    const before = this._stk();
    this.stickers.push(o); this.selected = this.stickers.length - 1;
    this._push({ kind: 'stickers', before, after: this._stk() });
    this.renderStickers();
  }
  addSticker(k) {
    const n = this.stickers.length, st = STICKER[k];
    this._addObj({ k, x: 0.5 + (n % 3 - 1) * 0.06, y: 0.45 + (n % 2) * 0.06, w: (st?.ratio || 1) >= 1.8 ? 0.22 : 0.15, r: 0 });
  }
  addText(text, font, color) {
    text = String(text).trim().slice(0, 40); if (!text) return;
    const o = { k: 'text', text, f: font, c: color, x: 0.5, y: 0.5, r: 0 };
    o.ratio = textRatio(o); o.w = Math.min(0.8, 0.07 * Math.max(3, o.ratio));
    this._addObj(o);
  }
  _stk() { return this.stickers.map(s => ({ ...s })); }
  _hit(x, y) {   // x, y：CSS 像素（未放大），相对画框
    for (let i = this.stickers.length - 1; i >= 0; i--) {
      const s = this.stickers[i];
      const cx = s.x * this.cssW, cy = s.y * this.cssH, w = s.w * this.cssW, h = w / this._ratio(s);
      const dx = x - cx, dy = y - cy, c = Math.cos(-s.r), sn = Math.sin(-s.r);
      const lx = dx * c - dy * sn, ly = dx * sn + dy * c, pad = 10 / this.z.s;
      if (Math.abs(lx) <= w / 2 + pad && Math.abs(ly) <= h / 2 + pad) return i;
    }
    return -1;
  }

  // ---------- 历史 ----------
  _push(e) { this.history.push(e); this.future = []; this.onChange(); }
  canUndo() { return this.history.length > 0; }
  canRedo() { return this.future.length > 0; }
  undo() {
    const e = this.history.pop(); if (!e) return;
    if (e.kind === 'stroke') { e.stroke = this.strokes.pop(); this.snaps = this.snaps.filter(s => s.n <= this.strokes.length); this.rebuild(); }
    else { this.stickers = e.before.map(s => ({ ...s })); this.selected = -1; this.renderStickers(); }
    this.future.push(e); this.onChange();
  }
  redo() {
    const e = this.future.pop(); if (!e) return;
    if (e.kind === 'stroke') { this.strokes.push(e.stroke); commitOp(this.ink, this.fill, e.stroke); this._maybeSnap(); }
    else { this.stickers = e.after.map(s => ({ ...s })); this.renderStickers(); }
    this.history.push(e); this.onChange();
  }
  clear() {
    if (this.isEmpty()) return;
    this.strokes = []; this.stickers = []; this.history = []; this.future = []; this.snaps = []; this.selected = -1;
    this.rebuild(); this.renderStickers(); this.onChange();
  }
  isEmpty() { return !this.strokes.length && !this.stickers.length; }

  // ---------- 存取（只在这台设备上） ----------
  toJSON() { return { strokes: this.strokes, stickers: this.stickers }; }
  load(d) {
    this.strokes = Array.isArray(d?.strokes) ? d.strokes : [];
    this.stickers = Array.isArray(d?.stickers) ? d.stickers.filter(s => s.k === 'text' || STICKER[s.k]) : [];
    this.history = this.strokes.map(() => ({ kind: 'stroke' })); this.future = []; this.snaps = [];
    this.rebuild(); this.renderStickers(); this.onChange();
  }

  setMode(m) { this.mode = m; this.touch.classList.toggle('locked', m === 'locked'); if (m !== 'stickers') this.selected = -1; this._placeSel(); this._cursor(); }
  setTool(t) { this.tool = t; this._cursor(); }
  _cursor() { this.touch.style.cursor = this.spaceDown ? 'grab' : this.mode === 'stickers' ? 'default' : this.tool === 'pick' ? 'copy' : this.tool === 'fill' ? 'cell' : 'crosshair'; }

  // ---------- 导出：按指定像素重画（不是截屏幕） ----------
  composeInto(g, x, y, W, H, { lines = true, stickers = true } = {}) {
    g.drawImage(this.photo, x, y, W, H);
    if (lines && this.strokes.length) {
      const ink = document.createElement('canvas'), fill = document.createElement('canvas');
      ink.width = fill.width = Math.round(W); ink.height = fill.height = Math.round(H);
      for (const s of this.strokes) commitOp(ink, fill, s);
      g.drawImage(fill, x, y, W, H); g.drawImage(ink, x, y, W, H);
    }
    if (stickers) for (const s of this.stickers) this._paintObj(g, s, x + s.x * W, y + s.y * H, s.w * W);
  }

  // ---------- 吸管：照片 + 填色 + 线叠起来的颜色 ----------
  pickAt(nx, ny) {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const g = c.getContext('2d', { willReadFrequently: true });
    const iw = this.photo.naturalWidth, ih = this.photo.naturalHeight;
    try {
      g.drawImage(this.photo, Math.floor(nx * iw), Math.floor(ny * ih), 1, 1, 0, 0, 1, 1);
      for (const L of [this.fill, this.ink]) g.drawImage(L, Math.floor(nx * L.width), Math.floor(ny * L.height), 1, 1, 0, 0, 1, 1);
      const d = g.getImageData(0, 0, 1, 1).data;
      return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    } catch (_) { return null; }
  }

  // ---------- 手势 ----------
  _wire() {
    const t = this.touch;
    const local = e => { const r = t.getBoundingClientRect(); return [(e.clientX - r.left) / this.z.s, (e.clientY - r.top) / this.z.s]; };
    t.addEventListener('pointerdown', e => {
      if (this.mode === 'locked') return;
      e.preventDefault();
      try { t.setPointerCapture(e.pointerId); } catch (_) {}
      this.pointers.set(e.pointerId, local(e)); this.raw.set(e.pointerId, [e.clientX, e.clientY]);
      // 两根手指：放大、平移整张图（这一笔作废）；按住空格或鼠标中键拖：平移
      if (this.raw.size >= 2 && (this.mode === 'draw' || this.selected < 0)) {
        if (this.cur) { this.cur = null; this.curId = null; this._clearWet(); this.rebuild(); }
        this._zpStart(); return;
      }
      if (this.spaceDown || e.button === 1) { this._pan = { id: e.pointerId, x: e.clientX, y: e.clientY, z0: { ...this.z } }; return; }
      if (this._zp) return;
      if (this.mode === 'stickers') return this._stickerDown(e, local(e));
      if (this.cur) return;
      const [x, y] = local(e), nx = x / this.cssW, ny = y / this.cssH;
      if (this.tool === 'pick') { const c = this.pickAt(nx, ny); if (c) this.onPick(c); return; }
      if (this.tool === 'fill') { this._fillAt(nx, ny); return; }
      if (this.tool === 'shape') return this._shapeDown(e, nx, ny);
      this._strokeDown(e, [x, y]);
    });
    t.addEventListener('pointermove', e => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, local(e)); this.raw.set(e.pointerId, [e.clientX, e.clientY]);
      if (this._zp) return this._zpMove();
      if (this._pan && e.pointerId === this._pan.id) { const P = this._pan; return this.setZoom(P.z0.s, P.z0.x + e.clientX - P.x, P.z0.y + e.clientY - P.y); }
      if (this.mode === 'stickers') return this._stickerMove(e);
      if (this.cur && e.pointerId === this.curId) { if (this.cur.t === 'shape') this._shapeMove(e); else this._strokeMove(e); }
    });
    const up = e => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId); this.raw.delete(e.pointerId);
      if (this._zp) { if (this.raw.size < 2) this._zpEnd(); return; }
      if (this._pan && e.pointerId === this._pan.id) { this._pan = null; return; }
      if (this.mode === 'stickers') return this._stickerUp(e);
      if (this.cur && e.pointerId === this.curId) this._strokeUp();
    };
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
    t.addEventListener('touchstart', e => { if (this.mode !== 'locked') e.preventDefault(); }, { passive: false });
    t.addEventListener('touchmove', e => { if (this.mode !== 'locked') e.preventDefault(); }, { passive: false });
    t.addEventListener('wheel', e => {   // 电脑上：Ctrl+滚轮（触控板捏合）放大；放大以后滚动平移；选中贴纸时滚轮缩放贴纸，按住 Shift 转
      if (this.mode === 'locked') return;
      if (!(this.mode === 'stickers' && this.selected >= 0)) {
        const fr = this._figRect();
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const s = clamp(this.z.s * Math.exp(-e.deltaY * 0.01), 1, 6), mx = e.clientX - fr.left, my = e.clientY - fr.top;
          const cx = (mx - this.z.x) / this.z.s, cy = (my - this.z.y) / this.z.s;
          this.setZoom(s, mx - cx * s, my - cy * s);
          clearTimeout(this._wz); this._wz = setTimeout(() => this._settleBoost(), 250);
        } else if (this.z.s > 1) { e.preventDefault(); this.setZoom(this.z.s, this.z.x - e.deltaX, this.z.y - e.deltaY); }
        return;
      }
      e.preventDefault(); const s = this.stickers[this.selected];
      if (e.shiftKey) s.r += e.deltaY * 0.004; else s.w = clamp(s.w * Math.exp(-e.deltaY * 0.0015), 0.03, 1.2);
      this.renderStickers(); this._wheelCommit();
    }, { passive: false });
    this.sel.querySelector('.sel-x').addEventListener('click', e => { e.stopPropagation(); this.removeSelected(); });
    // 右下角的把手：拖它同时缩放和旋转（手指、鼠标都能用）
    const h = this.sel.querySelector('.sel-h');
    h.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); if (this.selected < 0) return;
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
      const s = this.stickers[this.selected], r = t.getBoundingClientRect();
      const cx = r.left + s.x * r.width, cy = r.top + s.y * r.height;
      this._handle = { id: e.pointerId, cx, cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy), a0: Math.atan2(e.clientY - cy, e.clientX - cx), w0: s.w, r0: s.r, before: this._stk() };
    });
    h.addEventListener('pointermove', e => {
      const H = this._handle; if (!H || e.pointerId !== H.id) return;
      const s = this.stickers[this.selected];
      s.w = clamp(H.w0 * Math.hypot(e.clientX - H.cx, e.clientY - H.cy) / Math.max(8, H.d0), 0.03, 1.2);
      s.r = H.r0 + Math.atan2(e.clientY - H.cy, e.clientX - H.cx) - H.a0;
      this.renderStickers();
    });
    const hUp = e => { const H = this._handle; if (!H || e.pointerId !== H.id) return; this._handle = null; this._push({ kind: 'stickers', before: H.before, after: this._stk() }); };
    h.addEventListener('pointerup', hUp); h.addEventListener('pointercancel', hUp);
  }
  removeSelected() {
    if (this.selected < 0) return;
    const before = this._stk(); this.stickers.splice(this.selected, 1); this.selected = -1;
    this._push({ kind: 'stickers', before, after: this._stk() }); this.renderStickers();
  }
  /** 选中的贴纸 / 文字：往前一层、往后一层、复制、左右翻 */
  arrangeSelected(how) {
    const i = this.selected; if (i < 0) return;
    const before = this._stk(), s = this.stickers[i];
    if (how === 'front' && i < this.stickers.length - 1) { this.stickers.splice(i, 1); this.stickers.push(s); this.selected = this.stickers.length - 1; }
    else if (how === 'back' && i > 0) { this.stickers.splice(i, 1); this.stickers.unshift(s); this.selected = 0; }
    else if (how === 'copy') { this.stickers.push({ ...s, x: Math.min(0.95, s.x + 0.05), y: Math.min(0.95, s.y + 0.05) }); this.selected = this.stickers.length - 1; }
    else if (how === 'flip') s.flip = !s.flip;
    else return;
    this._push({ kind: 'stickers', before, after: this._stk() }); this.renderStickers();
  }
  _wheelCommit() {
    if (!this._wheelBefore) this._wheelBefore = this._stk();
    clearTimeout(this._wheelT);
    this._wheelT = setTimeout(() => { this._push({ kind: 'stickers', before: this._wheelBefore, after: this._stk() }); this._wheelBefore = null; }, 400);
  }

  // ---------- 放大、平移 ----------
  _figRect() { return this.figure.getBoundingClientRect(); }
  _zpStart() {
    const [a, b] = [...this.raw.values()], fr = this._figRect();
    const m = [(a[0] + b[0]) / 2 - fr.left, (a[1] + b[1]) / 2 - fr.top];
    this._zp = { d0: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), s0: this.z.s, c: [(m[0] - this.z.x) / this.z.s, (m[1] - this.z.y) / this.z.s] };
  }
  _zpMove() {
    if (this.raw.size < 2) return;
    const [a, b] = [...this.raw.values()], fr = this._figRect(), P = this._zp;
    const m = [(a[0] + b[0]) / 2 - fr.left, (a[1] + b[1]) / 2 - fr.top];
    const s = clamp(P.s0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / P.d0, 1, 6);
    this.setZoom(s, m[0] - P.c[0] * s, m[1] - P.c[1] * s);
  }
  _zpEnd() {
    this._zp = null;
    for (const id of [...this.pointers.keys()]) if (!this.raw.has(id)) this.pointers.delete(id);
    this._settleBoost();
  }
  _settleBoost() { if (Math.abs(this.z.s - this.boost) > 0.25 || (this.z.s < 1.05 && this.boost > 1)) this.resize(this.z.s); }
  setZoom(s, x, y) {
    const W = this.box.offsetWidth, H = this.box.offsetHeight;
    if (s <= 1.001) { s = 1; x = 0; y = 0; }
    this.z = { s, x: clamp(x, W - W * s, 0), y: clamp(y, H - H * s, 0) };
    this.box.style.transform = s === 1 ? '' : `translate(${this.z.x}px, ${this.z.y}px) scale(${s})`;
    this.onZoom(this.z.s);
  }
  zoomBy(f) {   // 按钮 / 键盘：以画框中心放大缩小
    const W = this.box.offsetWidth, H = this.box.offsetHeight, s = clamp(this.z.s * f, 1, 6);
    const cx = (W / 2 - this.z.x) / this.z.s, cy = (H / 2 - this.z.y) / this.z.s;
    this.setZoom(s, W / 2 - cx * s, H / 2 - cy * s); this._settleBoost();
  }
  resetZoom() { this.setZoom(1, 0, 0); if (this.boost > 1) this.resize(1); }

  // ---------- 笔 ----------
  _clearWet() { const g = this.wet.getContext('2d'); g.clearRect(0, 0, this.wet.width, this.wet.height); }
  _baseWidth(kind) { return sizeToWidth(this.sizeN) * (PEN[kind]?.k || 1) / this.z.s; }   // 放大以后笔在屏幕上一样粗
  _strokeDown(e, [x, y]) {
    const W = this.cssW, H = this.cssH, base = this._baseWidth(this.pen);
    const s = { t: this.pen, c: this.color, w: +base.toFixed(5), p: [[+(x / W).toFixed(4), +(y / H).toFixed(4), +base.toFixed(5)]] };
    if (this.opacity < 0.999) s.o = +this.opacity.toFixed(2);
    if (this.sym !== 'off') s.sym = this.sym;
    if (s.t === 'rainbow') s.h0 = Math.round(Math.random() * 360);
    if (s.t === 'airbrush') s.seed = 1 + Math.floor(Math.random() * 1e6);
    this.cur = s; this.curId = e.pointerId; this.last = { x: e.clientX, y: e.clientY, t: performance.now(), w: base };
    this.wet.style.opacity = alphaOf(s);
    if (s.t === 'eraser') { this._eraseFrom = 1; this._paintEraser(); }
    else { this._clearWet(); drawStroke(this.wet.getContext('2d'), s, this.wet.width, this.wet.height); }
  }
  _strokeMove(e) {
    const s = this.cur, list = e.getCoalescedEvents && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e];
    const r = this.touch.getBoundingClientRect(), n0 = s.p.length;
    for (const ev of list) {
      const dx = ev.clientX - this.last.x, dy = ev.clientY - this.last.y;
      if (Math.hypot(dx, dy) < 0.8) continue;
      const t = ev.timeStamp || performance.now();
      let w = s.w;
      if (s.t === 'ink' || s.t === 'brush') {
        if (ev.pointerType === 'pen' && ev.pressure > 0) w = s.w * (s.t === 'brush' ? 0.2 + 1.6 * ev.pressure : 0.4 + 1.2 * ev.pressure);
        else {
          const v = Math.hypot(dx, dy) / Math.max(1, t - this.last.t);
          const target = s.w * (s.t === 'brush' ? clamp(1.5 - v * 0.55, 0.25, 1.5) : clamp(1.25 - v * 0.3, 0.55, 1.2));
          w = this.last.w + (target - this.last.w) * (s.t === 'brush' ? 0.18 : 0.25);
        }
      }
      s.p.push([+((ev.clientX - r.left) / r.width).toFixed(4), +((ev.clientY - r.top) / r.height).toFixed(4), +w.toFixed(5)]);
      this.last = { x: ev.clientX, y: ev.clientY, t, w };
    }
    if (s.p.length === n0) return;
    if (s.t === 'eraser') this._paintEraser();
    else if (PEN[s.t].full) { this._clearWet(); drawStroke(this.wet.getContext('2d'), s, this.wet.width, this.wet.height); }
    else drawStroke(this.wet.getContext('2d'), s, this.wet.width, this.wet.height, n0);
  }
  _paintEraser() {   // 橡皮直接擦墨层和填色层，看得见擦到哪
    for (const L of [this.ink, this.fill]) {
      const g = L.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-out';
      drawStroke(g, this.cur, L.width, L.height, this._eraseFrom, false); g.restore();
    }
    this._eraseFrom = this.cur.p.length;
  }
  _eraserTail(s) {
    if (s.p.length < 2) return;
    for (const L of [this.ink, this.fill]) {
      const g = L.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-out';
      drawStroke(g, s, L.width, L.height, s.p.length, true); g.restore();
    }
  }
  _strokeUp() {
    const s = this.cur; this.cur = null; this.curId = null;
    if (s.t === 'shape') {
      const [a, b] = s.p; this._clearWet();
      if (Math.hypot((b[0] - a[0]) * this.cssW, (b[1] - a[1]) * this.cssH) < 3) return;
      commitOp(this.ink, this.fill, s);
    } else if (s.t !== 'eraser') { this._clearWet(); commitOp(this.ink, this.fill, s); }
    else this._eraserTail(s);
    this.strokes.push(s); this._maybeSnap();
    this._push({ kind: 'stroke' });
  }

  // ---------- 形状：按下拉开，Shift 拉正（直线 45°、正方形、正圆） ----------
  _shapeDown(e, nx, ny) {
    const s = { t: 'shape', kind: this.shape, c: this.color, w: +this._baseWidth('shape').toFixed(5), p: [[+nx.toFixed(4), +ny.toFixed(4)], [+nx.toFixed(4), +ny.toFixed(4)]] };
    if (this.shapeFilled && (s.kind === 'rect' || s.kind === 'ellipse')) s.filled = true;
    if (this.opacity < 0.999) s.o = +this.opacity.toFixed(2);
    if (this.sym !== 'off') s.sym = this.sym;
    this.cur = s; this.curId = e.pointerId; this.wet.style.opacity = alphaOf(s);
  }
  _shapeMove(e) {
    const s = this.cur, r = this.touch.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (e.shiftKey) {
      const a = s.p[0], A = this.cssW / this.cssH; let dx = x - a[0], dy = (y - a[1]) / A;
      if (s.kind === 'line' || s.kind === 'arrow') {
        const th = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, L = Math.hypot(dx, dy);
        dx = Math.cos(th) * L; dy = Math.sin(th) * L;
      } else { const m = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * m; dy = Math.sign(dy || 1) * m; }
      x = a[0] + dx; y = a[1] + dy * A;
    }
    s.p[1] = [+x.toFixed(4), +y.toFixed(4)];
    this._clearWet(); drawStroke(this.wet.getContext('2d'), s, this.wet.width, this.wet.height);
  }

  // ---------- 填色桶 ----------
  _fillAt(nx, ny) {
    const s = { t: 'fill', x: +nx.toFixed(4), y: +ny.toFixed(4), c: this.color };
    if (this.opacity < 0.999) s.o = +this.opacity.toFixed(2);
    if (!floodFill(this.ink, this.fill, s)) { this.onNote('fill'); return; }
    this.strokes.push(s); this._maybeSnap(); this._push({ kind: 'stroke' });
  }

  // ---------- 贴纸手势 ----------
  _stickerDown(e, [x, y]) {
    const pts = [...this.pointers.values()];
    if (pts.length === 2 && this.selected >= 0) {
      const s = this.stickers[this.selected];
      this._pinch = { d0: dist(pts[0], pts[1]), a0: ang(pts[0], pts[1]), w0: s.w, r0: s.r, before: this._drag ? this._drag.before : this._stk() };
      this._drag = null; return;
    }
    const i = this._hit(x, y);
    this.selected = i;
    if (i >= 0) { const s = this.stickers[i]; this._drag = { id: e.pointerId, ox: x - s.x * this.cssW, oy: y - s.y * this.cssH, before: this._stk(), moved: false }; }
    this._placeSel(); this.onChange();
  }
  _stickerMove(e) {
    const s = this.stickers[this.selected]; if (!s) return;
    if (this._pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      s.w = clamp(this._pinch.w0 * dist(a, b) / Math.max(8, this._pinch.d0), 0.03, 1.2);
      s.r = this._pinch.r0 + ang(a, b) - this._pinch.a0;
      this.renderStickers(); return;
    }
    const D = this._drag; if (!D || e.pointerId !== D.id) return;
    const [x, y] = this.pointers.get(e.pointerId);
    s.x = clamp((x - D.ox) / this.cssW, -0.1, 1.1); s.y = clamp((y - D.oy) / this.cssH, -0.1, 1.1); D.moved = true;
    this.renderStickers();
  }
  _stickerUp() {
    if (this._pinch && this.pointers.size < 2) { this._push({ kind: 'stickers', before: this._pinch.before, after: this._stk() }); this._pinch = null; return; }
    if (this._drag && !this.pointers.size) { if (this._drag.moved) this._push({ kind: 'stickers', before: this._drag.before, after: this._stk() }); this._drag = null; }
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function ang(a, b) { return Math.atan2(b[1] - a[1], b[0] - a[0]); }
