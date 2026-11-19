// 「走进云里」三维版（11-18 第二版，第一版平面推近被嫌不像 3D）：
// 照片里的云变成几万个软边粒子堆成的立体云——每个粒子取照片上那一点的颜色，云越往里越厚（离云边越远越鼓），
// 所以正对着看就是原来那张照片，一转就看得出厚度和侧面（背面稍暗）。你的画是一张有厚度的薄片，贴在云的正面。
// 四周是天、远处几团云、脚下一片云海。手指拖动转、两指或滚轮缩放。
// 开场：先是照片原样，照片淡掉、镜头绕着云转一圈——这一段（约 9 秒，9:16）同时录成小视频。只动不亮。
// 没有 WebGL 的浏览器退回第一版（inside.js）。
const FW = 720, FH = 1280, FOVY = 50 * Math.PI / 180, D0 = 4.0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t = clamp(t, 0, 1), t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function rng(seed) { let s = seed % 2147483646 + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }

// ---------- 小矩阵（列主序） ----------
function perspective(fovy, aspect, n, f) {
  const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
  return new Float32Array([t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function lookAt(eye, at) {
  const f = norm(sub(at, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  return { m: new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, eye), -dot(u, eye), dot(f, eye), 1]), f, r, u };
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; }
  return o;
}

// ---------- 读照片：哪里是蓝天、哪里是云；云里每一格离云边多远（越远越厚） ----------
function analyse(photo, gw) {
  const A = photo.naturalWidth / photo.naturalHeight, gh = Math.max(8, Math.round(gw / A));
  const c = mk(gw, gh), g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high'; g.drawImage(photo, 0, 0, gw, gh);
  const d = g.getImageData(0, 0, gw, gh).data, n = gw * gh, cloud = new Float32Array(n);
  const acc = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];   // 天的颜色：上 40%、中间、下 40%
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    const sky = smooth(12, 40, b - (r + gg) / 2) * smooth(45, 95, b);   // 偏蓝、够亮的是天；灰云 r≈g≈b 不算
    cloud[i] = 1 - sky;
    if (sky > 0.6) { const v = Math.floor(i / gw) / gh, a = acc[v < 0.4 ? 0 : v > 0.6 ? 2 : 1]; a[0] += r; a[1] += gg; a[2] += b; a[3]++; }
  }
  // 没什么蓝天（老画、阴天）：改成「布景」——最亮的那些云鼓出来，其余整张图当背后一块平板
  let cov = 0, edgeN = 0, edgeC = 0; for (let i = 0; i < n; i++) if (cloud[i] > 0.5) cov++;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (x < 2 || y < 2 || x >= gw - 2 || y >= gh - 2) { edgeN++; if (cloud[y * gw + x] > 0.5) edgeC++; }
  // 几乎没有蓝天、云占六成以上、或者照片四边一半以上被云切着（满天的云）：立体出来都是一块砖，改成布景
  const skyN = acc.reduce((s, a) => s + a[3], 0), diorama = skyN < n * 0.12 || cov > n * 0.6 || edgeC > edgeN * 0.45;
  if (diorama) {
    const lum = new Float32Array(n);
    for (let i = 0; i < n; i++) lum[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
    const srt = Float32Array.from(lum).sort(), p55 = srt[Math.floor(n * 0.55)], p88 = srt[Math.floor(n * 0.88)];
    for (let i = 0; i < n; i++) cloud[i] = smooth(p55, Math.max(p55 + 8, p88), lum[i]);
    acc.forEach(a => a.fill(0));
    for (let i = 0; i < n; i++) { const v = Math.floor(i / gw) / gh, a = acc[v < 0.3 ? 0 : v > 0.7 ? 2 : 1]; a[0] += d[i * 4]; a[1] += d[i * 4 + 1]; a[2] += d[i * 4 + 2]; a[3]++; }
  }
  const all = acc.reduce((s, a) => s.map((v, k) => v + a[k]), [0, 0, 0, 0]);
  const avg = all[3] > n * 0.03 ? all.slice(0, 3).map(v => v / all[3]) : [150, 172, 205];
  const pick = a => a[3] > n * 0.01 ? a.slice(0, 3).map(v => v / a[3]) : avg;
  const top = pick(acc[0]), bot = pick(acc[2]);
  // 云碰到照片边的地方：往边上越来越薄、越淡，转过去不会是一刀切的平面
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const u = (x + 0.5) / gw, v = (y + 0.5) / gh;
    cloud[y * gw + x] *= smooth(0, 0.12, u) * smooth(0, 0.12, 1 - u) * smooth(0, 0.12 * A, v) * smooth(0, 0.12 * A, 1 - v);
  }
  // 离云边的距离（两遍倒角距离）
  const dist = new Float32Array(n), INF = 1e6;
  for (let i = 0; i < n; i++) dist[i] = cloud[i] > 0.4 ? INF : 0;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x; if (!dist[i]) continue;
    let v = dist[i];
    if (x > 0) v = Math.min(v, dist[i - 1] + 1); else v = Math.min(v, 1);
    if (y > 0) v = Math.min(v, dist[i - gw] + 1); else v = Math.min(v, 1);
    if (x > 0 && y > 0) v = Math.min(v, dist[i - gw - 1] + 1.414);
    if (x < gw - 1 && y > 0) v = Math.min(v, dist[i - gw + 1] + 1.414);
    dist[i] = v;
  }
  for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) {
    const i = y * gw + x; if (!dist[i]) continue;
    let v = dist[i];
    if (x < gw - 1) v = Math.min(v, dist[i + 1] + 1); else v = Math.min(v, 1);
    if (y < gh - 1) v = Math.min(v, dist[i + gw] + 1); else v = Math.min(v, 1);
    if (x < gw - 1 && y < gh - 1) v = Math.min(v, dist[i + gw + 1] + 1.414);
    if (x > 0 && y < gh - 1) v = Math.min(v, dist[i + gw - 1] + 1.414);
    dist[i] = v;
  }
  return { A, gw, gh, data: d, cloud, dist, avg, top, bot, diorama, stats: { sky: skyN / n, cov: cov / n, edge: edgeC / edgeN } };
}

