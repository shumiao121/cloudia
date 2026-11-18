// 「走进云里」天空之镜（11-18 第三版）：天是一张 360° 全景图（World Labs 生成的天空之镜，sky/pink.jpg）——
// 云在几公里外，人走几步本来就不会动，所以用全景最清楚也最对；立体感交给画：你的画和 18 幅「我们看见的」
// 浮在空中，远近、高低不同，转头、往前走时近的动得多，水面里各有一个倒影。
// 11-18 晚他说「涂鸦放进去不协调，应该把画变成一朵云」「转太快」：画不再是贴纸，而是沿着线长出来的积云——
// 顶上被晚霞照成桃粉、底下蓝灰，和全景里的云同一种光；你的画先一笔一笔画出来，再鼓成一朵云。开场一圈从 7 秒放慢到 16 秒。
// 开场这一段（约 21 秒）录成小视频。
// 只用浏览器自带的 WebGL，不引库、不从别的网站加载。只动不亮（发光留给 app）。
import { commitOp, drawStroke } from './board.js';
import { perspective, lookAt, mul, compile, bboxOf, pickMime, overlay } from './world.js';

const FW = 1080, FH = 1920, RW = 720, RH = 1280, SC = FW / 720, FOVY = 70 * Math.PI / 180, EYE = 1.6;   // 画面 1080×1920（手机上不糊），录像 720×1280
const PANO = 'sky/pink.jpg', PANO_SMALL = 'sky/pink-1k.jpg', PANO_TURN = 0.145;   // 大图（4608 宽）最多等 5 秒，等不到先用小图、到了再换；正前方对着那朵最高的粉云
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t = clamp(t, 0, 1), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function rng(seed) { let s = seed % 2147483646 + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }

const SKY_VS = `attribute vec2 aP; varying vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
const SKY_FS = `precision highp float; varying vec2 vP; uniform vec3 uR, uU, uF; uniform vec2 uTan; uniform sampler2D uT; uniform float uTurn;
void main(){ vec3 d = normalize(uF + uR * vP.x * uTan.x + uU * vP.y * uTan.y);
  float u = fract(0.5 + atan(d.x, -d.z) / 6.2831853 + uTurn); float v = acos(clamp(d.y, -1.0, 1.0)) / 3.14159265;
  gl_FragColor = vec4(texture2D(uT, vec2(u, v)).rgb, 1.0); }`;
const CARD_VS = `attribute vec3 aPos; attribute vec2 aUV; uniform mat4 uVP; varying vec2 vUV; void main(){ vUV = aUV; gl_Position = uVP * vec4(aPos, 1.0); }`;
const CARD_FS = `precision mediump float; varying vec2 vUV; uniform sampler2D uT; uniform float uA, uRefl, uTime;
void main(){ vec2 uv = vUV;
  if (uRefl > 0.5) uv.x += sin(uv.y * 40.0 + uTime * 1.7) * 0.005;           // 水面一点点晃
  vec4 c = texture2D(uT, uv); float a = c.a * uA;
  if (uRefl > 0.5) { a *= 0.42 * mix(0.12, 1.0, uv.y); c.rgb = mix(c.rgb, vec3(0.86, 0.80, 0.82), 0.3); }   // 倒影：淡、靠水面那头最清楚
  if (a < 0.003) discard; gl_FragColor = vec4(c.rgb * a, a); }`;

// ---------- 把画变成云 ----------
// 遮罩：画所在的地方（加粗一圈，细线也能长出云来）
function maskOf(src, sx, sy, sw, sh, W, H, ox, oy, ow, oh, dil) {
  const m = mk(W, H), g = m.getContext('2d');
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.drawImage(src, sx, sy, sw, sh, ox + Math.cos(a) * dil, oy + Math.sin(a) * dil, ow, oh); }
  g.drawImage(src, sx, sy, sw, sh, ox, oy, ow, oh);
  return m;
}
// 画 → 云：沿着遮罩撒大小不一的软团，叠成「厚度图」；再加两层噪声让边上起毛；按厚度的起伏打光——
// 朝上的地方被晚霞照成桃色，中间玫瑰色，背光处蓝灰，薄的边缘半透明。和全景里的积云同一种光。
function noise2(seed) {
  const h = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); };
}
function cloudify(mask, out, R, seed) {
  const W = out.width, H = out.height, md = mask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data, rnd = rng(seed);
  const step = Math.max(3, R * 0.45), pts = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    const jx = clamp(x + (rnd() - 0.5) * step, 0, W - 1), jy = clamp(y + (rnd() - 0.5) * step, 0, H - 1);
    if (md[(Math.round(jy) * W + Math.round(jx)) * 4 + 3] > 80) pts.push([jx, jy]);
  }
  // 1) 厚度：软团叠起来；每四个里一个大团往上鼓（积云的「花椰菜」顶）
  const dc = mk(W, H), dg = dc.getContext('2d', { willReadFrequently: true });
  const puff = (x, y, r, a) => { const gr = dg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.5, `rgba(255,255,255,${a * 0.6})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); dg.fillStyle = gr; dg.beginPath(); dg.arc(x, y, r, 0, Math.PI * 2); dg.fill(); };
  pts.forEach(([x, y], i) => {
    puff(x, y, R * (0.8 + rnd() * 0.6), 0.32);
    if (i % 4 === 0) puff(x + (rnd() - 0.5) * R, y - R * (0.3 + rnd() * 0.4), R * (1.1 + rnd() * 0.6), 0.22);
  });
  const D = dg.getImageData(0, 0, W, H).data, n1 = noise2(seed), n2 = noise2(seed + 7);
  const den = new Float32Array(W * H), f1 = 1 / (R * 0.7), f2 = 1 / (R * 0.28);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d0 = D[(y * W + x) * 4 + 3] / 255;
    den[y * W + x] = d0 <= 0 ? 0 : Math.min(1.2, d0 * 1.5 + (n1(x * f1, y * f1) - 0.5) * 0.35 * d0 + (n2(x * f2, y * f2) - 0.5) * 0.18);
  }
  // 2) 上色：法线来自厚度的起伏，光从上方偏左、朝着人
  const img = out.getContext('2d').createImageData(W, H), o = img.data, k = R * 0.9;
  const HI = [255, 228, 208], MID = [232, 192, 186], SH = [112, 124, 142];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, d = den[i]; if (d < 0.1) continue;
    const gx = (den[i - 1] - den[i + 1]) * k, gy = (den[i - W] - den[i + W]) * k;   // 朝外的方向
    const nz = 1, inv = 1 / Math.hypot(gx, gy, nz), lit = clamp((gx * -0.35 + gy * -0.8 + nz * 0.5) * inv, -1, 1);
    let sh = clamp(0.5 + lit * 0.55 + (0.5 - y / H) * 0.25 - (d - 0.6) * 0.25, 0, 1);
    const c = sh < 0.5 ? [0, 1, 2].map(j => lerp(SH[j], MID[j], sh * 2)) : [0, 1, 2].map(j => lerp(MID[j], HI[j], (sh - 0.5) * 2));
    o[i * 4] = c[0]; o[i * 4 + 1] = c[1]; o[i * 4 + 2] = c[2]; o[i * 4 + 3] = 255 * smooth(0.1, 0.42, d) * 0.97;
  }
  out.getContext('2d').putImageData(img, 0, 0);
}
// 「我们看见的」：只要云，不要线、不要字
function readingCloud(rd, seed) {
  const W = 640, H = Math.round(W / rd.aspect), c = mk(W, H), g = c.getContext('2d');
  for (const p of rd.strokes) drawStroke(g, { t: 'ink', c: '#000', w: 0.006, p }, W, H);
  const b = bboxOf(c) || { u0: 0, v0: 0, u1: 1, v1: 1 };
  const sw = (b.u1 - b.u0) * W, sh = (b.v1 - b.v0) * H, CW = 512, R = CW * 0.036, pad = Math.ceil(R * 2.6), scale = (CW - 2 * pad) / Math.max(sw, sh);
  const dw = sw * scale, dh = sh * scale, out = mk(CW, dh + 2 * pad);
  cloudify(maskOf(c, b.u0 * W, b.v0 * H, sw, sh, out.width, out.height, (CW - dw) / 2, pad, dw, dh, R * 0.3), out, R, seed);
  return out;
}

