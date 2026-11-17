// 画板（11-17，网页第二版）：一张照片，上面三层——墨层（落定的笔）、湿层（正在画的这一笔）、贴纸层。
// 笔：Ink（快了变细）、Marker（半透明，叠两笔更深）、Crayon（纸纹）、Rainbow（一笔里变色）、Eraser。
// 坐标一律存成照片里的 0…1，线宽按照片宽的比例存，换尺寸、导出大图都照着重画。
// 抬笔只把这一笔并进墨层（不再整张重画）；撤回才从最近的快照往后重放。
import { byId as STICKER, paint as paintSticker } from './stickers.js';

export const PENS = ['ink', 'marker', 'crayon', 'rainbow', 'eraser'];
export const COLORS = ['#1A1B24', '#FFFFFF', '#E5484D', '#F28C28', '#F5C542', '#3FA45B', '#3B6FE0', '#E66FA8'];
export const SIZES = [0.0042, 0.0072, 0.013];
const PEN = {
  ink: { k: 1, alpha: 1 },
  marker: { k: 2.6, alpha: 0.55 },
  crayon: { k: 1.6, alpha: 1 },
  rainbow: { k: 1.4, alpha: 1 },
  eraser: { k: 3.2, alpha: 1 },
};
const SNAP_EVERY = 12;

// ---------- 纸纹：每种颜色一块 96px 的颗粒图，当描边的图案 ----------
const grainCache = new Map();
function grain(ctx, color) {
  if (!grainCache.has(color)) {
    const n = 96, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n);
    const [r, gg, b] = hex(color);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n * n; i++) {
      const a = rnd();
      img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = a < 0.28 ? 0 : Math.round(150 + a * 105);
    }
    g.putImageData(img, 0, 0);
    grainCache.set(color, c);
  }
  return ctx.createPattern(grainCache.get(color), 'repeat');
}
function hex(c) { const v = parseInt(c.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; }

// ---------- 画一笔（整笔，或者从第 from 个点起的那几段） ----------
function styleFor(ctx, s) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (s.t === 'crayon') { ctx.strokeStyle = ctx.fillStyle = grain(ctx, s.c); }
  else { ctx.strokeStyle = ctx.fillStyle = s.t === 'eraser' ? '#000' : s.c; }
}
function widthAt(s, q, W) { return (s.t === 'ink' ? (q[2] || s.w) : s.w) * W; }
export function drawStroke(ctx, s, W, H, from = 1, tail = true) {
  const p = s.p; if (!p.length) return;
  styleFor(ctx, s);
  if (p.length === 1) {
    if (s.t === 'rainbow') ctx.fillStyle = `hsl(${s.h0 || 0} 85% 55%)`;
    ctx.beginPath(); ctx.arc(p[0][0] * W, p[0][1] * H, widthAt(s, p[0], W) / 2, 0, Math.PI * 2); ctx.fill(); return;
  }
  let len = s.t === 'rainbow' ? lengthTo(p, Math.max(1, from) - 1, W, H) : 0;
  for (let i = Math.max(1, from); i < p.length; i++) {
    const a = p[i - 1], b = p[i], m = p[i - 2];
    const sx = m ? (m[0] + a[0]) / 2 : a[0], sy = m ? (m[1] + a[1]) / 2 : a[1];
    if (s.t === 'rainbow') { len += Math.hypot((b[0] - a[0]) * W, (b[1] - a[1]) * H); ctx.strokeStyle = `hsl(${((s.h0 || 0) + len / W * 900) % 360} 85% 55%)`; }
    ctx.lineWidth = (widthAt(s, a, W) + widthAt(s, b, W)) / 2;
    ctx.beginPath(); ctx.moveTo(sx * W, sy * H); ctx.quadraticCurveTo(a[0] * W, a[1] * H, (a[0] + b[0]) / 2 * W, (a[1] + b[1]) / 2 * H); ctx.stroke();
  }
  if (!tail) return;   // 边画边擦时不补收尾那一截，抬笔再补，和重放画出来的一模一样
  const z = p[p.length - 1], y = p[p.length - 2];
  ctx.lineWidth = widthAt(s, z, W);
  ctx.beginPath(); ctx.moveTo((y[0] + z[0]) / 2 * W, (y[1] + z[1]) / 2 * H); ctx.lineTo(z[0] * W, z[1] * H); ctx.stroke();
}
function lengthTo(p, n, W, H) { let L = 0; for (let i = 1; i <= n && i < p.length; i++) L += Math.hypot((p[i][0] - p[i - 1][0]) * W, (p[i][1] - p[i - 1][1]) * H); return L; }

