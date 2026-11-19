// 「走进云里」的画变云（11-19）：和 app 里「捏一朵」同一套——云是一把 3D 球，用 smooth-min 融成一团，
// 沿视线在这个场里走、走到表面就上色。场、絮（billow）、法线、阴影、光、边都照 CloudSketch/Puff/Puff.metal 的
// marchImpl 搬过来（常数没改），颜色是 PuffLight.demo（sRGB 解成线性，最后过同一道 filmic）。
// 不一样的地方：网页上的云是一直正对着人的卡片，所以每朵只在开场前**画一次**（正面、正交），存成一张图贴上去——
// 跑起来不多花一点力气。画的时候按 64 像素一块分开画，每块只带离它近的那几颗（和 app 的 `gather` 一个道理：
// smooth-min 两项差出 2k 以上就严格取小的，远的球不改画面）。
import { compile } from './world.js';

const KEEP = 48;   // 一块最多带几颗（和 app 的 kKeep 一样）
const VS = `attribute vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }`;
const FS = `precision highp float;
uniform vec4 uS[${KEEP}]; uniform float uK[${KEEP}]; uniform int uN;
uniform vec4 uBox; uniform vec2 uRes; uniform float uZ; uniform vec2 uYB;
uniform vec3 uSun, uCloud, uShade, uCrevice, uRim, uSkyAmb, uGroundAmb;
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise3(vec3 x){ vec3 p = floor(x), w = fract(x), u = w * w * (3.0 - 2.0 * w);
  return mix(mix(mix(hash3(p), hash3(p + vec3(1,0,0)), u.x), mix(hash3(p + vec3(0,1,0)), hash3(p + vec3(1,1,0)), u.x), u.y),
             mix(mix(hash3(p + vec3(0,0,1)), hash3(p + vec3(1,0,1)), u.x), mix(hash3(p + vec3(0,1,1)), hash3(p + vec3(1,1,1)), u.x), u.y), u.z); }
float billow(vec3 p){ float f = noise3(p) * 0.55 + noise3(p * 2.2) * 0.30 + noise3(p * 4.4) * 0.15; return pow(f, 1.35); }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float macro(vec3 p){ float d = 100.0;
  for (int i = 0; i < ${KEEP}; i++) { if (i >= uN) break; vec4 g = uS[i]; float di = length(p - g.xyz) - g.w; d = i == 0 ? di : smin(di, d, uK[i]); }
  return d; }
// 11-19 他要「更像真积云、表面碎一点」：app 的絮只有一层、0.09 深；这里叠两层（大的一团团、小的一粒粒），深到 0.26——
// 表面是花椰菜那样的疙瘩，不是一张光滑的皮
// 第一版两层都压进法线，云像一张揉皱的纸。现在分开：大的那层（lobe）是形状——一团团圆鼓包，光照、阴影都按它；
// 细的那层只占法线的一小份，主要在边上把轮廓咬散
float lobe(vec3 p){ float d = macro(p); if (d < 0.6) d -= (billow(p * 1.15) - 0.36) * 0.34 * smoothstep(0.6, 0.0, d); return d; }
float field(vec3 p){ float d = lobe(p); if (d < 0.2) d -= (billow(p * 4.6 + 7.0) - 0.4) * 0.05 * smoothstep(0.2, 0.0, d); return d; }
vec3 filmic(vec3 c){ const float A = 0.88, B = 0.6, C = 0.1, D = 0.2, E = 0.01, F = 0.3;
  vec3 t = ((c * (A * c + C * B) + D * E) / (c * (A * c + B) + D * F)) - E / F;
  float w = 1.0, tw = ((w * (A * w + C * B) + D * E) / (w * (A * w + B) + D * F)) - E / F; return t / tw; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 ro = vec3(uBox.x + uv.x * uBox.z, uBox.y - uv.y * uBox.w, uZ), rd = vec3(0.0, 0.0, -1.0), p = ro;
  float t = 0.0; bool hit = false;
  for (int i = 0; i < 140; i++) { p = ro + rd * t; float d = field(p); if (d < 0.006) { hit = true; break; } t += max(d * 0.7, 0.01); if (t > 2.0 * uZ) break; }
  if (!hit) { gl_FragColor = vec4(0.0); return; }
  const float e1 = 0.012, e2 = 0.035;
  vec3 nMicro = normalize(vec3(field(p + vec3(e1,0,0)) - field(p - vec3(e1,0,0)), field(p + vec3(0,e1,0)) - field(p - vec3(0,e1,0)), field(p + vec3(0,0,e1)) - field(p - vec3(0,0,e1))));
  vec3 nMacro = normalize(vec3(lobe(p + vec3(e2,0,0)) - lobe(p - vec3(e2,0,0)), lobe(p + vec3(0,e2,0)) - lobe(p - vec3(0,e2,0)), lobe(p + vec3(0,0,e2)) - lobe(p - vec3(0,0,e2))));
  vec3 nn = normalize(mix(nMacro, nMicro, 0.22)), l = normalize(uSun), v = vec3(0.0, 0.0, 1.0);
  float ao1 = clamp(lobe(p + nMacro * 0.20) / 0.20, 0.0, 1.0), ao2 = clamp(lobe(p + nMacro * 0.45) / 0.45, 0.0, 1.0);
  float ao = smoothstep(0.12, 0.98, ao1 * 0.60 + ao2 * 0.40);
  float wrap = clamp((dot(nn, l) + 0.28) / 1.28, 0.0, 1.0), sunTerm = smoothstep(0.05, 0.95, wrap), NdotV = clamp(dot(nn, v), 0.0, 1.0);
  vec3 hemiAmb = mix(uGroundAmb, uSkyAmb, clamp(nn.y * 0.5 + 0.5, 0.0, 1.0));
  vec3 col = mix(mix(uCrevice, uShade * hemiAmb, ao), uCloud * mix(vec3(0.96, 0.97, 1.0), vec3(1.0), sunTerm), sunTerm);
  col *= mix(0.72, 1.0, ao);   // 褶子里更深（真积云的疙瘩之间是暗的）
  float hb = clamp((p.y - uYB.x) / max(uYB.y - uYB.x, 0.01), 0.0, 1.0);
  col *= mix(0.74, 1.0, smoothstep(0.0, 0.55, hb));   // 云底暗、平，顶上亮
  vec3 h = normalize(l + v);
  col += uRim * pow(max(0.0, dot(nn, h)), 14.0) * 0.22 * sunTerm;
  float fresnel = pow(1.0 - NdotV, 2.4), mie = pow(max(0.0, dot(-v, l)), 2.6);
  col += uRim * (fresnel * 0.35 + mie * fresnel * 0.65);
  // 边：比 app 再虚一点（app 里「轻」那种料的做法），再按絮把最外一圈咬成一缕缕的——贴在照片天上，硬边最显眼
  float alpha = smoothstep(0.10, 0.95, clamp(pow(NdotV, 0.3) * 1.12, 0.0, 1.0));
  // 边散开：外面一大圈按两层絮咬成一缕缕、一点点的（越靠边越散）
  float fr = billow(p * 3.3) * 0.6 + billow(p * 8.0 + 3.0) * 0.4;
  alpha *= mix(clamp(fr * 2.4 - 0.3, 0.0, 1.0), 1.0, smoothstep(0.08, 0.42, NdotV));
  gl_FragColor = vec4(pow(filmic(max(col, 0.0)), vec3(1.0 / 2.2)), alpha);
}`;

