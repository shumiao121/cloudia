// 「走进云里」（11-18）：照片拆成两层——蓝天（把云抠掉、用周围的天补上）和云；画浮在云前面一点。
// 镜头先停在原图上，等你的线一笔一笔重新画出来、贴纸弹出来；再往你的画推进去（天、云、画离镜头远近不同，推的时候错开，看得出纵深）；
// 停一下，冲进雾里，一片白；出来就在云里面了——只剩你的画在雾里漂，雾从身边飘过。
// 整段画在一块 720×1280 的画布上，同时录成小视频（9:16，十三四秒），可以分享到 Threads / Reels。
// 网页上只做「动」，不做「亮」：发光、月光留给 app，结尾一句「In the app, it lights up.」。
import { commitOp } from './board.js';

const FW = 720, FH = 1280, CY = 0.46;
const D_SKY = 5, D_CLOUD = 2.4, D_DRAW = 2.0;            // 离镜头的远近：天最远，云其次，画在云前面一点
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t = clamp(t, 0, 1), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const backOut = t => { t = clamp(t, 0, 1); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function rng(seed) { let s = seed % 2147483646 + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }

// ---------- 拆照片：哪里是蓝天（偏蓝、够亮），其余（白云、灰云、老画里的山和地）都算「云」那层 ----------
function analyse(photo) {
  const A = photo.naturalWidth / photo.naturalHeight;
  const sw = 160, sh = Math.max(8, Math.round(sw / A));
  const c = mk(sw, sh), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(photo, 0, 0, sw, sh);
  const d = g.getImageData(0, 0, sw, sh).data, n = sw * sh, sky = new Float32Array(n);
  let sn = 0, sr = 0, sg = 0, sb = 0, ar = 0, ag = 0, ab = 0;
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    ar += r; ag += gg; ab += b;
    const s = smooth(12, 40, b - (r + gg) / 2) * smooth(45, 95, b);   // 深蓝的天也算天；灰云 r≈g≈b 不算
    sky[i] = s;
    if (s > 0.6) { sr += r; sg += gg; sb += b; sn++; }
  }
  const avg = sn > n * 0.02 ? [sr / sn, sg / sn, sb / sn] : [ar / n, ag / n, ab / n].map(v => Math.min(255, v * 1.06));

  // 蓝天那层：粗格子（宽 40）上只留天的颜色，云盖住的格子从四周往里渗；四边再往外延一圈，竖屏上下不够的地方也是天
  const gw = 40, gh = Math.max(4, Math.round(gw / A)), P = 40, cw = sw / gw, ch = sh / gh;
  const col = new Float32Array(gw * gh * 3), known = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let w = 0, r = 0, gg = 0, b = 0;
    for (let yy = Math.floor(y * ch); yy < Math.floor((y + 1) * ch); yy++) for (let xx = Math.floor(x * cw); xx < Math.floor((x + 1) * cw); xx++) {
      const i = yy * sw + xx, k = sky[i]; w += k; r += d[i * 4] * k; gg += d[i * 4 + 1] * k; b += d[i * 4 + 2] * k;
    }
    const j = y * gw + x, cells = Math.max(1, Math.floor(cw) * Math.floor(ch));
    if (w > cells * 0.35) { known[j] = 1; col[j * 3] = r / w; col[j * 3 + 1] = gg / w; col[j * 3 + 2] = b / w; }
    else { col[j * 3] = avg[0]; col[j * 3 + 1] = avg[1]; col[j * 3 + 2] = avg[2]; }
  }
  for (let it = 0; it < 160; it++) for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const j = y * gw + x; if (known[j]) continue;
    for (let k = 0; k < 3; k++) {
      let s = 0, m = 0;
      if (x > 0) { s += col[(j - 1) * 3 + k]; m++; } if (x < gw - 1) { s += col[(j + 1) * 3 + k]; m++; }
      if (y > 0) { s += col[(j - gw) * 3 + k]; m++; } if (y < gh - 1) { s += col[(j + gw) * 3 + k]; m++; }
      col[j * 3 + k] = s / m;
    }
  }
  const pw = gw + 2 * P, ph = gh + 2 * P, pc = mk(pw, ph), pg = pc.getContext('2d'), im = pg.createImageData(pw, ph);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const sx = clamp(x - P, 0, gw - 1), sy = clamp(y - P, 0, gh - 1), j = sy * gw + sx, o = (y * pw + x) * 4;
    // 照片上面越往上越深一点，下面越往下越淡（近地平线的雾）
    const up = clamp((P - y) / P, 0, 1), down = clamp((y - P - gh) / P, 0, 1);
    for (let k = 0; k < 3; k++) im.data[o + k] = clamp(col[j * 3 + k] * (1 - 0.18 * up) + (255 - col[j * 3 + k]) * 0.35 * down, 0, 255);
    im.data[o + 3] = 255;
  }
  pg.putImageData(im, 0, 0);
  const skyC = upscale(pc, 8);

  // 云那层：原图 × (1 − 蓝天) × 四边淡出；遮罩先模糊一下，边是软的
  const W = Math.min(1280, photo.naturalWidth), H = W / A;
  const cloud = mk(W, H), cg = cloud.getContext('2d');
  cg.drawImage(photo, 0, 0, W, H);
  const mc = mk(sw, sh), mg = mc.getContext('2d'), md = mg.createImageData(sw, sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    let s = 0, m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < sw && yy < sh) { s += sky[yy * sw + xx]; m++; } }
    const u = (x + 0.5) / sw, v = (y + 0.5) / sh;
    const edge = smooth(0, 0.06, u) * smooth(0, 0.06, 1 - u) * smooth(0, 0.08, v) * smooth(0, 0.08, 1 - v);
    const o = (y * sw + x) * 4; md.data[o] = md.data[o + 1] = md.data[o + 2] = 255; md.data[o + 3] = Math.round(255 * (1 - s / m) * edge);
  }
  mg.putImageData(md, 0, 0);
  cg.globalCompositeOperation = 'destination-in'; cg.imageSmoothingQuality = 'high';
  cg.drawImage(upscale(mc, 4), 0, 0, W, H); cg.globalCompositeOperation = 'source-over';
  return { A, avg, sky: skyC, skyPad: { u: P / gw, v: P / gh }, cloud };
}
function upscale(src, times) {   // 分两步放大，比一步放大少些格子感
  let c = src;
  for (const k of [Math.ceil(Math.sqrt(times)), Math.ceil(times / Math.ceil(Math.sqrt(times)))]) {
    const n = mk(c.width * k, c.height * k), g = n.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n.width, n.height); c = n;
  }
  return c;
}