/** 一笔并进目标画布：Marker 整笔半透明（自己叠自己不变深），Eraser 擦掉 */
let scratch = null;
export function commitStroke(target, s, W, H) {
  const g = target.getContext('2d');
  if (s.t === 'eraser') { g.save(); g.globalCompositeOperation = 'destination-out'; drawStroke(g, s, W, H); g.restore(); return; }
  if (PEN[s.t].alpha >= 1) { drawStroke(g, s, W, H); return; }
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== target.width || scratch.height !== target.height) { scratch.width = target.width; scratch.height = target.height; }
  const sc = scratch.getContext('2d'); sc.clearRect(0, 0, scratch.width, scratch.height);
  drawStroke(sc, s, W, H);
  g.save(); g.globalAlpha = PEN[s.t].alpha; g.drawImage(scratch, 0, 0); g.restore();
}

export class Board {
  /**
   * @param {HTMLElement} figure  照片和几层画布的容器（position:relative）
   * @param {HTMLImageElement} photo
   */
  constructor(figure, photo, { onChange, onZoom } = {}) {
    this.figure = figure; this.photo = photo; this.onChange = onChange || (() => {}); this.onZoom = onZoom || (() => {});
    this.box = photo.parentElement;   // .zoomer：照片和几层画布都在它里面，放大、平移只动它
    this.ink = mk('ink'); this.wet = mk('wet'); this.stk = mk('stk'); this.touch = mk('touch');
    this.box.append(this.ink, this.wet, this.stk, this.touch);
    this.sel = document.createElement('div'); this.sel.className = 'sel'; this.sel.hidden = true;
    this.sel.innerHTML = '<button class="sel-x" aria-label="Remove sticker">×</button><span class="sel-h" aria-hidden="true"></span>';
    this.box.append(this.sel);
    this.z = { s: 1, x: 0, y: 0 }; this.boost = 1; this.raw = new Map();
    this.strokes = []; this.stickers = [];
    this.history = []; this.future = [];
    this.snaps = [];            // [{n: 笔数, canvas}]
    this.pen = 'ink'; this.color = COLORS[0]; this.size = 1;
    this.mode = 'draw';         // 'draw' | 'stickers' | 'locked'
    this.selected = -1;
    this.cur = null; this.pointers = new Map();
    this._wire();
    function mk(cls) { const c = document.createElement('canvas'); c.className = 'layer ' + cls; return c; }
  }

  // ---------- 尺寸 ----------
  resize(boost = this.boost) {
    const cw = this.photo.offsetWidth, ch = this.photo.offsetHeight; if (!cw) return;
    const dpr = Math.min(devicePixelRatio || 1, 2.5);
    // 放大以后线不糊：画布跟着倍数加像素，但长边不超过 2560（手机上四层画布的内存）
    this.boost = Math.max(1, Math.min(boost, 2560 / (Math.max(cw, ch) * dpr)));
    const w = Math.round(cw * dpr * this.boost), h = Math.round(ch * dpr * this.boost);
    this.cssW = cw; this.cssH = ch; this.dpr = dpr;
    if (this.ink.width === w && this.ink.height === h) { this.renderStickers(); return; }
    for (const c of [this.ink, this.wet, this.stk, this.touch]) { c.width = w; c.height = h; }
    this.snaps = []; this.rebuild(); this.renderStickers();
  }

  // ---------- 墨层：撤回时从最近的快照往后重放 ----------
  rebuild() {
    const g = this.ink.getContext('2d'), W = this.ink.width, H = this.ink.height;
    g.clearRect(0, 0, W, H);
    let start = 0;
    const snap = [...this.snaps].reverse().find(s => s.n <= this.strokes.length && s.w === W);
    if (snap) { g.drawImage(snap.canvas, 0, 0); start = snap.n; }
    for (let i = start; i < this.strokes.length; i++) commitStroke(this.ink, this.strokes[i], W, H);
  }
  _maybeSnap() {
    const n = this.strokes.length;
    if (n % SNAP_EVERY) return;
    const c = document.createElement('canvas'); c.width = this.ink.width; c.height = this.ink.height;
    c.getContext('2d').drawImage(this.ink, 0, 0);
    this.snaps.push({ n, w: c.width, canvas: c });
    if (this.snaps.length > 3) this.snaps.shift();
  }