const lin = c => c.map(x => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
// PuffLight.demo（app 里白天的那一组）。太阳从 demo 相机看过去的方向：右上、朝着人
export const PUFF_LIGHT = {
  // 11-19：天是日落（太阳在右前方、偏低、金色），在 demo 那组和 app 的晚霞（hideSeekDusk）之间各取一点：
  // 受光面暖白、背光面灰蓝紫，边一圈淡金。纯白那一版在这片天里像块棉花糖
  sun: [0.45, 0.78, 0.45],   // 斜上方来的光：云底有灰蓝的影，看得出是一团（从正面打光整团是平的）
  cloud: [1.0, 0.97, 0.91], shade: [0.76, 0.78, 0.86], crevice: [0.63, 0.65, 0.75], rim: [1, 0.88, 0.70],
  skyAmb: [0.84, 0.88, 0.95], groundAmb: [0.88, 0.84, 0.82],   // 影偏灰蓝（照片里云底的颜色），不要偏紫
};

const clamp01 = x => Math.max(0, Math.min(1, x));
function rng(seed) { let s = seed % 2147483646 + 1; return () => (s = s * 16807 % 2147483647) / 2147483647; }

// 画（填好里面的遮罩）→ 一把球。在 160 格的小图上算「离边多远」，每次在还没盖住的地方挑离边最远的那一格放一颗
// （半径 = 那个距离，夹在 0.2…1.25 之间，单位和 app 一样：画的长边约 5.5），盖住它周围七成半径，直到盖满或用完。
// 细线上的球最小 0.2，线就是一根鼓鼓的云条；大片的地方是几颗大球融在一起。
export function puffsFromMask(mask, maxN, seed) {
  const W = mask.width, H = mask.height, G = 160, s = G / Math.max(W, H), gw = Math.max(1, Math.round(W * s)), gh = Math.max(1, Math.round(H * s));
  const sm = document.createElement('canvas'); sm.width = gw; sm.height = gh;
  const sg = sm.getContext('2d', { willReadFrequently: true }); sg.drawImage(mask, 0, 0, gw, gh);
  const a = sg.getImageData(0, 0, gw, gh).data, N = gw * gh, inside = new Uint8Array(N), dist = new Float32Array(N);
  let x0 = gw, x1 = -1, y0 = gh, y1 = -1;
  for (let i = 0; i < N; i++) if (a[i * 4 + 3] > 90) { inside[i] = 1; const x = i % gw, y = (i / gw) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  // 离边多远（两遍倒角距离，1 / 1.414）
  for (let i = 0; i < N; i++) dist[i] = inside[i] ? 1e6 : 0;
  const D1 = 1, D2 = 1.4142;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; if (!dist[i]) continue;
    let d = dist[i]; if (x > 0) d = Math.min(d, dist[i - 1] + D1); else d = Math.min(d, D1); if (y > 0) d = Math.min(d, dist[i - gw] + D1); else d = Math.min(d, D1);
    if (x > 0 && y > 0) d = Math.min(d, dist[i - gw - 1] + D2); if (x < gw - 1 && y > 0) d = Math.min(d, dist[i - gw + 1] + D2); dist[i] = d; }
  for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) { const i = y * gw + x; if (!dist[i]) continue;
    let d = dist[i]; if (x < gw - 1) d = Math.min(d, dist[i + 1] + D1); else d = Math.min(d, D1); if (y < gh - 1) d = Math.min(d, dist[i + gw] + D1); else d = Math.min(d, D1);
    if (x < gw - 1 && y < gh - 1) d = Math.min(d, dist[i + gw + 1] + D2); if (x > 0 && y < gh - 1) d = Math.min(d, dist[i + gw - 1] + D2); dist[i] = d; }
  const U = 5.5 / Math.max(x1 - x0 + 1, y1 - y0 + 1);   // 一格多少单位
  const cx = gw / 2, cy = gh / 2, covered = new Uint8Array(N), r = rng(seed), puffs = [];
  while (puffs.length < Math.round(maxN * 0.45)) {
    let best = -1, bd = 0;
    for (let i = 0; i < N; i++) if (inside[i] && !covered[i] && dist[i] > bd) { bd = dist[i]; best = i; }
    if (best < 0) break;
    const gx = best % gw, gy = (best / gw) | 0, rad = Math.min(1.25, Math.max(0.2, bd * U * (0.95 + r() * 0.15)));
    puffs.push({ x: (gx + 0.5 - cx) * U, y: (cy - gy - 0.5) * U, z: (r() - 0.35) * 0.6 * rad, r: rad, k: Math.min(0.44, 0.68 * rad) });
    const cr = rad / U * 0.85, cr2 = cr * cr, xa = Math.max(0, Math.floor(gx - cr)), xb = Math.min(gw - 1, Math.ceil(gx + cr)), ya = Math.max(0, Math.floor(gy - cr)), yb = Math.min(gh - 1, Math.ceil(gy + cr));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if ((x - gx) ** 2 + (y - gy) ** 2 <= cr2) covered[y * gw + x] = 1;
  }
  // 轮廓上一圈小云泡：积云的边是一个个鼓包，不是一张光滑的皮。顶上的大、往外鼓得多（花椰菜顶），底下的小、
  // 收在里面（云底平）。离边 0.1…0.25 的格子里挑，彼此隔开一点
  const edge = [];
  for (let i = 0; i < N; i++) { const d = dist[i] * U; if (inside[i] && d > 0.08 && d < 0.26) edge.push(i); }
  for (let i = edge.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [edge[i], edge[j]] = [edge[j], edge[i]]; }
  const bumps = [], maxB = Math.round(maxN * 0.62);
  for (const i of edge) {
    if (bumps.length >= maxB) break;
    const gx = i % gw, gy = (i / gw) | 0;
    // 朝外的方向：离边的距离往哪边变小
    const at = (x, y) => dist[Math.min(gh - 1, Math.max(0, y)) * gw + Math.min(gw - 1, Math.max(0, x))];
    const nx = at(gx - 2, gy) - at(gx + 2, gy), ny = at(gx, gy - 2) - at(gx, gy + 2), nl = Math.hypot(nx, ny) || 1;
    const up = clamp01(0.5 + 0.5 * (ny / nl));   // 1 = 朝上的边（屏幕里 y 往下，所以 ny>0 是朝上）
    // 鼓包不能比那一处本身还粗：附近离边最远的那一格就是那里有多「厚」——兔耳朵、尾巴尖上的鼓包跟着变小，形状才保得住
    let thick = 0; for (let y = gy - 6; y <= gy + 6; y += 2) for (let x = gx - 6; x <= gx + 6; x += 2) thick = Math.max(thick, at(x, y));
    const rr = Math.min((0.16 + 0.3 * up) * (0.6 + r() * 0.9), Math.max(0.13, thick * U * 0.75));   // 大小差得多一点：大鼓包旁边挤着小的
    const x = (gx + 0.5 - cx) * U, y = (cy - gy - 0.5) * U;
    if (bumps.some(b => Math.hypot(b.x - x, b.y - y) < (b.r + rr) * 0.62)) continue;
    const sink = (0.55 - 0.45 * up) * rr;   // 底下的收进去
    bumps.push({ x: x - nx / nl * sink, y: y + ny / nl * sink, z: (r() - 0.3) * 0.5 * rr, r: rr, k: Math.min(0.44, 0.68 * rr) });
  }
  puffs.push(...bumps);
  // 正面一层圆顶：在身子里面挑点，放一颗朝着人鼓出来的云泡（球心在身子正面那层皮下面一点）——
  // 从正面看是一个个圆鼓包，真积云的花椰菜面。只在够厚的地方放（细线上不放，形状不糊）
  const cores = puffs.slice(0, puffs.length - bumps.length), domes = [], maxD = Math.round(maxN * 0.3);
  const frontZ = (x, y) => { let z = -9; for (const q of cores) { const dd = q.r * q.r - (x - q.x) ** 2 - (y - q.y) ** 2; if (dd > 0) z = Math.max(z, q.z + Math.sqrt(dd)); } return z; };
  const inner = [];
  for (let i = 0; i < N; i++) if (inside[i] && dist[i] * U > 0.35) inner.push(i);
  for (let i = inner.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [inner[i], inner[j]] = [inner[j], inner[i]]; }
  for (const i of inner) {
    if (domes.length >= maxD) break;
    const gx = i % gw, gy = (i / gw) | 0, x = (gx + 0.5 - cx) * U, y = (cy - gy - 0.5) * U;
    const rr = Math.min(dist[i] * U * 0.8, 0.28 + r() * 0.42);
    if (domes.some(b => Math.hypot(b.x - x, b.y - y) < (b.r + rr) * 0.75)) continue;
    const fz = frontZ(x, y); if (fz < -8) continue;
    domes.push({ x, y, z: fz - rr * 0.55, r: rr, k: Math.min(0.3, 0.5 * rr) });
  }
  puffs.push(...domes);
  // 遮罩整张在这个坐标里的范围（贴图就画这么大，和原来的卡片一样大小比例）
  return { puffs, box: { x0: -cx * U, yTop: cy * U, w: gw * U, h: gh * U } };
}