// ---------- 粒子：主角那朵（照片变的）＋ 远处几团 ＋ 脚下云海 ----------
// 每个粒子 8 个数：x y z  r g b  不透明度  直径（世界单位）
function buildParticles(S) {
  const { A, gw, gh, data, cloud, dist } = S, sp = 2 / gw, halfH = 1 / A, R = gw * 0.22, r = rng(5), th = S.diorama ? 0.6 : 1;
  const out = [], front = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, c = cloud[i]; if (c < 0.12) continue;
    const k = Math.sqrt(Math.min(dist[i], R) / R), Tf = (0.05 + 0.33 * k) * th, Tb = S.diorama ? 0.02 : 0.04 + 0.24 * k;
    front[i] = Tf * c;
    const cr = data[i * 4] / 255, cg = data[i * 4 + 1] / 255, cb = data[i * 4 + 2] / 255;
    const cnt = 1 + Math.min(3, Math.round((Tf + Tb) / 0.12));
    for (let j = 0; j < cnt; j++) {
      const f = j === 0 ? 0 : (j + r() * 0.6) / cnt;          // 0 = 正面那一层（颜色最准）
      const z = lerp(Tf * (0.88 + 0.12 * r()), -Tb, f) * c;
      const shade = j === 0 ? 1 : lerp(0.97, 0.72, f);        // 往里、往背面越暗一点：转过去看得出体积
      const px = (x + 0.5 + (r() - 0.5) * 0.7) * sp - 1, py = halfH - (y + 0.5 + (r() - 0.5) * 0.7) * sp;
      out.push(px, py, z, cr * shade, cg * shade, cb * shade, c * c * (j === 0 ? 0.95 : 0.8), sp * ((j === 0 ? 2.5 : 3.1 + r()) + (1 - c) * 1.6));   // 云边的粒子大一点、淡一点，边是软的不是一粒粒
    }
  }
  // 远处几团：绕一圈，正后方留空（别挡住开场那朵）
  const rf = rng(17);
  for (let k = 0; k < 10; k++) {
    let th = (k / 10) * Math.PI * 2 + rf() * 0.4; if (Math.abs(((th + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.45) th += 0.6;
    const rad = 11 + rf() * 6, cx = Math.sin(th) * rad, cz = Math.cos(th) * rad, cy = -1.2 + rf() * 3.6, sx = 2 + rf() * 2, sy = 0.8 + rf() * 0.7;
    for (let j = 0; j < 170; j++) {
      const u = rf() * 2 - 1, a = rf() * Math.PI * 2, rr = Math.cbrt(rf());
      const ox = Math.cos(a) * Math.sqrt(1 - u * u) * rr * sx, oy = Math.abs(u) * rr * sy * (u < 0 ? -0.45 : 1), oz = Math.sin(a) * Math.sqrt(1 - u * u) * rr * sx * 0.8;
      const sh = lerp(0.8, 1, smooth(-0.5, 0.6, oy / sy));
      out.push(cx + ox, cy + oy, cz + oz, sh, sh, sh * 1.01, 0.5, 0.9 + rf() * 0.9);
    }
  }
  // 云海
  for (let j = 0; j < 1400; j++) {
    const a = rf() * Math.PI * 2, rad = 3 + Math.sqrt(rf()) * 30, sh = 0.86 + rf() * 0.12;
    out.push(Math.sin(a) * rad, -4.2 + (rf() - 0.5) * 0.6, Math.cos(a) * rad, sh, sh, sh * 1.02, 0.55, 2.2 + rf() * 1.6);
  }
  return { arr: new Float32Array(out), n: out.length / 8, front };
}

// ---------- WebGL ----------
function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); loc[u.name] = gl.getUniformLocation(p, u.name); }
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); loc[a.name] = gl.getAttribLocation(p, a.name); }
  return { p, loc };
}
const SKY_VS = `attribute vec2 aP; varying vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
const SKY_FS = `precision mediump float; varying vec2 vP; uniform vec3 uR, uU, uF, uZen, uHor, uLow; uniform vec2 uTan;
void main(){ vec3 d = normalize(uF + uR * vP.x * uTan.x + uU * vP.y * uTan.y);
  vec3 c = d.y > 0.0 ? mix(uHor, uZen, smoothstep(0.0, 0.75, d.y)) : mix(uHor, uLow, smoothstep(0.0, 0.25, -d.y));
  gl_FragColor = vec4(c, 1.0); }`;
const PT_VS = `attribute vec3 aPos; attribute vec3 aCol; attribute float aA; attribute float aS;
uniform mat4 uVP; uniform float uScale, uMax; varying vec3 vCol; varying float vA;
void main(){ vec4 p = uVP * vec4(aPos, 1.0); gl_Position = p; float w = max(p.w, 0.05);
  gl_PointSize = min(aS * uScale / w, uMax); vCol = aCol; vA = aA * smoothstep(0.12, 0.55, p.w); }`;
const PT_FS = `precision mediump float; varying vec3 vCol; varying float vA;
void main(){ vec2 q = gl_PointCoord - 0.5; float a = vA * smoothstep(0.5, 0.12, length(q)); if (a < 0.004) discard; gl_FragColor = vec4(vCol * a, a); }`;
const CARD_VS = `attribute vec3 aPos; attribute vec2 aUV; uniform mat4 uVP; uniform vec3 uOff; varying vec2 vUV;
void main(){ vUV = aUV; gl_Position = uVP * vec4(aPos + uOff, 1.0); }`;
const CARD_FS = `precision mediump float; varying vec2 vUV; uniform sampler2D uT; uniform float uShade;
void main(){ vec4 c = texture2D(uT, vUV); if (c.a < 0.06) discard; gl_FragColor = vec4(c.rgb * uShade * c.a, c.a); }`;

// 一张（几张叠起来的）图，四边各一条渐变擦掉（Safari 的画布不认 filter，所以不用模糊）
function feather(srcs, w, h, edge) {
  const c = mk(w, h), cg = c.getContext('2d');
  for (const s of [].concat(srcs)) cg.drawImage(s, 0, 0, w, h);
  const m = mk(w, h), mg = m.getContext('2d'), e = Math.round(Math.min(w, h) * edge);
  mg.fillStyle = '#000'; mg.fillRect(0, 0, w, h); mg.globalCompositeOperation = 'destination-out';
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, e, 0, 0, 0, e, h], [w, 0, w - e, 0, w - e, 0, e, h], [0, 0, 0, e, 0, 0, w, e], [0, h, 0, h - e, 0, h - e, w, e]]) {
    const gr = mg.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); mg.fillStyle = gr; mg.fillRect(rx, ry, rw, rh);
  }
  cg.globalCompositeOperation = 'destination-in'; cg.drawImage(m, 0, 0);
  return c;
}

function bboxOf(art) {
  const s = 200 / Math.max(art.width, art.height), w = Math.max(1, Math.round(art.width * s)), h = Math.max(1, Math.round(art.height * s));
  const c = mk(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(art, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const p = 3 / w;
  return { u0: Math.max(0, x0 / w - p), v0: Math.max(0, y0 / h - p), u1: Math.min(1, (x1 + 1) / w + p), v1: Math.min(1, (y1 + 1) / h + p) };
}

function overlay(storeHref) {
  let el = document.getElementById('world');
  if (el) return el;
  el = document.createElement('div'); el.id = 'world'; el.className = 'inside'; el.hidden = true;
  el.innerHTML = `<canvas width="${FW}" height="${FH}" role="img" aria-label="Your drawing inside the cloud, in 3D"></canvas>
    <p class="inside-hint" hidden>Drag to turn · pinch to zoom</p>
    <button class="inside-x" aria-label="Close">×</button>
    <div class="inside-bar" hidden>
      <button class="primary" data-act="share">Share video</button>
      <button data-act="replay">Replay</button>
      <a class="inside-app" href="${storeHref}">Get Cloudia</a>
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