  // ---------- 贴纸层 ----------
  renderStickers() {
    const g = this.stk.getContext('2d'), W = this.stk.width, H = this.stk.height;
    g.clearRect(0, 0, W, H);
    for (const s of this.stickers) { const st = STICKER[s.k]; if (st) paintSticker(g, st, s.x * W, s.y * H, s.w * W, s.r); }
    this._placeSel();
  }
  _placeSel() {
    const s = this.stickers[this.selected];
    if (!s || this.mode !== 'stickers') { this.sel.hidden = true; return; }
    const st = STICKER[s.k], w = s.w * this.cssW, h = w / st.ratio;
    Object.assign(this.sel.style, { width: w + 'px', height: h + 'px', left: (s.x * this.cssW - w / 2) + 'px', top: (s.y * this.cssH - h / 2) + 'px', transform: `rotate(${s.r}rad)` });
    this.sel.hidden = false;
  }
  addSticker(k) {
    const before = this._stk();
    const n = this.stickers.length;
    this.stickers.push({ k, x: 0.5 + (n % 3 - 1) * 0.06, y: 0.45 + (n % 2) * 0.06, w: k === 'eyes' || k === 'sleepy' || k === 'wink' ? 0.22 : 0.16, r: 0 });
    this.selected = this.stickers.length - 1;
    this._push({ kind: 'stickers', before, after: this._stk() });
    this.renderStickers();
  }
  _stk() { return this.stickers.map(s => ({ ...s })); }
  _hit(x, y) {   // x, y：CSS 像素，相对画框
    for (let i = this.stickers.length - 1; i >= 0; i--) {
      const s = this.stickers[i], st = STICKER[s.k]; if (!st) continue;
      const cx = s.x * this.cssW, cy = s.y * this.cssH, w = s.w * this.cssW, h = w / st.ratio;
      const dx = x - cx, dy = y - cy, c = Math.cos(-s.r), sn = Math.sin(-s.r);
      const lx = dx * c - dy * sn, ly = dx * sn + dy * c;
      const pad = 10;
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
    if (e.kind === 'stroke') { this.strokes.push(e.stroke); commitStroke(this.ink, e.stroke, this.ink.width, this.ink.height); this._maybeSnap(); }
    else { this.stickers = e.after.map(s => ({ ...s })); this.renderStickers(); }
    this.history.push(e); this.onChange();
  }
  clear() {
    if (!this.strokes.length && !this.stickers.length) return;
    this.strokes = []; this.stickers = []; this.history = []; this.future = []; this.snaps = []; this.selected = -1;
    this.rebuild(); this.renderStickers(); this.onChange();
  }
  isEmpty() { return !this.strokes.length && !this.stickers.length; }
  hasLines() { return this.strokes.some(s => s.t !== 'eraser'); }

  // ---------- 存取（只在这台设备上） ----------
  toJSON() { return { strokes: this.strokes, stickers: this.stickers }; }
  load(d) {
    this.strokes = Array.isArray(d?.strokes) ? d.strokes : [];
    this.stickers = Array.isArray(d?.stickers) ? d.stickers.filter(s => STICKER[s.k]) : [];
    this.history = this.strokes.map(s => ({ kind: 'stroke' })); this.future = []; this.snaps = [];
    this.rebuild(); this.renderStickers(); this.onChange();
  }

  setMode(m) { this.mode = m; this.touch.classList.toggle('locked', m === 'locked'); if (m !== 'stickers') this.selected = -1; this._placeSel(); }

  // ---------- 导出：按指定像素重画（不是截屏幕） ----------
  composeInto(g, x, y, W, H, { lines = true, stickers = true } = {}) {
    g.drawImage(this.photo, x, y, W, H);
    if (lines && this.strokes.length) {
      const c = document.createElement('canvas'); c.width = Math.round(W); c.height = Math.round(H);
      for (const s of this.strokes) commitStroke(c, s, c.width, c.height);
      g.drawImage(c, x, y, W, H);
    }
    if (stickers) for (const s of this.stickers) { const st = STICKER[s.k]; if (st) paintSticker(g, st, x + s.x * W, y + s.y * H, s.w * W, s.r); }
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
      // 两根手指：画的时候是放大、平移整张图（这一笔作废）；贴纸模式下没选中贴纸时也是
      if (this.raw.size >= 2 && (this.mode === 'draw' || this.selected < 0)) {
        if (this.cur) { this.cur = null; this.curId = null; this._clearWet(); if (this._eraseFrom) this.rebuild(); }
        this._zpStart(); return;
      }
      if (this._zp) return;
      if (this.mode === 'stickers') return this._stickerDown(e, local(e));
      if (this.cur) return;
      this._strokeDown(e, local(e));
    });
    t.addEventListener('pointermove', e => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, local(e)); this.raw.set(e.pointerId, [e.clientX, e.clientY]);
      if (this._zp) return this._zpMove();
      if (this.mode === 'stickers') return this._stickerMove(e);
      if (this.cur && e.pointerId === this.curId) this._strokeMove(e);
    });
    const up = e => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId); this.raw.delete(e.pointerId);
      if (this._zp) { if (this.raw.size < 2) this._zpEnd(); return; }
      if (this.mode === 'stickers') return this._stickerUp(e);
      if (this.cur && e.pointerId === this.curId) this._strokeUp();
    };
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
    t.addEventListener('touchstart', e => { if (this.mode !== 'locked') e.preventDefault(); }, { passive: false });
    t.addEventListener('touchmove', e => { if (this.mode !== 'locked') e.preventDefault(); }, { passive: false });
    t.addEventListener('wheel', e => {   // 电脑上：Ctrl+滚轮（触控板捏合）放大；放大以后两指滑动平移；选中贴纸时滚轮缩放贴纸，按住 Shift 转
      if (this.mode === 'locked') return;
      if (!(this.mode === 'stickers' && this.selected >= 0)) {
        const fr = this._figRect();
        if (e.ctrlKey) {
          e.preventDefault();
          const s = clamp(this.z.s * Math.exp(-e.deltaY * 0.01), 1, 5), mx = e.clientX - fr.left, my = e.clientY - fr.top;
          const cx = (mx - this.z.x) / this.z.s, cy = (my - this.z.y) / this.z.s;
          this.setZoom(s, mx - cx * s, my - cy * s);
          clearTimeout(this._wz); this._wz = setTimeout(() => { if (Math.abs(this.z.s - this.boost) > 0.25 || (this.z.s < 1.05 && this.boost > 1)) this.resize(this.z.s); }, 250);
        } else if (this.z.s > 1) { e.preventDefault(); this.setZoom(this.z.s, this.z.x - e.deltaX, this.z.y - e.deltaY); }
        return;
      }
      e.preventDefault(); const s = this.stickers[this.selected];
      if (e.shiftKey) s.r += e.deltaY * 0.004; else s.w = clamp(s.w * Math.exp(-e.deltaY * 0.0015), 0.04, 0.9);
      this.renderStickers(); this._wheelCommit();
    }, { passive: false });
    this.sel.querySelector('.sel-x').addEventListener('click', e => {
      e.stopPropagation(); if (this.selected < 0) return;
      const before = this._stk(); this.stickers.splice(this.selected, 1); this.selected = -1;
      this._push({ kind: 'stickers', before, after: this._stk() }); this.renderStickers();
    });
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
      s.w = clamp(H.w0 * Math.hypot(e.clientX - H.cx, e.clientY - H.cy) / Math.max(8, H.d0), 0.04, 0.9);
      s.r = H.r0 + Math.atan2(e.clientY - H.cy, e.clientX - H.cx) - H.a0;
      this.renderStickers();
    });
    const hUp = e => { const H = this._handle; if (!H || e.pointerId !== H.id) return; this._handle = null; this._push({ kind: 'stickers', before: H.before, after: this._stk() }); };
    h.addEventListener('pointerup', hUp); h.addEventListener('pointercancel', hUp);
  }
  _wheelCommit() {
    if (!this._wheelBefore) this._wheelBefore = this.history.length && this.history[this.history.length - 1].after ? this.history[this.history.length - 1].after : this._stk();
    clearTimeout(this._wheelT);
    this._wheelT = setTimeout(() => { this._push({ kind: 'stickers', before: this._wheelBefore, after: this._stk() }); this._wheelBefore = null; }, 400);
  }

  // ---------- 放大、平移（两根手指） ----------
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
    const s = clamp(P.s0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / P.d0, 1, 5);
    this.setZoom(s, m[0] - P.c[0] * s, m[1] - P.c[1] * s);
  }
  _zpEnd() {
    this._zp = null;
    for (const id of [...this.pointers.keys()]) if (!this.raw.has(id)) this.pointers.delete(id);
    if (Math.abs(this.z.s - this.boost) > 0.25 || (this.z.s < 1.05 && this.boost > 1)) this.resize(this.z.s);   // 停下来再换分辨率，捏的时候不重画
  }
  setZoom(s, x, y) {
    const W = this.box.offsetWidth, H = this.box.offsetHeight;
    if (s <= 1.001) { s = 1; x = 0; y = 0; }
    this.z = { s, x: clamp(x, W - W * s, 0), y: clamp(y, H - H * s, 0) };
    this.box.style.transform = s === 1 ? '' : `translate(${this.z.x}px, ${this.z.y}px) scale(${s})`;
    this.onZoom(this.z.s);
  }
  resetZoom() { this.setZoom(1, 0, 0); if (this.boost > 1) this.resize(1); }

  _clearWet() { const g = this.wet.getContext('2d'); g.clearRect(0, 0, this.wet.width, this.wet.height); }
  _strokeDown(e, [x, y]) {
    const W = this.cssW, H = this.cssH, base = SIZES[this.size] * PEN[this.pen].k / this.z.s;
    const s = { t: this.pen, c: this.color, w: +base.toFixed(5), p: [[+(x / W).toFixed(4), +(y / H).toFixed(4), +base.toFixed(5)]] };
    if (s.t === 'rainbow') s.h0 = Math.round(Math.random() * 360);
    this.cur = s; this.curId = e.pointerId; this.last = { x: e.clientX, y: e.clientY, t: performance.now(), w: base };
    this.wet.style.opacity = PEN[s.t].alpha;
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
      if (s.t === 'ink') {
        if (ev.pointerType === 'pen' && ev.pressure > 0) w = s.w * (0.4 + 1.2 * ev.pressure);
        else { const v = Math.hypot(dx, dy) / Math.max(1, t - this.last.t); const target = s.w * clamp(1.25 - v * 0.3, 0.55, 1.2); w = this.last.w + (target - this.last.w) * 0.25; }
      }
      s.p.push([+((ev.clientX - r.left) / r.width).toFixed(4), +((ev.clientY - r.top) / r.height).toFixed(4), +w.toFixed(5)]);
      this.last = { x: ev.clientX, y: ev.clientY, t, w };
    }
    if (s.p.length === n0) return;
    if (s.t === 'eraser') this._paintEraser();
    else drawStroke(this.wet.getContext('2d'), s, this.wet.width, this.wet.height, n0);
  }
  _paintEraser() {   // 橡皮直接擦墨层，看得见擦到哪
    const g = this.ink.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-out';
    drawStroke(g, this.cur, this.ink.width, this.ink.height, this._eraseFrom, false); g.restore();
    this._eraseFrom = this.cur.p.length;
  }
  _eraserTail(s) {
    if (s.p.length < 2) return;
    const g = this.ink.getContext('2d'); g.save(); g.globalCompositeOperation = 'destination-out';
    drawStroke(g, s, this.ink.width, this.ink.height, s.p.length, true); g.restore();
  }
  _strokeUp() {
    const s = this.cur; this.cur = null; this.curId = null;
    if (s.t !== 'eraser') { this._clearWet(); commitStroke(this.ink, s, this.ink.width, this.ink.height); }
    else this._eraserTail(s);
    this.strokes.push(s); this._maybeSnap();
    this._push({ kind: 'stroke' });
  }

  _stickerDown(e, [x, y]) {
    const pts = [...this.pointers.values()];
    if (pts.length === 2 && this.selected >= 0) {   // 两根手指：捏合缩放、转
      const s = this.stickers[this.selected];
      this._pinch = { d0: dist(pts[0], pts[1]), a0: ang(pts[0], pts[1]), w0: s.w, r0: s.r, before: this._drag ? this._drag.before : this._stk() };
      this._drag = null; return;
    }
    const i = this._hit(x, y);
    this.selected = i;
    if (i >= 0) { const s = this.stickers[i]; this._drag = { id: e.pointerId, ox: x - s.x * this.cssW, oy: y - s.y * this.cssH, before: this._stk(), moved: false }; }
    this._placeSel();
  }
  _stickerMove(e) {
    const s = this.stickers[this.selected]; if (!s) return;
    if (this._pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      s.w = clamp(this._pinch.w0 * dist(a, b) / Math.max(8, this._pinch.d0), 0.04, 0.9);
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