// 返回 bake(mask, maxN, seed) → 一张贴图（不预乘的 RGBA，第 0 行是顶上，和从画布传上去的一样）；显卡不够就返回 null
export function makePuffBaker(gl) {
  if (gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) < 2 * KEEP + 16) return null;
  let P;
  try { P = compile(gl, VS, FS); } catch (e) { console.warn('puff shader', e); return null; }
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const L = Object.fromEntries(Object.entries(PUFF_LIGHT).map(([k, v]) => [k, k === 'sun' ? v : lin(v)]));
  const S = new Float32Array(KEEP * 4), K = new Float32Array(KEEP);
  return function bake(mask, maxN, seed) {
    const got = puffsFromMask(mask, maxN, seed); if (!got) return null;
    const { puffs, box } = got, W = mask.width, H = mask.height, Z = 3;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, W, H); gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(P.p);
    gl.uniform4f(P.loc.uBox, box.x0, box.yTop, box.w, box.h); gl.uniform2f(P.loc.uRes, W, H); gl.uniform1f(P.loc.uZ, Z);
    gl.uniform2f(P.loc.uYB, Math.min(...puffs.map(q => q.y - q.r)), Math.max(...puffs.map(q => q.y + q.r)));
    for (const k of ['sun', 'cloud', 'shade', 'crevice', 'rim', 'skyAmb', 'groundAmb']) gl.uniform3fv(P.loc['u' + k[0].toUpperCase() + k.slice(1)], L[k]);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(P.loc.aP); gl.vertexAttribPointer(P.loc.aP, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.SCISSOR_TEST);
    const T = 64, ux = box.w / W, uy = box.h / H;
    const tile = (px, py, tw, th) => {
      // 这一块在场里的范围（py 从下往上数，和 gl_FragCoord 一样）
      const wx0 = box.x0 + px * ux, wx1 = box.x0 + (px + tw) * ux, wy1 = box.yTop - py * uy, wy0 = box.yTop - (py + th) * uy;
      const near = [];
      puffs.forEach((q, i) => {
        const pad = q.r + 2 * q.k + 0.2, dx = Math.max(wx0 - q.x, 0, q.x - wx1), dy = Math.max(wy0 - q.y, 0, q.y - wy1), d = Math.hypot(dx, dy);
        if (d < pad) near.push([i, d - q.r]);
      });
      if (!near.length) return;
      if (near.length > KEEP && tw > 8) { const hw = tw >> 1, hh = th >> 1; tile(px, py, hw, hh); tile(px + hw, py, tw - hw, hh); tile(px, py + hh, hw, th - hh); tile(px + hw, py + hh, tw - hw, th - hh); return; }
      const use = near.length > KEEP ? near.sort((a, b) => a[1] - b[1]).slice(0, KEEP).sort((a, b) => a[0] - b[0]) : near;
      S.fill(0); K.fill(0.1);
      use.forEach(([i], j) => { const q = puffs[i]; S[j * 4] = q.x; S[j * 4 + 1] = q.y; S[j * 4 + 2] = q.z; S[j * 4 + 3] = q.r; K[j] = q.k; });
      gl.uniform4fv(P.loc['uS[0]'], S); gl.uniform1fv(P.loc['uK[0]'], K); gl.uniform1i(P.loc.uN, use.length);
      gl.scissor(px, py, tw, th); gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    for (let py = 0; py < H; py += T) for (let px = 0; px < W; px += T) tile(px, py, Math.min(T, W - px), Math.min(T, H - py));
    gl.disable(gl.SCISSOR_TEST); gl.disableVertexAttribArray(P.loc.aP);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
    return { tex, n: puffs.length };
  };
}