/** 打开三维的云。没有 WebGL 时返回 null（调用方退回平面版）。参数同 inside.js。 */
export async function enterWorld({ photo, board, line, sub, storeHref, count = () => {}, at = null }) {
  const glc = mk(FW, FH);
  const gl = glc.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return null;
  const el = overlay(storeHref), cv = el.querySelector('canvas'), g = cv.getContext('2d');
  const bar = el.querySelector('.inside-bar'), shareBtn = bar.querySelector('[data-act=share]'), hint = el.querySelector('.inside-hint');
  el.hidden = false; bar.hidden = true; hint.hidden = true;
  const prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
  g.fillStyle = '#F6F3EC'; g.fillRect(0, 0, FW, FH);
  g.fillStyle = '#5D6771'; g.font = '28px -apple-system, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Building your cloud…', FW / 2, FH / 2);
  await new Promise(r => { requestAnimationFrame(() => setTimeout(r, 30)); setTimeout(r, 120); });
  try { await document.fonts.load('600 58px Fraunces'); } catch (_) {}

  // ---------- 准备 ----------
  const S = analyse(photo, 150), P = buildParticles(S), A = S.A, halfH = 1 / A;
  const art = mk(Math.min(2048, 1600), Math.min(2048, 1600) / A);
  board.composeInto(art.getContext('2d'), 0, 0, art.width, art.height, { photo: false });
  const bb = bboxOf(art);
  // 画贴在云正面：取画那块地方云最鼓的厚度；再按远近缩一点，正对着看和照片上的位置一模一样
  let zc = 0.08;
  if (bb) {
    let m = 0; for (let y = Math.floor(bb.v0 * S.gh); y < Math.ceil(bb.v1 * S.gh); y++) for (let x = Math.floor(bb.u0 * S.gw); x < Math.ceil(bb.u1 * S.gw); x++) m = Math.max(m, P.front[y * S.gw + x] || 0);
    zc = m + 0.03;   // 比这块最鼓的云再往前一点，正面看不会被云盖住
  }
  const kz = (D0 - zc) / D0;
  const card = [];
  if (bb) {
    const x0 = (bb.u0 * 2 - 1) * kz, x1 = (bb.u1 * 2 - 1) * kz, y0 = (halfH - bb.v0 * 2 * halfH) * kz, y1 = (halfH - bb.v1 * 2 * halfH) * kz;
    card.push(x0, y0, 0, bb.u0, bb.v0, x1, y0, 0, bb.u1, bb.v0, x0, y1, 0, bb.u0, bb.v1, x1, y0, 0, bb.u1, bb.v0, x1, y1, 0, bb.u1, bb.v1, x0, y1, 0, bb.u0, bb.v1);
  }

  const proj = perspective(FOVY, FW / FH, 0.05, 80), tanY = Math.tan(FOVY / 2), tanX = tanY * FW / FH, scale = FH / (2 * tanY);
  // 开场盖在上面的原照片（带你的画）：四边羽化，淡掉时和三维的天接得上
  const soft = feather([photo, art], Math.round(FW / (tanX * D0)), Math.round(FW / (tanX * D0) / A), 0.14);   // 正对着、距离 D0 时照片的宽
  const skyP = compile(gl, SKY_VS, SKY_FS), ptP = compile(gl, PT_VS, PT_FS), cardP = compile(gl, CARD_VS, CARD_FS);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const ptBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf); gl.bufferData(gl.ARRAY_BUFFER, P.arr.byteLength, gl.DYNAMIC_DRAW);
  const cardBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cardBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(card), gl.STATIC_DRAW);
  const texOf = src => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  const tex = texOf(art);
  // 布景模式：整张图当背板，放在云后面一点，同样按远近放大，正对着看和原图对齐
  let backTex = null, backBuf = null; const zb = -0.12;
  if (S.diorama) {
    backTex = texOf(feather(photo, 1024, Math.round(1024 / A), 0.16));   // 四边羽化：像一片云墙，不像一块板
    const k = (D0 - zb) / D0, x0 = -k, x1 = k, y0 = halfH * k, y1 = -halfH * k;
    backBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, backBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, y0, 0, 0, 0, x1, y0, 0, 1, 0, x0, y1, 0, 0, 1, x1, y0, 0, 1, 0, x1, y1, 0, 1, 1, x0, y1, 0, 0, 1]), gl.STATIC_DRAW);
  }
  const maxPt = Math.min(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64, 96);
  const zen = S.top.map(v => v / 255 * 0.92), hor = S.bot.map(v => lerp(v / 255, 1, 0.22)), low = [0.93, 0.94, 0.95];   // 天的颜色照着照片上下两头取

  // 粒子按远近排（远的先画）：分 96 个桶数一遍，比整排快得多
  const sorted = new Float32Array(P.arr.length), keys = new Float32Array(P.n), bins = 96, cnt = new Uint32Array(bins + 1);
  function sortFor(eye, f) {
    let lo = Infinity, hi = -Infinity; const a = P.arr;
    for (let i = 0; i < P.n; i++) { const o = i * 8, k = (a[o] - eye[0]) * f[0] + (a[o + 1] - eye[1]) * f[1] + (a[o + 2] - eye[2]) * f[2]; keys[i] = k; if (k < lo) lo = k; if (k > hi) hi = k; }
    const sc = (bins - 1) / Math.max(1e-6, hi - lo); cnt.fill(0);
    for (let i = 0; i < P.n; i++) cnt[bins - 1 - Math.floor((keys[i] - lo) * sc) + 1]++;
    for (let b = 1; b <= bins; b++) cnt[b] += cnt[b - 1];
    for (let i = 0; i < P.n; i++) { const b = bins - 1 - Math.floor((keys[i] - lo) * sc), dst = cnt[b]++ * 8, o = i * 8; for (let k = 0; k < 8; k++) sorted[dst + k] = a[o + k]; }
  }

  // ---------- 镜头 ----------
  const cam = { yaw: 0, pitch: 0, dist: D0, user: false, vy: 0, vp: 0 };
  const TI = 9.2;   // 开场（录像）多长
  function introCam(t) {
    const a = ease((t - 0.8) / 3.2), b = ease((t - 4.0) / 3.8);
    return { yaw: -0.75 * a + 1.25 * b, pitch: 0.24 * ease((t - 0.8) / 3) - 0.08 * b, dist: lerp(D0, 3.3, ease((t - 0.8) / 4)) };
  }
  function render(t) {
    if (!cam.user && t < TI + 0.01) Object.assign(cam, introCam(t));
    else if (!cam.user) cam.yaw += 0.0025;   // 开场完了没人碰：自己慢慢转
    cam.yaw += cam.vy; cam.pitch = clamp(cam.pitch + cam.vp, -0.6, 1.2); cam.vy *= 0.92; cam.vp *= 0.92;
    const cp = Math.cos(cam.pitch), eye = [Math.sin(cam.yaw) * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * cp * cam.dist];
    const L = lookAt(eye, [0, 0, 0]), VP = mul(proj, L.m);
    gl.viewport(0, 0, FW, FH); gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // 天
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.useProgram(skyP.p);
    gl.uniform3fv(skyP.loc.uR, L.r); gl.uniform3fv(skyP.loc.uU, L.u); gl.uniform3fv(skyP.loc.uF, L.f); gl.uniform2f(skyP.loc.uTan, tanX, tanY);
    gl.uniform3fv(skyP.loc.uZen, zen); gl.uniform3fv(skyP.loc.uHor, hor); gl.uniform3fv(skyP.loc.uLow, low);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(skyP.loc.aP); gl.vertexAttribPointer(skyP.loc.aP, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(skyP.loc.aP);
    // 画：一张薄片叠几层，后几层暗一点当成侧边；轻轻浮动
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (backBuf) {
      gl.useProgram(cardP.p); gl.uniformMatrix4fv(cardP.loc.uVP, false, VP);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, backTex); gl.uniform1i(cardP.loc.uT, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, backBuf);
      gl.enableVertexAttribArray(cardP.loc.aPos); gl.vertexAttribPointer(cardP.loc.aPos, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(cardP.loc.aUV); gl.vertexAttribPointer(cardP.loc.aUV, 2, gl.FLOAT, false, 20, 12);
      gl.uniform3f(cardP.loc.uOff, 0, 0, zb); gl.uniform1f(cardP.loc.uShade, 0.96); gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(cardP.loc.aPos); gl.disableVertexAttribArray(cardP.loc.aUV);
    }
    if (card.length) {
      const bob = smooth(1.5, 3, t) * 0.025 * Math.sin(t * 1.3);
      gl.useProgram(cardP.p); gl.uniformMatrix4fv(cardP.loc.uVP, false, VP);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(cardP.loc.uT, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, cardBuf);
      gl.enableVertexAttribArray(cardP.loc.aPos); gl.vertexAttribPointer(cardP.loc.aPos, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(cardP.loc.aUV); gl.vertexAttribPointer(cardP.loc.aUV, 2, gl.FLOAT, false, 20, 12);
      for (let k = 5; k >= 0; k--) { gl.uniform3f(cardP.loc.uOff, 0, bob, zc - k * 0.008); gl.uniform1f(cardP.loc.uShade, k ? 0.55 : 1); gl.drawArrays(gl.TRIANGLES, 0, 6); }
      gl.disableVertexAttribArray(cardP.loc.aPos); gl.disableVertexAttribArray(cardP.loc.aUV);
    }
    // 云（粒子）：测深度（被画挡住的不画），不写深度
    sortFor(eye, L.f);
    gl.depthMask(false); gl.useProgram(ptP.p);
    gl.uniformMatrix4fv(ptP.loc.uVP, false, VP); gl.uniform1f(ptP.loc.uScale, scale); gl.uniform1f(ptP.loc.uMax, maxPt);
    gl.bindBuffer(gl.ARRAY_BUFFER, ptBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, sorted);
    for (const [name, size, off] of [['aPos', 3, 0], ['aCol', 3, 12], ['aA', 1, 24], ['aS', 1, 28]]) { gl.enableVertexAttribArray(ptP.loc[name]); gl.vertexAttribPointer(ptP.loc[name], size, gl.FLOAT, false, 32, off); }
    gl.drawArrays(gl.POINTS, 0, P.n);
    for (const name of ['aPos', 'aCol', 'aA', 'aS']) gl.disableVertexAttribArray(ptP.loc[name]);
    gl.depthMask(true);

    // 合到 2D 画布上（这块画布被录像）：开场先盖原照片，再淡掉；字
    g.drawImage(glc, 0, 0);
    const pa = 1 - smooth(0.8, 2.2, t);
    if (pa > 0) {
      g.globalAlpha = pa; g.drawImage(soft, (FW - soft.width) / 2, (FH - soft.height) / 2); g.globalAlpha = 1;
    }
    const ta = smooth(6.4, 7.2, t) * (1 - smooth(TI + 0.6, TI + 1.4, t));
    if (ta > 0) {
      g.globalAlpha = ta; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      let fs = 60; g.font = `600 ${fs}px Fraunces, Georgia, serif`;
      while (g.measureText(line).width > FW - 90 && fs > 32) { fs -= 4; g.font = `600 ${fs}px Fraunces, Georgia, serif`; }
      g.fillStyle = '#28343E'; g.fillText(line, FW / 2, FH * 0.11);
      g.font = '27px -apple-system, system-ui, sans-serif'; g.fillStyle = '#4C5661'; g.fillText(sub, FW / 2, FH * 0.11 + 50);
      g.font = '600 46px Fraunces, Georgia, serif'; g.fillStyle = '#945D16'; g.fillText('Cloudia', FW / 2, FH * 0.82);
      g.font = '27px -apple-system, system-ui, sans-serif'; g.fillStyle = '#4C5661'; g.fillText('In the app, it lights up.', FW / 2, FH * 0.82 + 46);
      g.globalAlpha = 1;
    }
  }

  // ---------- 手势：拖动转，两指 / 滚轮缩放 ----------
  const pts = new Map(); let pinch0 = 0, dist0 = D0;
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cam.user = true; hint.hidden = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.dist; } };
  cv.onpointermove = e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) { const k = 3.2 / cv.getBoundingClientRect().width; cam.vy = -dx * k * 0.35; cam.vp = dy * k * 0.35; cam.yaw -= dx * k; cam.pitch = clamp(cam.pitch + dy * k, -0.6, 1.2); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) cam.dist = clamp(dist0 * pinch0 / d, 1.6, 9); }
  };
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  cv.onpointerup = up; cv.onpointercancel = up;
  cv.onwheel = e => { e.preventDefault(); cam.user = true; cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0015), 1.6, 9); };
  cv.ondblclick = () => { cam.user = false; start = performance.now() - (TI + 1) * 1000; Object.assign(cam, introCam(TI), { vy: 0, vp: 0 }); };

  // ---------- 播放、录像 ----------
  const mime = pickMime();
  let raf = 0, start = 0, rec = null, file = null, url = null, closed = false, take = 0;
  function play() {
    bar.hidden = true; hint.hidden = true; file = null; Object.assign(cam, { yaw: 0, pitch: 0, dist: D0, user: false, vy: 0, vp: 0 });
    if (mime) {
      try {
        const chunks = [], mine = ++take;
        rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          if (closed || mine !== take || !chunks.length) return;
          const type = mime.split(';')[0], blob = new Blob(chunks, { type });
          file = new File([blob], `cloudia-3d.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type });
          if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
          shareBtn.disabled = false; shareBtn.textContent = canShareFile() ? 'Share video' : 'Save video';
        };
        rec.start(500);
      } catch (_) { rec = null; }
    }
    shareBtn.disabled = true; shareBtn.textContent = 'Preparing video…'; shareBtn.hidden = !rec;
    start = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    if (closed) return;
    const t = at != null ? at : (now - start) / 1000;
    render(t);
    if (t >= TI && rec && rec.state === 'recording') rec.stop();
    if (t >= TI - 0.4 && bar.hidden) { bar.hidden = false; if (!cam.user) hint.hidden = false; }
    if (at == null) raf = requestAnimationFrame(frame);
  }
  const canShareFile = () => !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  shareBtn.onclick = async () => {
    if (!file) return;
    count('world-share');
    if (canShareFile()) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  };
  bar.querySelector('[data-act=replay]').onclick = () => { count('world-replay'); if (rec && rec.state === 'recording') { take++; rec.stop(); } play(); };
  const close = () => {
    closed = true; cancelAnimationFrame(raf);
    if (rec && rec.state === 'recording') rec.stop();
    if (url) URL.revokeObjectURL(url);
    el.hidden = true; document.documentElement.style.overflow = prevOverflow; removeEventListener('keydown', esc);
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();   // 关掉就把显存还回去
  };
  const esc = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', esc);
  el.querySelector('.inside-x').onclick = close;
  play();
  return { close, duration: TI, particles: P.n, mode: S.diorama ? 'diorama' : 'cloud', stats: S.stats, cam, seek(t) { at = t; frame(performance.now()); }, look(yaw, pitch, dist) { at = TI + 2; Object.assign(cam, { user: true, yaw, pitch, dist: dist || cam.dist, vy: 0, vp: 0 }); frame(performance.now()); } };
}

// 给「天空之镜」（sky.js）共用的小工具
export { perspective, lookAt, mul, compile, bboxOf, pickMime, overlay };