export async function enterSky({ photo, board, line, sub, storeHref, count = () => {}, at = null }) {
  const glc = mk(FW, FH);
  const gl = glc.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const el = overlay(storeHref), cv = el.querySelector('canvas'); cv.width = FW; cv.height = FH; const g = cv.getContext('2d');
  const rc = mk(RW, RH), rcg = rc.getContext('2d');   // 录像用的小一号画布
  const bar = el.querySelector('.inside-bar'), shareBtn = bar.querySelector('[data-act=share]'), hint = el.querySelector('.inside-hint');
  el.hidden = false; bar.hidden = true; hint.hidden = true;
  const prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
  g.fillStyle = '#F6F3EC'; g.fillRect(0, 0, FW, FH);
  g.fillStyle = '#5D6771'; g.font = `${28 * SC}px -apple-system, system-ui, sans-serif`; g.textAlign = 'center'; g.fillText('Opening the sky…', FW / 2, FH / 2);
  let pano, readings, bigReady = false;
  const big = new Image(); big.src = PANO;
  const bigP = big.decode().then(() => { bigReady = true; }).catch(() => {});
  try {
    pano = new Image(); pano.src = PANO_SMALL;
    [readings] = await Promise.all([fetch('sky/readings.json').then(r => r.json()), pano.decode(), document.fonts.load('600 34px Fraunces').catch(() => {})]);
    await Promise.race([bigP, new Promise(r => setTimeout(r, 5000))]);   // 清楚的那张最多等 5 秒
    if (bigReady) pano = big;
  } catch (_) { el.hidden = true; document.documentElement.style.overflow = prevOverflow; return null; }

  // ---------- 你的画：先出整张（定位用），逐笔重画时往卡片上一帧帧补 ----------
  const A = photo.naturalWidth / photo.naturalHeight, AW = 1024, AH = Math.round(AW / A);
  const fullArt = mk(AW, AH); board.composeInto(fullArt.getContext('2d'), 0, 0, AW, AH, { photo: false });
  const bb = bboxOf(fullArt) || { u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7 };
  const sx = bb.u0 * AW, sy = bb.v0 * AH, sw = (bb.u1 - bb.u0) * AW, sh = (bb.v1 - bb.v0) * AH;
  const mineW = 768, R = mineW * 0.036, pad = Math.ceil(R * 2.6), kk = (mineW - 2 * pad) / Math.max(sw, sh), mine = mk(mineW, sh * kk + 2 * pad);
  const ox = (mineW - sw * kk) / 2, dw = sw * kk, dh = sh * kk;
  // 逐笔重画时是你自己的线（带一圈淡淡的白光，粉天上看得清）；画完鼓成一朵云
  const mineDraw = (src) => { const mg = mine.getContext('2d'); mg.clearRect(0, 0, mine.width, mine.height); mg.save(); mg.shadowColor = 'rgba(255,255,255,0.9)'; mg.shadowBlur = 10; mg.drawImage(src, sx, sy, sw, sh, ox, pad, dw, dh); mg.restore(); mg.drawImage(src, sx, sy, sw, sh, ox, pad, dw, dh); };
  const mineCloud = mk(mine.width, mine.height);
  cloudify(maskOf(fullArt, sx, sy, sw, sh, mine.width, mine.height, ox, pad, dw, dh, R * 0.3), mineCloud, R, 7);
  const ops = board.strokes, ink = mk(AW, AH), fill = mk(AW, AH), live = mk(AW, AH), tmp = mk(AW, AH);
  const lenOf = s => { if (!s.p || s.p.length < 2 || s.t === 'fill' || s.t === 'shape') return 0; let L = 0; for (let i = 1; i < s.p.length; i++) L += Math.hypot((s.p[i][0] - s.p[i - 1][0]) * AW, (s.p[i][1] - s.p[i - 1][1]) * AH); return L; };
  const unit = ops.map(s => Math.max(lenOf(s), 40)), total = unit.reduce((a, b) => a + b, 0) || 1;
  const T0 = 0.7, drawDur = ops.length ? clamp(total / 1300, 1.0, 2.6) : 0;
  let doneN = 0, lastF = -1;
  function drawOn(t) {   // 返回 true 表示卡片变了，要重新上传
    const f = clamp((t - T0) / Math.max(drawDur, 0.01), 0, 1);
    if (f >= 1) { if (lastF < 1) { mineDraw(fullArt); lastF = 1; return true; } return false; }
    if (Math.abs(f - lastF) < 0.004) return false; lastF = f;
    const target = f * total; let acc = 0, cur = -1, frac = 1;
    for (let i = 0; i < ops.length; i++) { if (acc + unit[i] <= target) { acc += unit[i]; continue; } cur = i; frac = (target - acc) / unit[i]; break; }
    const upto = cur < 0 ? ops.length : cur;
    if (upto < doneN) { doneN = 0; for (const c of [ink, fill]) c.getContext('2d').clearRect(0, 0, AW, AH); }
    while (doneN < upto) commitOp(ink, fill, ops[doneN++]);
    const lg = live.getContext('2d'); lg.clearRect(0, 0, AW, AH); lg.drawImage(fill, 0, 0); lg.drawImage(ink, 0, 0);
    const s = ops[cur];
    if (s && frac > 0 && s.p && s.p.length >= 2 && s.t !== 'fill' && s.t !== 'shape' && s.t !== 'eraser') {
      tmp.getContext('2d').clearRect(0, 0, AW, AH); commitOp(tmp, null, { ...s, p: s.p.slice(0, Math.max(2, Math.ceil(s.p.length * frac))) }); lg.drawImage(tmp, 0, 0);
    }
    mineDraw(live); return true;
  }

  // ---------- 卡片摆在哪：你的在正前方；「我们看见的」按黄金角绕一圈，远近高低错开，正前方留空 ----------
  const r = rng(29), cards = [];
  const mineAspect = mine.width / mine.height, mineWidth = Math.min(2.8, 2.3 * mineAspect);
  cards.push({ canvas: mine, cloud: mineCloud, x: 0, y: EYE + 0.25, z: -4.4, w: mineWidth, h: mineWidth / mineAspect, ph: 0, mine: true });
  // 18 幅均匀绕一圈（正前方左右各留 34° 给你的画），一高一低、一近一远交替，挨着的两幅不会叠在一起
  const pick = readings.slice(0, 18), N = pick.length, DIST = [6.5, 9.5, 7.5, 11];
  pick.forEach((rd, i) => {
    const a = 0.6 + (i + 0.5) / N * (Math.PI * 2 - 1.2), d = DIST[i % 4] + r() * 0.8, c = readingCloud(rd, 100 + i), asp = c.width / c.height;
    const w = (2.3 + r() * 0.5) * (0.8 + d / 14), h = w / asp, y = i % 2 ? 3.5 + r() * 0.8 : 1.6 + r() * 0.4;
    cards.push({ canvas: c, x: Math.sin(a) * d, z: -Math.cos(a) * d, y: Math.max(h / 2 + 0.3, y), w, h, ph: r() * 6.28 });
  });

  // ---------- WebGL ----------
  const skyP = compile(gl, SKY_VS, SKY_FS), cardP = compile(gl, CARD_VS, CARD_FS);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const texOf = (src, repeat) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, wrap], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  const panoTex = texOf(pano, false);   // 4608×2304 不是 2 的幂：不用 mipmap、边上夹住；接缝在 fract 处，两头颜色本来就接得上
  if (!bigReady) bigP.then(() => { if (closed || !bigReady) return; gl.bindTexture(gl.TEXTURE_2D, panoTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, big); });
  drawOn(at != null ? at : 0);
  for (const c of cards) { c.tex = texOf(c.canvas, false); if (c.cloud) c.cloudTex = texOf(c.cloud, false); }
  const cardBuf = gl.createBuffer(), verts = new Float32Array(30);
  const proj = perspective(FOVY, FW / FH, 0.05, 200), tanY = Math.tan(FOVY / 2), tanX = tanY * FW / FH;

  // ---------- 镜头 ----------
  const cam = { x: 0, z: 0, yaw: 0, pitch: 0.04, user: false, vy: 0, vp: 0 };
  const TM = T0 + drawDur + 0.3, MORPH = 1.6;              // 画完 → 鼓成云
  const T1 = TM + MORPH + 0.6, TURN = 16, TEND = T1 + TURN + 1.4;   // 一整圈 16 秒（每秒二十来度），回到你的云
  let lastT = 0;
  function render(t) {
    const dt = clamp(t - lastT, 0, 0.1); lastT = t;
    if (!cam.user && t <= TEND) { cam.yaw = Math.PI * 2 * ease((t - T1) / TURN); cam.pitch = 0.05 + 0.1 * Math.sin(Math.PI * clamp((t - T1) / TURN, 0, 1)); }
    else if (!cam.user) cam.yaw += dt * 0.035;   // 开场完了没人碰：很慢地漂
    cam.yaw += cam.vy; cam.pitch = clamp(cam.pitch + cam.vp, -0.9, 1.2); cam.vy *= 0.92; cam.vp *= 0.92;
    const cp = Math.cos(cam.pitch), dir = [Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp];
    const eye = [cam.x, EYE, cam.z], L = lookAt(eye, [eye[0] + dir[0], eye[1] + dir[1], eye[2] + dir[2]]), VP = mul(proj, L.m);
    gl.viewport(0, 0, FW, FH); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(skyP.p);
    gl.uniform3fv(skyP.loc.uR, L.r); gl.uniform3fv(skyP.loc.uU, L.u); gl.uniform3fv(skyP.loc.uF, L.f); gl.uniform2f(skyP.loc.uTan, tanX, tanY); gl.uniform1f(skyP.loc.uTurn, PANO_TURN);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, panoTex); gl.uniform1i(skyP.loc.uT, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(skyP.loc.aP); gl.vertexAttribPointer(skyP.loc.aP, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(skyP.loc.aP);
    // 卡片：一律正对镜头（只绕竖轴转，始终立着）；远的先画；先画全部倒影再画卡片
    if (drawOn(t)) { gl.bindTexture(gl.TEXTURE_2D, cards[0].tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mine); }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.useProgram(cardP.p);
    gl.uniformMatrix4fv(cardP.loc.uVP, false, VP); gl.uniform1i(cardP.loc.uT, 0); gl.uniform1f(cardP.loc.uTime, t);
    gl.bindBuffer(gl.ARRAY_BUFFER, cardBuf);
    gl.enableVertexAttribArray(cardP.loc.aPos); gl.enableVertexAttribArray(cardP.loc.aUV);
    const rx = Math.cos(cam.yaw), rz = Math.sin(cam.yaw);   // 镜头的「右」（水平）
    const order = cards.map(c => ({ c, d: Math.hypot(c.x - cam.x, c.z - cam.z) })).sort((a, b) => b.d - a.d);
    const m = smooth(TM, TM + MORPH, t);   // 你的画 → 云
    for (const refl of [1, 0]) for (const { c } of order) {
      const pop = c.mine ? 1 : smooth(0, 0.6, t - 0.2), drift = Math.sin(t * 0.08 + c.ph) * 0.25;
      const y = c.y + Math.sin(t * 0.45 + c.ph) * 0.05, s = refl ? -1 : 1;
      const layers = c.mine ? [[c.cloudTex, m, 0.94 + 0.06 * m], [c.tex, 1 - m, 1]] : [[c.tex, pop, 1]];
      for (const [tex, alpha, k] of layers) {
        if (alpha <= 0.002) continue;
        const hw = c.w / 2 * k, hh = c.h / 2 * k, cx = c.x + rx * drift, cz = c.z + rz * drift;
        const x0 = cx - rx * hw, z0 = cz - rz * hw, x1 = cx + rx * hw, z1 = cz + rz * hw, yt = s * (y + hh), yb = s * (y - hh);
        verts.set([x0, yt, z0, 0, 0, x1, yt, z1, 1, 0, x0, yb, z0, 0, 1, x1, yt, z1, 1, 0, x1, yb, z1, 1, 1, x0, yb, z0, 0, 1]);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(cardP.loc.aPos, 3, gl.FLOAT, false, 20, 0); gl.vertexAttribPointer(cardP.loc.aUV, 2, gl.FLOAT, false, 20, 12);
        gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1f(cardP.loc.uA, alpha); gl.uniform1f(cardP.loc.uRefl, refl);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }
    gl.disableVertexAttribArray(cardP.loc.aPos); gl.disableVertexAttribArray(cardP.loc.aUV);

    // 合到 2D 画布（录像录的是它）：从白里出来；结尾的字
    g.drawImage(glc, 0, 0);
    const white = 1 - smooth(0, 0.8, t);
    if (white > 0) { g.fillStyle = `rgba(250,249,245,${white})`; g.fillRect(0, 0, FW, FH); }
    const ta = smooth(TEND - 2.6, TEND - 1.8, t) * (1 - smooth(TEND + 0.8, TEND + 1.6, t));
    if (ta > 0) {
      g.globalAlpha = ta; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.shadowColor = 'rgba(255,255,255,0.8)'; g.shadowBlur = 14 * SC;
      let fs = 60 * SC; g.font = `600 ${fs}px Fraunces, Georgia, serif`;
      while (g.measureText(line).width > FW - 90 * SC && fs > 32 * SC) { fs -= 4 * SC; g.font = `600 ${fs}px Fraunces, Georgia, serif`; }
      g.fillStyle = '#28343E'; g.fillText(line, FW / 2, FH * 0.11);
      g.font = `${27 * SC}px -apple-system, system-ui, sans-serif`; g.fillStyle = '#3C4652'; g.fillText(sub, FW / 2, FH * 0.11 + 50 * SC);
      g.font = `600 ${46 * SC}px Fraunces, Georgia, serif`; g.fillStyle = '#7A4A0F'; g.fillText('Cloudia', FW / 2, FH * 0.84);
      g.font = `${27 * SC}px -apple-system, system-ui, sans-serif`; g.fillStyle = '#3C4652'; g.fillText('In the app, it lights up.', FW / 2, FH * 0.84 + 46 * SC);
      g.shadowBlur = 0; g.globalAlpha = 1;
    }
    rcg.drawImage(cv, 0, 0, RW, RH);
  }

  // ---------- 手势：拖动转头；两指 / 滚轮往前后走（在 6 米以内）；双击回正 ----------
  const pts = new Map(); let pinch = 0;
  const walk = d => { cam.x += Math.sin(cam.yaw) * d; cam.z -= Math.cos(cam.yaw) * d; const L = Math.hypot(cam.x, cam.z); if (L > 6) { cam.x *= 6 / L; cam.z *= 6 / L; } };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); cam.user = true; hint.hidden = true; };
  cv.onpointermove = e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
    if (pts.size === 1) { const k = 1.2 / cv.getBoundingClientRect().width; cam.yaw -= dx * k; cam.pitch = clamp(cam.pitch + dy * k, -0.9, 1.2); cam.vy = -dx * k * 0.3; cam.vp = dy * k * 0.3; }
    else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) walk((d - pinch) * 0.012); pinch = d; }
  };
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
  cv.onpointerup = up; cv.onpointercancel = up;
  cv.onwheel = e => { e.preventDefault(); cam.user = true; walk(-e.deltaY * 0.004); };
  cv.ondblclick = () => Object.assign(cam, { x: 0, z: 0, yaw: 0, pitch: 0.04, vy: 0, vp: 0 });

  // ---------- 播放、录像 ----------
  const mime = pickMime();
  let raf = 0, start = 0, rec = null, file = null, url = null, closed = false, take = 0;
  function play() {
    bar.hidden = true; hint.hidden = true; file = null; lastF = -1; doneN = 0; lastT = 0; for (const c of [ink, fill]) c.getContext('2d').clearRect(0, 0, AW, AH);
    Object.assign(cam, { x: 0, z: 0, yaw: 0, pitch: 0.04, user: false, vy: 0, vp: 0 });
    if (mime) {
      try {
        const chunks = [], mineTake = ++take;
        rec = new MediaRecorder(rc.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          if (closed || mineTake !== take || !chunks.length) return;
          const type = mime.split(';')[0], blob = new Blob(chunks, { type });
          file = new File([blob], `cloudia-sky.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
          if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
          shareBtn.disabled = false; shareBtn.textContent = canShareFile() ? 'Share video' : 'Save video';
        };
        rec.start(500);
      } catch (_) { rec = null; }
    }
    shareBtn.disabled = true; shareBtn.textContent = 'Preparing video…'; shareBtn.hidden = !rec;
    start = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    if (closed) return;
    const t = at != null ? at : (now - start) / 1000;
    render(t);
    if (t >= TEND && rec && rec.state === 'recording') rec.stop();
    if (t >= TEND - 0.4 && bar.hidden) { bar.hidden = false; if (!cam.user) hint.hidden = false; }
    if (at == null) raf = requestAnimationFrame(frame);
  }
  const canShareFile = () => !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  shareBtn.onclick = async () => {
    if (!file) return;
    count('sky-share');
    if (canShareFile()) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  };
  bar.querySelector('[data-act=replay]').onclick = () => { count('sky-replay'); if (rec && rec.state === 'recording') { take++; rec.stop(); } play(); };
  const close = () => {
    closed = true; cancelAnimationFrame(raf);
    if (rec && rec.state === 'recording') rec.stop();
    if (url) URL.revokeObjectURL(url);
    el.hidden = true; document.documentElement.style.overflow = prevOverflow; removeEventListener('keydown', esc);
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
  };
  const esc = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', esc);
  el.querySelector('.inside-x').onclick = close;
  play();
  return { close, duration: TEND, cards: cards.length, cam, seek(t) { at = t; cam.user = false; Object.assign(cam, { x: 0, z: 0, vy: 0, vp: 0 }); frame(performance.now()); }, look(yaw, pitch, x = 0, z = 0) { at = TEND + 2; Object.assign(cam, { user: true, yaw, pitch, x, z, vy: 0, vp: 0 }); frame(performance.now()); } };
}
