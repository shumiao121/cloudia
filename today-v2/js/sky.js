// 「走进云里」天空之镜（11-18 第三版）：天是一张 360° 全景图（World Labs 生成的天空之镜，sky/pink.jpg）——
// 云在几公里外，人走几步本来就不会动，所以用全景最清楚也最对；立体感交给画：你的画和三十来幅「我们看见的」
// 是一张张浮在空中的卡片，远近、高低不同，转头、往前走时近的动得多，水面里各有一个倒影。
// 开场：从白里出来，你的画一笔一笔画出来，镜头慢慢转一整圈看见四周的画，回到你的画——这 11 秒录成小视频。
// 只用浏览器自带的 WebGL，不引库、不从别的网站加载。只动不亮（发光留给 app）。
import { commitOp, drawStroke } from './board.js';
import { perspective, lookAt, mul, compile, bboxOf, pickMime, overlay } from './world.js';

const FW = 720, FH = 1280, FOVY = 64 * Math.PI / 180, EYE = 1.6;
const PANO = 'sky/pink.jpg', PANO_SMALL = 'sky/pink-1k.jpg', PANO_TURN = 0.145;   // 先用小图进去，大图下好再换   // 正前方对着全景图里那朵最高的粉云
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t = clamp(t, 0, 1), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function rng(seed) { let s = seed % 2147483646 + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }

const SKY_VS = `attribute vec2 aP; varying vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
const SKY_FS = `precision highp float; varying vec2 vP; uniform vec3 uR, uU, uF; uniform vec2 uTan; uniform sampler2D uT; uniform float uTurn;
void main(){ vec3 d = normalize(uF + uR * vP.x * uTan.x + uU * vP.y * uTan.y);
  float u = 0.5 + atan(d.x, -d.z) / 6.2831853 + uTurn; float v = acos(clamp(d.y, -1.0, 1.0)) / 3.14159265;
  gl_FragColor = vec4(texture2D(uT, vec2(u, v)).rgb, 1.0); }`;
const CARD_VS = `attribute vec3 aPos; attribute vec2 aUV; uniform mat4 uVP; varying vec2 vUV; void main(){ vUV = aUV; gl_Position = uVP * vec4(aPos, 1.0); }`;
const CARD_FS = `precision mediump float; varying vec2 vUV; uniform sampler2D uT; uniform float uA, uRefl, uTime;
void main(){ vec2 uv = vUV;
  if (uRefl > 0.5) uv.x += sin(uv.y * 40.0 + uTime * 1.7) * 0.005;           // 水面一点点晃
  vec4 c = texture2D(uT, uv); float a = c.a * uA;
  if (uRefl > 0.5) { a *= 0.42 * mix(0.12, 1.0, uv.y); c.rgb = mix(c.rgb, vec3(0.86, 0.80, 0.82), 0.3); }   // 倒影：淡、靠水面那头最清楚
  if (a < 0.003) discard; gl_FragColor = vec4(c.rgb * a, a); }`;

// 卡片上的画：做成「模切贴纸」——一圈实心白边，底下一点软影子，浮在粉天蓝天上都清楚，也像能伸手拿下来
function sticker(src, sx, sy, sw, sh, out, ox, oy, ow, oh, edge) {
  const sil = mk(out.width, out.height), sg = sil.getContext('2d');
  sg.drawImage(src, sx, sy, sw, sh, ox, oy, ow, oh);
  sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#fff'; sg.fillRect(0, 0, sil.width, sil.height);
  const ring = mk(out.width, out.height), rg = ring.getContext('2d');
  for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; rg.drawImage(sil, Math.cos(a) * edge, Math.sin(a) * edge); }
  rg.drawImage(sil, 0, 0);
  const g = out.getContext('2d');
  g.save(); g.shadowColor = 'rgba(40,30,50,0.28)'; g.shadowBlur = edge * 1.6; g.shadowOffsetY = edge * 0.6; g.drawImage(ring, 0, 0); g.restore();
  g.drawImage(src, sx, sy, sw, sh, ox, oy, ow, oh);
}
function readingCard(r) {
  const W = 640, H = Math.round(W / r.aspect), c = mk(W, H), g = c.getContext('2d');
  const b0 = (() => { for (const p of r.strokes) drawStroke(g, { t: 'ink', c: '#000', w: 0.004, p }, W, H); const b = bboxOf(c); g.clearRect(0, 0, W, H); return b; })() || { u0: 0, v0: 0, u1: 1, v1: 1 };
  // 线宽按画的大小定，不按整张照片：小画大画在卡片上一样粗
  const lw = 0.022 * Math.max(b0.u1 - b0.u0, (b0.v1 - b0.v0) / r.aspect);
  for (const p of r.strokes) drawStroke(g, { t: 'ink', c: '#26303C', w: lw, p }, W, H);
  const b = bboxOf(c) || b0;
  const sw = (b.u1 - b.u0) * W, sh = (b.v1 - b.v0) * H, pad = 30, CW = 512, scale = (CW - 2 * pad) / Math.max(sw, sh * 0.9);
  const dw = sw * scale, dh = sh * scale, label = 60, out = mk(CW, dh + 2 * pad + label);
  sticker(c, b.u0 * W, b.v0 * H, sw, sh, out, (CW - dw) / 2, pad, dw, dh, 11);
  const og = out.getContext('2d'); og.textAlign = 'center'; og.font = '600 36px Fraunces, Georgia, serif'; og.lineJoin = 'round';
  og.lineWidth = 9; og.strokeStyle = '#fff'; og.strokeText(r.word, CW / 2, dh + 2 * pad + 30); og.fillStyle = '#26303C'; og.fillText(r.word, CW / 2, dh + 2 * pad + 30);
  return out;
}

export async function enterSky({ photo, board, line, sub, storeHref, count = () => {}, at = null }) {
  const glc = mk(FW, FH);
  const gl = glc.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const el = overlay(storeHref), cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const bar = el.querySelector('.inside-bar'), shareBtn = bar.querySelector('[data-act=share]'), hint = el.querySelector('.inside-hint');
  el.hidden = false; bar.hidden = true; hint.hidden = true;
  const prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
  g.fillStyle = '#F6F3EC'; g.fillRect(0, 0, FW, FH);
  g.fillStyle = '#5D6771'; g.font = '28px -apple-system, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Opening the sky…', FW / 2, FH / 2);
  let pano, readings;
  try {
    pano = new Image(); pano.src = PANO_SMALL;
    [readings] = await Promise.all([fetch('sky/readings.json').then(r => r.json()), pano.decode(), document.fonts.load('600 34px Fraunces').catch(() => {})]);
  } catch (_) { el.hidden = true; document.documentElement.style.overflow = prevOverflow; return null; }

  // ---------- 你的画：先出整张（定位用），逐笔重画时往卡片上一帧帧补 ----------
  const A = photo.naturalWidth / photo.naturalHeight, AW = 1024, AH = Math.round(AW / A);
  const fullArt = mk(AW, AH); board.composeInto(fullArt.getContext('2d'), 0, 0, AW, AH, { photo: false });
  const bb = bboxOf(fullArt) || { u0: 0.3, v0: 0.3, u1: 0.7, v1: 0.7 };
  const sx = bb.u0 * AW, sy = bb.v0 * AH, sw = (bb.u1 - bb.u0) * AW, sh = (bb.v1 - bb.v0) * AH;
  const pad = 36, mineW = 768, kk = (mineW - 2 * pad) / Math.max(sw, sh * 0.9), mine = mk(mineW, sh * kk + 2 * pad);
  const mineDraw = (src) => { const mg = mine.getContext('2d'); mg.clearRect(0, 0, mine.width, mine.height); sticker(src, sx, sy, sw, sh, mine, (mineW - sw * kk) / 2, pad, sw * kk, sh * kk, 14); };
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
  const mineAspect = mine.width / mine.height, mineWidth = Math.min(2.3, 2.0 * mineAspect);
  cards.push({ canvas: mine, x: 0, y: EYE + 0.1, z: -4.2, w: mineWidth, h: mineWidth / mineAspect, ph: 0, mine: true });
  // 18 幅均匀绕一圈（正前方左右各留 34° 给你的画），一高一低、一近一远交替，挨着的两幅不会叠在一起
  const pick = readings.slice(0, 18), N = pick.length, DIST = [6.5, 9.5, 7.5, 11];
  pick.forEach((rd, i) => {
    const a = 0.6 + (i + 0.5) / N * (Math.PI * 2 - 1.2), d = DIST[i % 4] + r() * 0.8, c = readingCard(rd), asp = c.width / c.height;
    const w = (1.9 + r() * 0.4) * (0.8 + d / 14), h = w / asp, y = i % 2 ? 3.3 + r() * 0.8 : 1.4 + r() * 0.4;
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
  const panoTex = texOf(pano, true);   // 1024×512、4096×2048 都是 2 的幂，左右接缝处能平滑相接
  const big = new Image(); big.src = PANO;
  big.decode().then(() => { if (closed) return; gl.bindTexture(gl.TEXTURE_2D, panoTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, big); }).catch(() => {});
  drawOn(at != null ? at : 0);
  for (const c of cards) c.tex = texOf(c.canvas, false);
  const cardBuf = gl.createBuffer(), verts = new Float32Array(30);
  const proj = perspective(FOVY, FW / FH, 0.05, 200), tanY = Math.tan(FOVY / 2), tanX = tanY * FW / FH;

  // ---------- 镜头 ----------
  const cam = { x: 0, z: 0, yaw: 0, pitch: 0.04, user: false, vy: 0, vp: 0 };
  const T1 = T0 + drawDur + 0.7, TURN = 7.2, TEND = T1 + TURN + 1.2;
  function render(t) {
    if (!cam.user && t <= TEND) { cam.yaw = Math.PI * 2 * ease((t - T1) / TURN); cam.pitch = 0.04 + 0.12 * Math.sin(Math.PI * clamp((t - T1) / TURN, 0, 1)); }
    else if (!cam.user) cam.yaw += 0.0022;
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
    for (const refl of [1, 0]) for (const { c } of order) {
      const pop = c.mine ? 1 : smooth(0, 0.5, t - 0.2), y = c.y + Math.sin(t * 0.55 + c.ph) * 0.06, hw = c.w / 2, hh = c.h / 2, s = refl ? -1 : 1;
      const x0 = c.x - rx * hw, z0 = c.z - rz * hw, x1 = c.x + rx * hw, z1 = c.z + rz * hw, yt = s * (y + hh), yb = s * (y - hh);
      verts.set([x0, yt, z0, 0, 0, x1, yt, z1, 1, 0, x0, yb, z0, 0, 1, x1, yt, z1, 1, 0, x1, yb, z1, 1, 1, x0, yb, z0, 0, 1]);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(cardP.loc.aPos, 3, gl.FLOAT, false, 20, 0); gl.vertexAttribPointer(cardP.loc.aUV, 2, gl.FLOAT, false, 20, 12);
      gl.bindTexture(gl.TEXTURE_2D, c.tex); gl.uniform1f(cardP.loc.uA, pop); gl.uniform1f(cardP.loc.uRefl, refl);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disableVertexAttribArray(cardP.loc.aPos); gl.disableVertexAttribArray(cardP.loc.aUV);

    // 合到 2D 画布（录像录的是它）：从白里出来；结尾的字
    g.drawImage(glc, 0, 0);
    const white = 1 - smooth(0, 0.8, t);
    if (white > 0) { g.fillStyle = `rgba(250,249,245,${white})`; g.fillRect(0, 0, FW, FH); }
    const ta = smooth(TEND - 2.6, TEND - 1.8, t) * (1 - smooth(TEND + 0.8, TEND + 1.6, t));
    if (ta > 0) {
      g.globalAlpha = ta; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.shadowColor = 'rgba(255,255,255,0.8)'; g.shadowBlur = 14;
      let fs = 60; g.font = `600 ${fs}px Fraunces, Georgia, serif`;
      while (g.measureText(line).width > FW - 90 && fs > 32) { fs -= 4; g.font = `600 ${fs}px Fraunces, Georgia, serif`; }
      g.fillStyle = '#28343E'; g.fillText(line, FW / 2, FH * 0.11);
      g.font = '27px -apple-system, system-ui, sans-serif'; g.fillStyle = '#3C4652'; g.fillText(sub, FW / 2, FH * 0.11 + 50);
      g.font = '600 46px Fraunces, Georgia, serif'; g.fillStyle = '#7A4A0F'; g.fillText('Cloudia', FW / 2, FH * 0.84);
      g.font = '27px -apple-system, system-ui, sans-serif'; g.fillStyle = '#3C4652'; g.fillText('In the app, it lights up.', FW / 2, FH * 0.84 + 46);
      g.shadowBlur = 0; g.globalAlpha = 1;
    }
  }

  // ---------- 手势：拖动转头；两指 / 滚轮往前后走（在 6 米以内）；双击回正 ----------
  const pts = new Map(); let pinch = 0;
  const walk = d => { cam.x += Math.sin(cam.yaw) * d; cam.z -= Math.cos(cam.yaw) * d; const L = Math.hypot(cam.x, cam.z); if (L > 6) { cam.x *= 6 / L; cam.z *= 6 / L; } };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); cam.user = true; hint.hidden = true; };
  cv.onpointermove = e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
    if (pts.size === 1) { const k = 2.2 / cv.getBoundingClientRect().width; cam.yaw -= dx * k; cam.pitch = clamp(cam.pitch + dy * k, -0.9, 1.2); cam.vy = -dx * k * 0.3; cam.vp = dy * k * 0.3; }
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
    bar.hidden = true; hint.hidden = true; file = null; lastF = -1; doneN = 0; for (const c of [ink, fill]) c.getContext('2d').clearRect(0, 0, AW, AH);
    Object.assign(cam, { x: 0, z: 0, yaw: 0, pitch: 0.04, user: false, vy: 0, vp: 0 });
    if (mime) {
      try {
        const chunks = [], mineTake = ++take;
        rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
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
  return { close, duration: TEND, cards: cards.length, cam, seek(t) { at = t; frame(performance.now()); }, look(yaw, pitch, x = 0, z = 0) { at = TEND + 2; Object.assign(cam, { user: true, yaw, pitch, x, z, vy: 0, vp: 0 }); frame(performance.now()); } };
}