// ---------- 雾团：二十来个软边的白圆叠成一团积云（底平、顶上鼓），不是一个个光斑 ----------
let puffSprite = null;
function puff() {
  if (puffSprite) return puffSprite;
  const c = mk(320, 220), g = c.getContext('2d'), r = rng(23);
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI, x = 160 + Math.cos(a) * (40 + r() * 80) * (r() < 0.5 ? -1 : 1), y = 150 - Math.sin(a) * (20 + r() * 70), rad = 34 + r() * 46;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,.30)'); gr.addColorStop(0.6, 'rgba(255,255,255,.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 320, 220);
  }
  return (puffSprite = c);
}

// ---------- 画在哪：把画缩小一份，看不透明的像素占哪块 ----------
function bboxOf(art) {
  const s = 200 / Math.max(art.width, art.height), w = Math.max(1, Math.round(art.width * s)), h = Math.max(1, Math.round(art.height * s));
  const c = mk(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(art, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  return { u0: x0 / w, v0: y0 / h, u1: (x1 + 1) / w, v1: (y1 + 1) / h };
}

// ---------- 页面上那层全屏 ----------
function overlay(storeHref) {
  let el = document.getElementById('inside');
  if (el) return el;
  el = document.createElement('div'); el.id = 'inside'; el.className = 'inside'; el.hidden = true;
  el.innerHTML = `<canvas id="insideCanvas" width="${FW}" height="${FH}" role="img" aria-label="Your drawing, inside the cloud"></canvas>
    <button class="inside-x" id="insideClose" aria-label="Close">×</button>
    <div class="inside-bar" id="insideBar" hidden>
      <button class="primary" id="insideShare">Share video</button>
      <button id="insideReplay">Replay</button>
      <a class="inside-app" id="insideApp" href="${storeHref}">Get Cloudia</a>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  for (const m of ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'])
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) {}
  return null;
}

/**
 * 打开「走进云里」。photo：页面上的照片（已经加载好）；board：画板（读 strokes / stickers，用 composeInto 出高清的画）；
 * line：结尾大字（「I saw a whale.」）；sub：小字（「Drawn on a real cloud」）；count：计数器。
 */
export async function stepInside({ photo, board, line, sub, storeHref, count = () => {}, at = null }) {
  const el = overlay(storeHref), cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const bar = el.querySelector('#insideBar'), shareBtn = el.querySelector('#insideShare');
  el.hidden = false; bar.hidden = true;
  const prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
  g.fillStyle = '#F6F3EC'; g.fillRect(0, 0, FW, FH);
  g.fillStyle = '#5D6771'; g.font = '28px -apple-system, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Stepping inside…', FW / 2, FH / 2);
  await new Promise(r => { requestAnimationFrame(() => setTimeout(r, 30)); setTimeout(r, 120); });   // 先让「Stepping inside…」露个面；页面在后台时 rAF 不来，靠计时器
  try { await document.fonts.load('600 58px Fraunces'); } catch (_) {}

  // ---------- 准备：拆照片、算画在哪、出两份画（逐笔重画用的低清一份，推近以后用的高清一份） ----------
  const S = analyse(photo), A = S.A;
  let Wp = FW, Hp = FW / A;
  if (Hp > FH * 0.7) { Hp = FH * 0.7; Wp = Hp * A; }
  const cx = FW / 2, cy = FH * CY;
  const low = { ink: mk(Wp, Hp), fill: mk(Wp, Hp) };
  const lowArt = mk(Wp, Hp); board.composeInto(lowArt.getContext('2d'), 0, 0, Wp, Hp, { photo: false });
  const bb = bboxOf(lowArt);
  const box = bb || { u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7 };
  const bw = Math.max(0.08, box.u1 - box.u0), bh = Math.max(0.08, box.v1 - box.v0);
  const ut = (box.u0 + box.u1) / 2, vt = (box.v0 + box.v1) / 2;
  const kd = clamp(Math.min(0.8 * FW / (bw * Wp), 0.56 * FH / (bh * Hp)), 1.3, 4.2);   // 停下来时画放大几倍
  const zA = D_DRAW * (1 - 1 / kd);
  const kIn = clamp(Math.min(0.8 * FW / (bw * Wp), 0.5 * FH / (bh * Hp)), 0.6, 6);   // 云里面那一幕画多大
  const R = clamp(Math.max(kd, kIn), 1, 2400 / Math.max(Wp, Hp));
  const hiLines = mk(Wp * R, Hp * R), hiArt = mk(Wp * R, Hp * R);
  board.composeInto(hiLines.getContext('2d'), 0, 0, hiLines.width, hiLines.height, { photo: false, stickers: false });
  board.composeInto(hiArt.getContext('2d'), 0, 0, hiArt.width, hiArt.height, { photo: false });

  // 逐笔重画的节奏：按线的总长分时间，一秒画 900 像素左右，最短 1 秒、最长 2.8 秒
  const ops = board.strokes.filter(s => s.t !== 'eraser' || s.p?.length);
  const lenOf = s => { if (!s.p || s.p.length < 2 || s.t === 'fill' || s.t === 'shape') return 0; let L = 0; for (let i = 1; i < s.p.length; i++) L += Math.hypot((s.p[i][0] - s.p[i - 1][0]) * Wp, (s.p[i][1] - s.p[i - 1][1]) * Hp); return L; };
  const lens = ops.map(lenOf), unit = ops.map((s, i) => Math.max(lens[i], 30));
  const total = unit.reduce((a, b) => a + b, 0);
  const T0 = 0.5, drawDur = ops.length ? clamp(total / 900, 1.0, 2.8) : 0;
  const stk = board.stickers, popDur = stk.length ? 0.35 + 0.07 * Math.min(stk.length, 10) : 0;
  const T1 = T0 + drawDur + popDur + 0.25, DOLLY = 3.0, HOLD = 1.3, RUSH = 1.1, INSIDE = 4.4;
  const T2 = T1 + DOLLY, T3 = T2 + HOLD, T4 = T3 + RUSH, TEND = T4 + INSIDE;

  // 冲进去时身边那些雾，和云里面那一幕的雾
  const r1 = rng(7), rush = Array.from({ length: 16 }, () => ({ d: lerp(zA + 0.2, D_DRAW - 0.03, r1()), x: (r1() - 0.5) * 1.5, y: (r1() - 0.5) * 2.2, s: lerp(0.35, 0.7, r1()) }));
  const r2 = rng(11), drift = Array.from({ length: 16 }, () => ({ x: (r2() - 0.5) * 2.4, y: (r2() - 0.5) * 2.6, z0: r2() * 2.8, s: lerp(0.7, 1.3, r2()) }));
  const skyTop = `rgb(${S.avg.map(v => Math.round(lerp(v, 255, 0.45))).join(',')})`;

  // ---------- 一帧 ----------
  let doneN = 0;   // 低清那份已经并进去几笔
  const tmp = mk(Wp, Hp);
  const px = { x: 0, y: 0, tx: 0, ty: 0 };
  function camAt(t) {
    const p = ease((t - T1) / DOLLY);
    let z = 0.05 * smooth(0, T1, t) + (zA - 0.05) * p;
    if (t > T3) z += (D_DRAW - 0.035 - zA) * Math.pow(clamp((t - T3) / RUSH, 0, 1), 2.6);
    const hold = smooth(T1 + DOLLY * 0.6, T2, t) * (1 - smooth(T3, T3 + 0.3, t));
    const sx = Math.sin(t * 0.9) * 0.012 * Wp * hold + px.x * 0.02 * Wp, sy = Math.cos(t * 0.7) * 0.008 * Hp * hold + px.y * 0.015 * Hp;
    return { x: (ut - 0.5) * Wp * D_DRAW * p + sx, y: (vt - 0.5) * Hp * D_DRAW * p + sy, z };
  }
  // 一层在屏幕上的位置：照片坐标 (u, v) → 屏幕
  const layer = (cam, d) => { const k = d / (d - cam.z); return { k, ox: cx - 0.5 * Wp * k - cam.x / (d - cam.z), oy: cy - 0.5 * Hp * k - cam.y / (d - cam.z) }; };

  function drawLines(t, L) {   // 逐笔重画：已经画完的几笔在低清那份里，正在画的那一笔现画
    const f = clamp((t - T0) / Math.max(drawDur, 0.01), 0, 1) * total;
    let acc = 0, cur = -1, frac = 1;
    for (let i = 0; i < ops.length; i++) { if (acc + unit[i] <= f) { acc += unit[i]; continue; } cur = i; frac = (f - acc) / unit[i]; break; }
    const upto = cur < 0 ? ops.length : cur;
    while (doneN < upto) commitOp(low.ink, low.fill, ops[doneN++]);
    const W = Wp * L.k, H = Hp * L.k;
    g.drawImage(low.fill, L.ox, L.oy, W, H); g.drawImage(low.ink, L.ox, L.oy, W, H);
    if (cur >= 0 && frac > 0) {
      const s = ops[cur];
      if (s.t === 'fill' || s.t === 'shape' || s.t === 'eraser' || !s.p || s.p.length < 2) return;
      const n = Math.max(2, Math.ceil(s.p.length * frac));
      const tg = tmp.getContext('2d'); tg.clearRect(0, 0, tmp.width, tmp.height);
      commitOp(tmp, null, { ...s, p: s.p.slice(0, n) });
      g.drawImage(tmp, L.ox, L.oy, W, H);
    }
  }

  function scene(t) {
    const cam = camAt(t);
    g.fillStyle = skyTop; g.fillRect(0, 0, FW, FH);
    // 天
    const Ls = layer(cam, D_SKY), pu = S.skyPad.u, pv = S.skyPad.v;
    g.drawImage(S.sky, Ls.ox - pu * Wp * Ls.k, Ls.oy - pv * Hp * Ls.k, Wp * Ls.k * (1 + 2 * pu), Hp * Ls.k * (1 + 2 * pv));
    // 云
    const Lc = layer(cam, D_CLOUD);
    g.drawImage(S.cloud, Lc.ox, Lc.oy, Wp * Lc.k, Hp * Lc.k);
    // 画：先逐笔，再贴纸一个个弹出来，之后整张（高清）一起走
    const Ld = layer(cam, D_DRAW);
    if (t < T0 + drawDur + 0.02) drawLines(t, Ld);
    else if (t < T1) g.drawImage(hiLines, Ld.ox, Ld.oy, Wp * Ld.k, Hp * Ld.k);
    else g.drawImage(hiArt, Ld.ox, Ld.oy, Wp * Ld.k, Hp * Ld.k);
    if (t < T1 && t >= T0 + drawDur) {
      const W = Wp * Ld.k, H = Hp * Ld.k;
      stk.forEach((s, i) => {
        const a = (t - T0 - drawDur - Math.min(i, 10) * 0.07) / 0.32; if (a <= 0) return;
        const k = backOut(a);
        g.save(); g.translate(Ld.ox + s.x * W, Ld.oy + s.y * H); g.scale(k, k); g.globalAlpha = clamp(a * 2, 0, 1);
        board._paintObj(g, s, 0, 0, s.w * W); g.restore();
      });
    }
    // 冲进雾里
    if (t > T3) {
      const a0 = smooth(T3, T3 + 0.45, t), sp = puff();
      for (const q of rush) {
        const dz = q.d - cam.z; if (dz < 0.02) continue;
        const sz = q.s * Wp * 1.4 / dz, X = (ut - 0.5) * Wp * q.d + q.x * Wp * 0.5, Y = (vt - 0.5) * Hp * q.d + q.y * Hp * 0.5;
        g.globalAlpha = a0 * smooth(0.02, 0.12, dz);
        g.drawImage(sp, cx + (X - cam.x) / dz - sz / 2, cy + (Y - cam.y) / dz - sz * 0.34, sz, sz * 0.6875);
      }
      g.globalAlpha = 1;
      g.fillStyle = `rgba(250,249,245,${smooth(T3 + 0.4, T4, t)})`; g.fillRect(0, 0, FW, FH);
    }
  }

  function inside(t) {
    const ti = t - T4;
    const bg = g.createLinearGradient(0, 0, 0, FH); bg.addColorStop(0, skyTop); bg.addColorStop(1, '#F6F3EC');
    g.fillStyle = bg; g.fillRect(0, 0, FW, FH);
    const sp = puff(), near = [];
    const drawPuff = (q, z, alpha) => {
      const sz = 640 * q.s / z, X = cx + (q.x * FW * 0.6 + px.x * 50) / z, Y = FH * 0.47 + (q.y * FH * 0.42 + px.y * 40) / z;
      g.globalAlpha = alpha; g.drawImage(sp, X - sz / 2, Y - sz * 0.34, sz, sz * 0.6875);
    };
    for (const q of drift) {
      const z = 0.25 + ((q.z0 - ti * 0.16) % 2.8 + 2.8) % 2.8;
      if (z < 1) { near.push([q, z]); continue; }
      drawPuff(q, z, 0.9 * smooth(3.05, 2.3, z));
    }
    g.globalAlpha = 1;
    // 你的画：只剩画，没有照片；慢慢漂、轻轻晃
    const sw = bw * hiArt.width, sh = bh * hiArt.height, k = kIn * Wp / hiArt.width * (0.92 + 0.08 * ease(ti / 0.9)) * (1 + 0.018 * Math.sin(ti * 1.1));
    g.save(); g.translate(cx + px.x * 14, FH * 0.47 + Math.sin(ti * 1.35) * 10 + px.y * 10); g.rotate(Math.sin(ti * 0.85) * 0.03);
    g.drawImage(hiArt, box.u0 * hiArt.width, box.v0 * hiArt.height, sw, sh, -sw * k / 2, -sh * k / 2, sw * k, sh * k);
    g.restore();
    for (const [q, z] of near) drawPuff(q, z, 0.5 * smooth(0.25, 0.6, z));
    g.globalAlpha = 1;
    // 字
    const a1 = smooth(0.7, 1.3, ti), a2 = smooth(1.5, 2.1, ti);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.globalAlpha = a1; g.fillStyle = '#28343E';
    let fs = 60; g.font = `600 ${fs}px Fraunces, Georgia, serif`;
    while (g.measureText(line).width > FW - 90 && fs > 32) { fs -= 4; g.font = `600 ${fs}px Fraunces, Georgia, serif`; }
    g.fillText(line, cx, FH * 0.12);
    g.font = '27px -apple-system, system-ui, sans-serif'; g.fillStyle = '#5D6771'; g.fillText(sub, cx, FH * 0.12 + 50);
    g.globalAlpha = a2; g.font = '600 46px Fraunces, Georgia, serif'; g.fillStyle = '#945D16'; g.fillText('Cloudia', cx, FH * 0.8);
    g.font = '27px -apple-system, system-ui, sans-serif'; g.fillStyle = '#5D6771'; g.fillText('In the app, it lights up.', cx, FH * 0.8 + 46);
    g.globalAlpha = 1;
    // 从白里出来
    if (ti < 0.9) { g.fillStyle = `rgba(250,249,245,${1 - smooth(0, 0.9, ti)})`; g.fillRect(0, 0, FW, FH); }
  }

  // ---------- 播放、录像 ----------
  const mime = pickMime();
  let raf = 0, start = 0, rec = null, file = null, url = null, closed = false, take = 0;
  function play() {
    doneN = 0; for (const c of [low.ink, low.fill]) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    bar.hidden = true; file = null;
    if (mime) {
      try {
        const chunks = [], mine = ++take;   // 每一遍录自己的；重播时上一遍的停下来就作废
        rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          if (closed || mine !== take || !chunks.length) return;
          const type = mime.split(';')[0], blob = new Blob(chunks, { type });
          file = new File([blob], `cloudia-inside.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
          if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
          shareBtn.disabled = false; shareBtn.textContent = canShareFile() ? 'Share video' : 'Save video';
        };
        rec.start(500);
      } catch (_) { rec = null; }
    }
    shareBtn.disabled = true; shareBtn.textContent = 'Preparing video…';
    shareBtn.hidden = !rec;
    start = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    if (closed) return;
    const t = at != null ? at : (now - start) / 1000;   // at：测试时定在某一秒看
    px.x += (px.tx - px.x) * 0.06; px.y += (px.ty - px.y) * 0.06;
    if (t < T4) scene(t); else inside(t);
    if (t >= TEND && rec && rec.state === 'recording') rec.stop();
    if (t >= TEND - 0.6 && bar.hidden) bar.hidden = false;
    if (at == null) raf = requestAnimationFrame(frame);
  }
  const canShareFile = () => !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  shareBtn.onclick = async () => {
    if (!file) return;
    count('inside-share');
    if (canShareFile()) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  };
  el.querySelector('#insideReplay').onclick = () => { count('inside-replay'); if (rec && rec.state === 'recording') { take++; rec.stop(); } play(); };
  const move = e => { const r = cv.getBoundingClientRect(); px.tx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1); px.ty = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1); };
  cv.onpointermove = move; cv.onpointerdown = move;
  cv.onpointerleave = () => { px.tx = px.ty = 0; };
  const close = () => {
    closed = true; cancelAnimationFrame(raf);
    if (rec && rec.state === 'recording') rec.stop();
    if (url) URL.revokeObjectURL(url);
    el.hidden = true; document.documentElement.style.overflow = prevOverflow;
    removeEventListener('keydown', esc);
  };
  const esc = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', esc);
  el.querySelector('#insideClose').onclick = close;
  play();
  return { close, duration: TEND, marks: { T0, T1, T2, T3, T4, TEND }, seek(t) { at = t; doneN = 0; for (const c of [low.ink, low.fill]) c.getContext('2d').clearRect(0, 0, c.width, c.height); frame(performance.now()); } };
}
