// 贴纸「眼睛和小零件」（11-17）：全部用 Canvas 2D 现画，没有图片文件，也就没有许可问题，导出时不会污染画布。
// 每枚贴纸在一个 w×h 的框里画（框的单位由调用方给，通常是 CSS 像素或导出像素），黑描边、实心填色，贴在云上和老画上都看得清。
// 不放整只动物：在任何东西上贴两只眼睛，它就成了谁——这是这包贴纸的全部用意。

const INK = '#1A1B24';

function outline(c, s) { c.lineWidth = s; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; }
function ellipse(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); }
function eye(c, x, y, r, s, look = [0.18, 0.12]) {
  ellipse(c, x, y, r, r * 1.15); c.fillStyle = '#fff'; c.fill(); outline(c, s); c.stroke();
  ellipse(c, x + r * look[0], y + r * look[1], r * 0.48, r * 0.55); c.fillStyle = INK; c.fill();
  ellipse(c, x + r * (look[0] - 0.14), y + r * (look[1] - 0.2), r * 0.15, r * 0.15); c.fillStyle = '#fff'; c.fill();
}
function star(c, x, y, r) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.32 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

// 框的宽高比（w/h）和画法；name 是读屏用的英文名；pack 是托盘上的分组
export const PACKS = [
  { id: 'faces', name: 'Faces' }, { id: 'feelings', name: 'Feelings' }, { id: 'weather', name: 'Weather' }, { id: 'parts', name: 'Wings & tails' },
  { id: 'things', name: 'Little things' }, { id: 'space', name: 'Space' }, { id: 'fun', name: 'Fun' },
];
const FACES = [
  { id: 'eyes', name: 'Two eyes', ratio: 2, draw(c, w, h) { const s = h * 0.06; eye(c, w * 0.27, h * 0.5, h * 0.36, s); eye(c, w * 0.73, h * 0.5, h * 0.36, s); } },
  { id: 'eye', name: 'Big eye', ratio: 1, draw(c, w, h) { eye(c, w / 2, h / 2, h * 0.4, h * 0.05, [0.1, 0.05]); } },
  { id: 'sleepy', name: 'Sleepy eyes', ratio: 2.2, draw(c, w, h) {
    outline(c, h * 0.09);
    for (const x of [0.27, 0.73]) {
      c.beginPath(); c.arc(w * x, h * 0.35, h * 0.32, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
      for (const k of [-0.6, 0, 0.6]) { const a = Math.PI / 2 + k * 0.6; c.beginPath(); c.moveTo(w * x + Math.cos(a) * h * 0.32, h * 0.35 + Math.sin(a) * h * 0.32); c.lineTo(w * x + Math.cos(a) * h * 0.5, h * 0.35 + Math.sin(a) * h * 0.5); c.stroke(); }
    }
  } },
  { id: 'wink', name: 'Wink', ratio: 2, draw(c, w, h) {
    const s = h * 0.06; eye(c, w * 0.27, h * 0.5, h * 0.36, s);
    outline(c, h * 0.1); c.beginPath(); c.moveTo(w * 0.6, h * 0.32); c.lineTo(w * 0.84, h * 0.5); c.lineTo(w * 0.6, h * 0.68); c.stroke();
  } },
  { id: 'smile', name: 'Smile', ratio: 2, draw(c, w, h) { outline(c, h * 0.13); c.beginPath(); c.arc(w / 2, h * 0.05, w * 0.4, 0.22 * Math.PI, 0.78 * Math.PI); c.stroke(); } },
  { id: 'grin', name: 'Big grin', ratio: 1.5, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.08, h * 0.18); c.quadraticCurveTo(w * 0.5, h * 0.3, w * 0.92, h * 0.18); c.quadraticCurveTo(w * 0.85, h * 0.95, w * 0.5, h * 0.95); c.quadraticCurveTo(w * 0.15, h * 0.95, w * 0.08, h * 0.18); c.closePath();
    c.fillStyle = '#3A1218'; c.fill();
    c.save(); c.clip(); ellipse(c, w * 0.5, h * 0.98, w * 0.24, h * 0.3); c.fillStyle = '#F2788C'; c.fill();
    c.fillStyle = '#fff'; c.fillRect(w * 0.18, h * 0.1, w * 0.64, h * 0.17); c.restore();
    outline(c, h * 0.07); c.beginPath(); c.moveTo(w * 0.08, h * 0.18); c.quadraticCurveTo(w * 0.5, h * 0.3, w * 0.92, h * 0.18); c.quadraticCurveTo(w * 0.85, h * 0.95, w * 0.5, h * 0.95); c.quadraticCurveTo(w * 0.15, h * 0.95, w * 0.08, h * 0.18); c.closePath(); c.stroke();
  } },
  { id: 'oh', name: 'Oh!', ratio: 0.8, draw(c, w, h) { ellipse(c, w / 2, h / 2, w * 0.36, h * 0.4); c.fillStyle = '#3A1218'; c.fill(); outline(c, w * 0.08); c.stroke(); } },
  { id: 'tongue', name: 'Tongue out', ratio: 1.6, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.42, h * 0.3); c.lineTo(w * 0.42, h * 0.62); c.arc(w * 0.55, h * 0.62, w * 0.13, Math.PI, 0, true); c.lineTo(w * 0.68, h * 0.3); c.closePath();
    c.fillStyle = '#F2788C'; c.fill(); outline(c, h * 0.06); c.stroke();
    c.beginPath(); c.moveTo(w * 0.55, h * 0.36); c.lineTo(w * 0.55, h * 0.6); c.stroke();
    outline(c, h * 0.1); c.beginPath(); c.arc(w / 2, h * -0.25, w * 0.42, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
  } },
  { id: 'mustache', name: 'Mustache', ratio: 2.6, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.5, h * 0.35);
    c.bezierCurveTo(w * 0.38, h * 0.1, w * 0.18, h * 0.2, w * 0.14, h * 0.5); c.bezierCurveTo(w * 0.1, h * 0.75, w * 0.0, h * 0.7, w * 0.03, h * 0.45);
    c.bezierCurveTo(w * -0.02, h * 0.95, w * 0.3, h * 1.0, w * 0.5, h * 0.62);
    c.bezierCurveTo(w * 0.7, h * 1.0, w * 1.02, h * 0.95, w * 0.97, h * 0.45); c.bezierCurveTo(w * 1.0, h * 0.7, w * 0.9, h * 0.75, w * 0.86, h * 0.5);
    c.bezierCurveTo(w * 0.82, h * 0.2, w * 0.62, h * 0.1, w * 0.5, h * 0.35); c.closePath();
    c.fillStyle = INK; c.fill();
  } },
  { id: 'tophat', name: 'Top hat', ratio: 1.1, draw(c, w, h) {
    c.beginPath(); c.roundRect(w * 0.22, h * 0.04, w * 0.56, h * 0.72, w * 0.04); c.fillStyle = '#23242E'; c.fill(); outline(c, w * 0.04); c.stroke();
    c.fillStyle = '#C8473D'; c.fillRect(w * 0.22, h * 0.56, w * 0.56, h * 0.12); c.strokeRect(w * 0.22, h * 0.56, w * 0.56, h * 0.12);
    ellipse(c, w / 2, h * 0.82, w * 0.47, h * 0.1); c.fillStyle = '#23242E'; c.fill(); c.stroke();
  } },
  { id: 'partyhat', name: 'Party hat', ratio: 0.8, draw(c, w, h) {
    c.save(); c.beginPath(); c.moveTo(w * 0.5, h * 0.12); c.lineTo(w * 0.92, h * 0.94); c.lineTo(w * 0.08, h * 0.94); c.closePath();
    c.fillStyle = '#5B8DEF'; c.fill(); c.clip();
    c.fillStyle = '#FFD25A'; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, h * (0.2 + i * 0.2)); c.lineTo(w, h * (0.0 + i * 0.2)); c.lineTo(w, h * (0.08 + i * 0.2)); c.lineTo(0, h * (0.28 + i * 0.2)); c.fill(); }
    c.restore(); outline(c, w * 0.05); c.beginPath(); c.moveTo(w * 0.5, h * 0.12); c.lineTo(w * 0.92, h * 0.94); c.lineTo(w * 0.08, h * 0.94); c.closePath(); c.stroke();
    ellipse(c, w * 0.5, h * 0.1, w * 0.11, w * 0.11); c.fillStyle = '#F2788C'; c.fill(); c.stroke();
  } },
  { id: 'crown', name: 'Crown', ratio: 1.4, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.08, h * 0.9); c.lineTo(w * 0.04, h * 0.2); c.lineTo(w * 0.3, h * 0.55); c.lineTo(w * 0.5, h * 0.08); c.lineTo(w * 0.7, h * 0.55); c.lineTo(w * 0.96, h * 0.2); c.lineTo(w * 0.92, h * 0.9); c.closePath();
    c.fillStyle = '#F5C542'; c.fill(); outline(c, h * 0.06); c.stroke();
    for (const [x, y, col] of [[0.5, 0.72, '#C8473D'], [0.25, 0.75, '#5B8DEF'], [0.75, 0.75, '#5B8DEF']]) { ellipse(c, w * x, h * y, h * 0.07, h * 0.07); c.fillStyle = col; c.fill(); c.lineWidth = h * 0.03; c.stroke(); }
  } },
  { id: 'halo', name: 'Halo', ratio: 2.6, draw(c, w, h) {
    ellipse(c, w / 2, h / 2, w * 0.44, h * 0.32); c.lineWidth = h * 0.24; c.strokeStyle = '#F5C542'; c.stroke();
    ellipse(c, w / 2, h / 2, w * 0.44 + h * 0.12, h * 0.44); c.lineWidth = h * 0.05; c.strokeStyle = INK; c.stroke();
    ellipse(c, w / 2, h / 2, w * 0.44 - h * 0.12, h * 0.2); c.stroke();
  } },
  { id: 'bow', name: 'Bow', ratio: 1.8, draw(c, w, h) {
    c.fillStyle = '#F2788C'; outline(c, h * 0.06);
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(w * 0.5, h * 0.5); c.bezierCurveTo(w * (0.5 + k * 0.2), h * -0.05, w * (0.5 + k * 0.5), h * 0.05, w * (0.5 + k * 0.46), h * 0.5); c.bezierCurveTo(w * (0.5 + k * 0.5), h * 0.95, w * (0.5 + k * 0.2), h * 1.05, w * 0.5, h * 0.5); c.fill(); c.stroke(); }
    ellipse(c, w * 0.5, h * 0.5, w * 0.09, h * 0.2); c.fillStyle = '#E0566E'; c.fill(); c.stroke();
  } },
  { id: 'blush', name: 'Blush', ratio: 3, draw(c, w, h) {
    for (const x of [0.17, 0.83]) {
      const g = c.createRadialGradient(w * x, h / 2, 0, w * x, h / 2, h * 0.48); g.addColorStop(0, 'rgba(242,120,140,.85)'); g.addColorStop(1, 'rgba(242,120,140,0)');
      c.fillStyle = g; ellipse(c, w * x, h / 2, h * 0.5, h * 0.42); c.fill();
    }
  } },
  { id: 'heart', name: 'Heart', ratio: 1.1, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.5, h * 0.92); c.bezierCurveTo(w * -0.15, h * 0.45, w * 0.18, h * -0.1, w * 0.5, h * 0.28); c.bezierCurveTo(w * 0.82, h * -0.1, w * 1.15, h * 0.45, w * 0.5, h * 0.92); c.closePath();
    c.fillStyle = '#E5484D'; c.fill(); outline(c, w * 0.05); c.stroke();
  } },
  { id: 'sparkles', name: 'Sparkles', ratio: 1.3, draw(c, w, h) {
    c.fillStyle = '#F5C542'; outline(c, h * 0.035);
    for (const [x, y, r] of [[0.35, 0.55, 0.38], [0.78, 0.25, 0.2], [0.8, 0.78, 0.15]]) { star(c, w * x, h * y, h * r); c.fill(); c.stroke(); }
  } },
];

// ---------- 天气：给云配点天气 ----------
const WEATHER = [
  { id: 'sun', name: 'Sun', ratio: 1, draw(c, w, h) {
    outline(c, w * 0.035); c.strokeStyle = '#E8A21E'; c.lineWidth = w * 0.06;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a) * h * 0.3); c.lineTo(w / 2 + Math.cos(a) * w * 0.46, h / 2 + Math.sin(a) * h * 0.46); c.stroke(); }
    ellipse(c, w / 2, h / 2, w * 0.24, h * 0.24); c.fillStyle = '#F5C542'; c.fill(); outline(c, w * 0.035); c.stroke();
  } },
  { id: 'rain', name: 'Raindrops', ratio: 1, draw(c, w, h) {
    for (const [x, y, k] of [[0.3, 0.3, 1], [0.68, 0.22, 0.8], [0.55, 0.68, 0.95], [0.22, 0.75, 0.7]]) {
      const r = w * 0.11 * k; c.beginPath(); c.moveTo(w * x, h * y - r * 1.9); c.bezierCurveTo(w * x + r * 1.1, h * y - r * 0.4, w * x + r, h * y + r, w * x, h * y + r);
      c.bezierCurveTo(w * x - r, h * y + r, w * x - r * 1.1, h * y - r * 0.4, w * x, h * y - r * 1.9); c.fillStyle = '#6FA8F2'; c.fill(); outline(c, w * 0.025); c.stroke();
    }
  } },
  { id: 'bolt', name: 'Lightning', ratio: 0.6, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.62, h * 0.02); c.lineTo(w * 0.12, h * 0.56); c.lineTo(w * 0.48, h * 0.56); c.lineTo(w * 0.3, h * 0.98); c.lineTo(w * 0.9, h * 0.4); c.lineTo(w * 0.52, h * 0.4); c.closePath();
    c.fillStyle = '#F5D02A'; c.fill(); outline(c, w * 0.05); c.stroke();
  } },
  { id: 'snow', name: 'Snowflake', ratio: 1, draw(c, w, h) {
    c.strokeStyle = '#7FB7F2'; c.lineCap = 'round'; c.lineWidth = w * 0.07;
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, ex = w / 2 + Math.cos(a) * w * 0.42, ey = h / 2 + Math.sin(a) * h * 0.42;
      c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(ex, ey); c.stroke();
      for (const sgn of [-1, 1]) { const mx = w / 2 + Math.cos(a) * w * 0.27, my = h / 2 + Math.sin(a) * h * 0.27; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + Math.cos(a + sgn * 0.8) * w * 0.12, my + Math.sin(a + sgn * 0.8) * h * 0.12); c.stroke(); } }
  } },
  { id: 'rainbow', name: 'Rainbow', ratio: 2, draw(c, w, h) {
    const cols = ['#E5484D', '#F28C28', '#F5C542', '#3FA45B', '#3B6FE0', '#8E5BD8'];
    cols.forEach((col, i) => { c.beginPath(); c.arc(w / 2, h * 0.98, w * (0.46 - i * 0.045), Math.PI, 0); c.lineWidth = w * 0.047; c.strokeStyle = col; c.stroke(); });
  } },
  { id: 'moon', name: 'Moon', ratio: 1, draw(c, w, h) {
    c.beginPath(); c.arc(w / 2, h / 2, w * 0.4, 0.35 * Math.PI, 1.65 * Math.PI, false); c.arc(w * 0.68, h * 0.42, w * 0.32, 1.55 * Math.PI, 0.45 * Math.PI, true); c.closePath();
    c.fillStyle = '#F8E08E'; c.fill(); outline(c, w * 0.035); c.stroke();
  } },
  { id: 'star', name: 'Star', ratio: 1, draw(c, w, h) {
    c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? w * 0.2 : w * 0.46; c.lineTo(w / 2 + Math.cos(a) * r, h * 0.53 + Math.sin(a) * r); } c.closePath();
    c.fillStyle = '#F5C542'; c.fill(); outline(c, w * 0.04); c.stroke();
  } },
  { id: 'wind', name: 'Wind', ratio: 1.6, draw(c, w, h) {
    outline(c, h * 0.08); c.strokeStyle = '#5D7FA8';
    c.beginPath(); c.moveTo(w * 0.05, h * 0.38); c.lineTo(w * 0.7, h * 0.38); c.arc(w * 0.7, h * 0.24, h * 0.14, Math.PI / 2, -Math.PI * 0.9, true); c.stroke();
    c.beginPath(); c.moveTo(w * 0.15, h * 0.62); c.lineTo(w * 0.8, h * 0.62); c.arc(w * 0.8, h * 0.76, h * 0.14, -Math.PI / 2, Math.PI * 0.9, false); c.stroke();
  } },
];

// ---------- 身体零件：让一朵云长出翅膀、角、尾巴 ----------
const PARTS = [
  { id: 'wings', name: 'Wings', ratio: 2.2, draw(c, w, h) {
    c.fillStyle = '#fff'; outline(c, h * 0.045);
    for (const k of [-1, 1]) {
      c.save(); c.translate(w / 2, h * 0.55); c.scale(k, 1);
      c.beginPath(); c.moveTo(w * 0.04, 0); c.bezierCurveTo(w * 0.12, -h * 0.55, w * 0.42, -h * 0.55, w * 0.48, -h * 0.25);
      c.bezierCurveTo(w * 0.4, -h * 0.18, w * 0.42, h * 0.02, w * 0.34, h * 0.04); c.bezierCurveTo(w * 0.3, h * 0.2, w * 0.18, h * 0.25, w * 0.04, 0); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(w * 0.14, -h * 0.05); c.quadraticCurveTo(w * 0.26, -h * 0.2, w * 0.38, -h * 0.18); c.stroke();
      c.restore();
    }
  } },
  { id: 'horns', name: 'Horns', ratio: 2, draw(c, w, h) {
    c.fillStyle = '#F2E6D0'; outline(c, h * 0.05);
    for (const k of [-1, 1]) { c.save(); c.translate(w / 2, h); c.scale(k, 1);
      c.beginPath(); c.moveTo(w * 0.12, 0); c.quadraticCurveTo(w * 0.1, -h * 0.75, w * 0.38, -h * 0.95); c.quadraticCurveTo(w * 0.25, -h * 0.55, w * 0.3, 0); c.closePath(); c.fill(); c.stroke(); c.restore(); }
  } },
  { id: 'catears', name: 'Cat ears', ratio: 2.2, draw(c, w, h) {
    for (const k of [-1, 1]) { c.save(); c.translate(w / 2, h); c.scale(k, 1);
      c.beginPath(); c.moveTo(w * 0.1, 0); c.lineTo(w * 0.26, -h * 0.92); c.lineTo(w * 0.44, 0); c.closePath(); c.fillStyle = '#fff'; c.fill(); outline(c, h * 0.06); c.stroke();
      c.beginPath(); c.moveTo(w * 0.17, -h * 0.08); c.lineTo(w * 0.26, -h * 0.62); c.lineTo(w * 0.36, -h * 0.08); c.closePath(); c.fillStyle = '#F4A7B5'; c.fill(); c.restore(); }
  } },
  { id: 'bunnyears', name: 'Bunny ears', ratio: 1.1, draw(c, w, h) {
    for (const k of [-1, 1]) { c.save(); c.translate(w / 2, h); c.scale(k, 1); c.rotate(0.12);
      ellipse(c, w * 0.2, -h * 0.48, w * 0.13, h * 0.46); c.fillStyle = '#fff'; c.fill(); outline(c, w * 0.04); c.stroke();
      ellipse(c, w * 0.2, -h * 0.46, w * 0.06, h * 0.34); c.fillStyle = '#F4A7B5'; c.fill(); c.restore(); }
  } },
  { id: 'tail', name: 'Curly tail', ratio: 1, draw(c, w, h) {
    outline(c, w * 0.07); c.beginPath(); c.moveTo(w * 0.08, h * 0.85);
    c.bezierCurveTo(w * 0.5, h * 0.95, w * 0.85, h * 0.6, w * 0.7, h * 0.3); c.bezierCurveTo(w * 0.6, h * 0.08, w * 0.3, h * 0.18, w * 0.38, h * 0.38);
    c.bezierCurveTo(w * 0.45, h * 0.52, w * 0.6, h * 0.42, w * 0.55, h * 0.32); c.stroke();
  } },
  { id: 'legs', name: 'Legs', ratio: 1.6, draw(c, w, h) {
    outline(c, w * 0.04);
    for (const x of [0.25, 0.7]) { c.beginPath(); c.moveTo(w * x, 0); c.lineTo(w * x, h * 0.8); c.stroke(); ellipse(c, w * x + w * 0.07, h * 0.86, w * 0.11, h * 0.1); c.fillStyle = INK; c.fill(); }
  } },
  { id: 'fin', name: 'Fin', ratio: 1, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.08, h * 0.95); c.quadraticCurveTo(w * 0.35, h * 0.2, w * 0.72, h * 0.05); c.quadraticCurveTo(w * 0.62, h * 0.5, w * 0.92, h * 0.95); c.closePath();
    c.fillStyle = '#8FA7BE'; c.fill(); outline(c, w * 0.05); c.stroke();
  } },
  { id: 'antennae', name: 'Antennae', ratio: 1.4, draw(c, w, h) {
    outline(c, w * 0.035);
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + k * w * 0.08, h); c.quadraticCurveTo(w / 2 + k * w * 0.12, h * 0.4, w / 2 + k * w * 0.36, h * 0.2); c.stroke();
      ellipse(c, w / 2 + k * w * 0.36, h * 0.17, w * 0.07, w * 0.07); c.fillStyle = '#E5484D'; c.fill(); c.stroke(); }
  } },
];

// ---------- 好玩的 ----------
const FUN = [
  { id: 'shades', name: 'Sunglasses', ratio: 2.6, draw(c, w, h) {
    c.fillStyle = '#1A1B24';
    for (const x of [0.06, 0.56]) { c.beginPath(); c.moveTo(w * x, h * 0.2); c.lineTo(w * (x + 0.38), h * 0.2); c.quadraticCurveTo(w * (x + 0.38), h * 0.95, w * (x + 0.19), h * 0.95); c.quadraticCurveTo(w * x, h * 0.95, w * x, h * 0.2); c.fill(); }
    outline(c, h * 0.1); c.beginPath(); c.moveTo(w * 0.44, h * 0.32); c.quadraticCurveTo(w * 0.5, h * 0.2, w * 0.56, h * 0.32); c.stroke();
    c.beginPath(); c.moveTo(0, h * 0.22); c.lineTo(w, h * 0.22); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; for (const x of [0.12, 0.62]) { c.fillRect(w * x, h * 0.3, w * 0.06, h * 0.12); }
  } },
  { id: 'speech', name: 'Speech bubble', ratio: 1.5, draw(c, w, h) {
    c.beginPath(); c.roundRect(w * 0.04, h * 0.05, w * 0.92, h * 0.7, h * 0.18); c.moveTo(w * 0.24, h * 0.74); c.lineTo(w * 0.18, h * 0.97); c.lineTo(w * 0.42, h * 0.74);
    c.fillStyle = '#fff'; c.fill(); outline(c, h * 0.05); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(w * 0.25, h * 0.71, w * 0.16, h * 0.06);
  } },
  { id: 'thought', name: 'Thought bubble', ratio: 1.4, draw(c, w, h) {
    c.fillStyle = '#fff'; outline(c, h * 0.045);
    c.beginPath(); for (const [x, y, r] of [[0.3, 0.38, 0.2], [0.52, 0.28, 0.24], [0.74, 0.4, 0.2], [0.5, 0.52, 0.2]]) { c.moveTo(w * x + w * r, h * y); c.arc(w * x, h * y, w * r, 0, Math.PI * 2); } c.fill();
    for (const [x, y, r] of [[0.3, 0.38, 0.2], [0.52, 0.28, 0.24], [0.74, 0.4, 0.2], [0.5, 0.52, 0.2]]) { c.beginPath(); c.arc(w * x, h * y, w * r, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); for (const [x, y, r] of [[0.3, 0.38, 0.2], [0.52, 0.28, 0.24], [0.74, 0.4, 0.2], [0.5, 0.52, 0.2]]) { c.moveTo(w * x + w * r - 2, h * y); c.arc(w * x, h * y, w * r - c.lineWidth, 0, Math.PI * 2); } c.fill();
    for (const [x, y, r] of [[0.22, 0.78, 0.07], [0.12, 0.92, 0.045]]) { ellipse(c, w * x, h * y, w * r, w * r); c.fill(); c.stroke(); }
  } },
  { id: 'note', name: 'Music note', ratio: 0.8, draw(c, w, h) {
    c.fillStyle = INK; outline(c, w * 0.08);
    ellipse(c, w * 0.3, h * 0.8, w * 0.2, h * 0.12, -0.35); c.fill(); ellipse(c, w * 0.78, h * 0.68, w * 0.2, h * 0.12, -0.35); c.fill();
    c.beginPath(); c.moveTo(w * 0.47, h * 0.78); c.lineTo(w * 0.47, h * 0.12); c.lineTo(w * 0.95, h * 0.02); c.lineTo(w * 0.95, h * 0.66); c.stroke();
    c.lineWidth = w * 0.12; c.beginPath(); c.moveTo(w * 0.47, h * 0.17); c.lineTo(w * 0.95, h * 0.07); c.stroke();
  } },
  { id: 'zzz', name: 'Zzz', ratio: 1.2, draw(c, w, h) {
    c.fillStyle = '#5B7FD8'; c.font = `800 ${h * 0.5}px system-ui, sans-serif`; c.textBaseline = 'alphabetic';
    c.fillText('Z', w * 0.05, h * 0.95); c.font = `800 ${h * 0.36}px system-ui, sans-serif`; c.fillText('z', w * 0.45, h * 0.62); c.font = `800 ${h * 0.26}px system-ui, sans-serif`; c.fillText('z', w * 0.75, h * 0.32);
  } },
  { id: 'bang', name: 'Exclamation', ratio: 0.45, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.2, h * 0.04); c.lineTo(w * 0.8, h * 0.04); c.lineTo(w * 0.62, h * 0.68); c.lineTo(w * 0.38, h * 0.68); c.closePath(); c.fillStyle = '#E5484D'; c.fill(); outline(c, w * 0.08); c.stroke();
    ellipse(c, w / 2, h * 0.86, w * 0.2, w * 0.2); c.fill(); c.stroke();
  } },
  { id: 'question', name: 'Question mark', ratio: 0.7, draw(c, w, h) {
    c.fillStyle = '#3B6FE0'; c.font = `900 ${h * 1.05}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = h * 0.05; c.strokeStyle = INK;
    c.strokeText('?', w / 2, h * 0.55); c.fillText('?', w / 2, h * 0.55); c.textAlign = 'start';
  } },
  { id: 'heartseyes', name: 'Heart eyes', ratio: 2.2, draw(c, w, h) {
    for (const x of [0.25, 0.75]) { const s = h * 0.9, X = w * x - s / 2, Y = h * 0.05;
      c.beginPath(); c.moveTo(X + s * 0.5, Y + s * 0.92); c.bezierCurveTo(X - s * 0.15, Y + s * 0.45, X + s * 0.18, Y - s * 0.1, X + s * 0.5, Y + s * 0.28); c.bezierCurveTo(X + s * 0.82, Y - s * 0.1, X + s * 1.15, Y + s * 0.45, X + s * 0.5, Y + s * 0.92);
      c.fillStyle = '#E5484D'; c.fill(); outline(c, h * 0.06); c.stroke(); }
  } },
];

// ---------- 11-18 第三包：小物件、太空、表情 ----------
const THINGS = [
  { id: 'balloon', name: 'Balloon', ratio: 0.6, draw(c, w, h) {
    ellipse(c, w / 2, h * 0.32, w * 0.42, h * 0.3); c.fillStyle = '#E5484D'; c.fill(); outline(c, w * 0.05); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; ellipse(c, w * 0.36, h * 0.22, w * 0.08, h * 0.06, -0.5); c.fill();
    c.beginPath(); c.moveTo(w * 0.44, h * 0.62); c.lineTo(w * 0.56, h * 0.62); c.lineTo(w / 2, h * 0.67); c.closePath(); c.fillStyle = '#E5484D'; c.fill(); c.stroke();
    outline(c, w * 0.03); c.beginPath(); c.moveTo(w / 2, h * 0.67); c.bezierCurveTo(w * 0.35, h * 0.78, w * 0.65, h * 0.88, w / 2, h * 0.99); c.stroke();
  } },
  { id: 'gift', name: 'Gift', ratio: 1, draw(c, w, h) {
    c.fillStyle = '#3B6FE0'; c.fillRect(w * 0.12, h * 0.4, w * 0.76, h * 0.54); outline(c, w * 0.045); c.strokeRect(w * 0.12, h * 0.4, w * 0.76, h * 0.54);
    c.fillStyle = '#5B8DEF'; c.fillRect(w * 0.06, h * 0.28, w * 0.88, h * 0.14); c.strokeRect(w * 0.06, h * 0.28, w * 0.88, h * 0.14);
    c.fillStyle = '#F5C542'; c.fillRect(w * 0.44, h * 0.28, w * 0.12, h * 0.66); c.strokeRect(w * 0.44, h * 0.28, w * 0.12, h * 0.66);
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(w / 2, h * 0.28); c.bezierCurveTo(w / 2 + k * w * 0.1, h * 0.02, w / 2 + k * w * 0.4, h * 0.08, w / 2 + k * w * 0.06, h * 0.27); c.fillStyle = '#F5C542'; c.fill(); c.stroke(); }
  } },
  { id: 'icecream', name: 'Ice cream', ratio: 0.62, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.14, h * 0.45); c.lineTo(w * 0.86, h * 0.45); c.lineTo(w / 2, h * 0.98); c.closePath(); c.fillStyle = '#E2A85B'; c.fill(); outline(c, w * 0.05); c.stroke();
    c.save(); c.clip(); c.strokeStyle = 'rgba(120,70,20,.45)'; c.lineWidth = w * 0.03; for (let i = -3; i < 6; i++) { c.beginPath(); c.moveTo(w * (0.1 + i * 0.16), h * 0.45); c.lineTo(w * (0.6 + i * 0.16), h); c.stroke(); } c.restore();
    for (const [x, y, r, col] of [[0.32, 0.36, 0.22, '#F4A7B5'], [0.68, 0.36, 0.22, '#F8E3B0'], [0.5, 0.2, 0.24, '#9CD7B0']]) { ellipse(c, w * x, h * y, w * r, w * r); c.fillStyle = col; c.fill(); outline(c, w * 0.045); c.stroke(); }
    ellipse(c, w / 2, h * 0.02 + w * 0.06, w * 0.07, w * 0.07); c.fillStyle = '#E5484D'; c.fill(); c.stroke();
  } },
  { id: 'cupcake', name: 'Cupcake', ratio: 0.9, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.16, h * 0.5); c.lineTo(w * 0.84, h * 0.5); c.lineTo(w * 0.74, h * 0.96); c.lineTo(w * 0.26, h * 0.96); c.closePath(); c.fillStyle = '#F2788C'; c.fill(); outline(c, w * 0.045); c.stroke();
    for (const x of [0.36, 0.5, 0.64]) { c.beginPath(); c.moveTo(w * x, h * 0.52); c.lineTo(w * (x - 0.02), h * 0.94); c.stroke(); }
    c.beginPath(); c.moveTo(w * 0.1, h * 0.52); c.bezierCurveTo(w * 0.02, h * 0.22, w * 0.3, h * 0.2, w * 0.35, h * 0.24); c.bezierCurveTo(w * 0.4, h * 0.02, w * 0.62, h * 0.04, w * 0.64, h * 0.22); c.bezierCurveTo(w * 0.85, h * 0.18, w * 0.98, h * 0.3, w * 0.9, h * 0.52); c.closePath();
    c.fillStyle = '#FFF4E4'; c.fill(); c.stroke();
    for (const [x, y, col] of [[0.3, 0.38, '#3B6FE0'], [0.5, 0.3, '#F5C542'], [0.68, 0.4, '#3FA45B'], [0.45, 0.45, '#E5484D']]) { c.fillStyle = col; c.fillRect(w * x, h * y, w * 0.07, h * 0.03); }
    ellipse(c, w * 0.52, h * 0.08, w * 0.07, w * 0.07); c.fillStyle = '#E5484D'; c.fill(); c.stroke();
  } },
  { id: 'flower', name: 'Flower', ratio: 1, draw(c, w, h) {
    c.fillStyle = '#F4A7B5'; outline(c, w * 0.04);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ellipse(c, w / 2 + Math.cos(a) * w * 0.24, h / 2 + Math.sin(a) * h * 0.24, w * 0.17, h * 0.17); c.fill(); c.stroke(); }
    ellipse(c, w / 2, h / 2, w * 0.16, h * 0.16); c.fillStyle = '#F5C542'; c.fill(); c.stroke();
  } },
  { id: 'mushroom', name: 'Mushroom', ratio: 1, draw(c, w, h) {
    c.beginPath(); c.roundRect(w * 0.34, h * 0.45, w * 0.32, h * 0.5, w * 0.08); c.fillStyle = '#FFF4E4'; c.fill(); outline(c, w * 0.045); c.stroke();
    c.beginPath(); c.moveTo(w * 0.04, h * 0.52); c.bezierCurveTo(w * 0.04, h * 0.02, w * 0.96, h * 0.02, w * 0.96, h * 0.52); c.closePath(); c.fillStyle = '#E5484D'; c.fill(); c.stroke();
    c.fillStyle = '#fff'; for (const [x, y, r] of [[0.3, 0.3, 0.08], [0.6, 0.2, 0.07], [0.72, 0.4, 0.06], [0.45, 0.42, 0.05]]) { ellipse(c, w * x, h * y, w * r, w * r); c.fill(); }
  } },
  { id: 'umbrella', name: 'Umbrella', ratio: 1, draw(c, w, h) {
    c.beginPath(); c.moveTo(w * 0.04, h * 0.48); c.bezierCurveTo(w * 0.06, h * 0.02, w * 0.94, h * 0.02, w * 0.96, h * 0.48);
    for (let i = 3; i >= 0; i--) c.quadraticCurveTo(w * (0.04 + (i + 0.5) * 0.23), h * 0.38, w * (0.04 + i * 0.23), h * 0.48);
    c.closePath(); c.fillStyle = '#8E5BD8'; c.fill(); outline(c, w * 0.04); c.stroke();
    c.beginPath(); c.moveTo(w / 2, h * 0.42); c.lineTo(w / 2, h * 0.88); c.arc(w * 0.42, h * 0.88, w * 0.08, 0, Math.PI); c.stroke();
  } },
  { id: 'kite', name: 'Kite', ratio: 0.7, draw(c, w, h) {
    c.beginPath(); c.moveTo(w / 2, h * 0.02); c.lineTo(w * 0.96, h * 0.32); c.lineTo(w / 2, h * 0.72); c.lineTo(w * 0.04, h * 0.32); c.closePath(); c.fillStyle = '#F28C28'; c.fill(); outline(c, w * 0.04); c.stroke();
    c.beginPath(); c.moveTo(w / 2, h * 0.02); c.lineTo(w / 2, h * 0.72); c.moveTo(w * 0.04, h * 0.32); c.lineTo(w * 0.96, h * 0.32); c.stroke();
    c.beginPath(); c.moveTo(w / 2, h * 0.72); c.bezierCurveTo(w * 0.3, h * 0.82, w * 0.7, h * 0.9, w * 0.45, h * 0.99); c.stroke();
    for (const [x, y] of [[0.42, 0.8], [0.6, 0.88]]) { c.save(); c.translate(w * x, h * y); c.fillStyle = '#E5484D'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-w * 0.07, -h * 0.03); c.lineTo(-w * 0.07, h * 0.03); c.fill(); c.beginPath(); c.moveTo(0, 0); c.lineTo(w * 0.07, -h * 0.03); c.lineTo(w * 0.07, h * 0.03); c.fill(); c.restore(); }
  } },
];
const SPACE = [
  { id: 'rocket', name: 'Rocket', ratio: 0.55, draw(c, w, h) {
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + k * w * 0.22, h * 0.55); c.lineTo(w / 2 + k * w * 0.48, h * 0.8); c.lineTo(w / 2 + k * w * 0.22, h * 0.78); c.closePath(); c.fillStyle = '#E5484D'; c.fill(); outline(c, w * 0.05); c.stroke(); }
    c.beginPath(); c.moveTo(w / 2, h * 0.02); c.bezierCurveTo(w * 0.9, h * 0.25, w * 0.8, h * 0.65, w * 0.7, h * 0.8); c.lineTo(w * 0.3, h * 0.8); c.bezierCurveTo(w * 0.2, h * 0.65, w * 0.1, h * 0.25, w / 2, h * 0.02); c.closePath();
    c.fillStyle = '#F2F2F5'; c.fill(); outline(c, w * 0.05); c.stroke();
    ellipse(c, w / 2, h * 0.36, w * 0.14, w * 0.14); c.fillStyle = '#7FB7F2'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(w * 0.34, h * 0.82); c.quadraticCurveTo(w / 2, h * 1.02, w * 0.66, h * 0.82); c.closePath(); c.fillStyle = '#F5C542'; c.fill();
  } },
  { id: 'ufo', name: 'UFO', ratio: 1.6, draw(c, w, h) {
    c.fillStyle = 'rgba(245,197,66,.35)'; c.beginPath(); c.moveTo(w * 0.36, h * 0.62); c.lineTo(w * 0.2, h); c.lineTo(w * 0.8, h); c.lineTo(w * 0.64, h * 0.62); c.fill();
    ellipse(c, w / 2, h * 0.32, w * 0.2, h * 0.24); c.fillStyle = '#A9DCF5'; c.fill(); outline(c, w * 0.03); c.stroke();
    ellipse(c, w / 2, h * 0.5, w * 0.46, h * 0.16); c.fillStyle = '#9AA3AD'; c.fill(); c.stroke();
    c.fillStyle = '#F5C542'; for (const x of [0.25, 0.42, 0.58, 0.75]) { ellipse(c, w * x, h * 0.52, w * 0.035, w * 0.035); c.fill(); }
  } },
  { id: 'planet', name: 'Ringed planet', ratio: 1.5, draw(c, w, h) {
    c.save(); c.translate(w / 2, h / 2); c.rotate(-0.25);
    ellipse(c, 0, 0, w * 0.46, h * 0.14); c.lineWidth = h * 0.07; c.strokeStyle = '#F2C27E'; c.stroke();
    ellipse(c, 0, 0, w * 0.24, w * 0.24); c.fillStyle = '#E8A55B'; c.fill(); outline(c, w * 0.03); c.stroke();
    c.strokeStyle = 'rgba(150,80,30,.5)'; c.lineWidth = w * 0.025; for (const y of [-0.08, 0.04]) { c.beginPath(); c.moveTo(-w * 0.22, w * y); c.quadraticCurveTo(0, w * (y + 0.04), w * 0.22, w * y); c.stroke(); }
    c.beginPath(); c.ellipse(0, 0, w * 0.46, h * 0.14, 0, 0, Math.PI); c.lineWidth = h * 0.07; c.strokeStyle = '#F2C27E'; c.stroke();
    c.restore();
  } },
  { id: 'comet', name: 'Comet', ratio: 1.8, draw(c, w, h) {
    const g = c.createLinearGradient(0, h, w * 0.75, h * 0.3); g.addColorStop(0, 'rgba(127,183,242,0)'); g.addColorStop(1, 'rgba(127,183,242,.9)');
    c.fillStyle = g; c.beginPath(); c.moveTo(w * 0.02, h * 0.98); c.lineTo(w * 0.7, h * 0.18); c.lineTo(w * 0.84, h * 0.5); c.closePath(); c.fill();
    ellipse(c, w * 0.78, h * 0.34, h * 0.2, h * 0.2); c.fillStyle = '#FFF4C2'; c.fill(); outline(c, w * 0.02); c.stroke();
  } },
  { id: 'alien', name: 'Alien', ratio: 0.85, draw(c, w, h) {
    for (const k of [-1, 1]) { outline(c, w * 0.04); c.beginPath(); c.moveTo(w / 2 + k * w * 0.15, h * 0.2); c.lineTo(w / 2 + k * w * 0.3, h * 0.04); c.stroke(); ellipse(c, w / 2 + k * w * 0.3, h * 0.04, w * 0.05, w * 0.05); c.fillStyle = '#9BE07A'; c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(w / 2, h * 0.15); c.bezierCurveTo(w * 1.02, h * 0.15, w * 0.85, h * 0.85, w / 2, h * 0.97); c.bezierCurveTo(w * 0.15, h * 0.85, w * -0.02, h * 0.15, w / 2, h * 0.15); c.fillStyle = '#9BE07A'; c.fill(); outline(c, w * 0.045); c.stroke();
    for (const k of [-1, 1]) { ellipse(c, w / 2 + k * w * 0.17, h * 0.5, w * 0.12, h * 0.08, k * 0.5); c.fillStyle = INK; c.fill(); }
    outline(c, w * 0.035); c.beginPath(); c.arc(w / 2, h * 0.7, w * 0.07, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  } },
  { id: 'stars3', name: 'Little stars', ratio: 1.4, draw(c, w, h) {
    c.fillStyle = '#FFF4C2'; outline(c, h * 0.03);
    for (const [x, y, r] of [[0.25, 0.6, 0.3], [0.65, 0.3, 0.22], [0.82, 0.75, 0.14]]) { star(c, w * x, h * y, h * r); c.fill(); c.stroke(); }
  } },
];
const FEELINGS = [
  { id: 'tear', name: 'Tear', ratio: 0.7, draw(c, w, h) {
    c.beginPath(); c.moveTo(w / 2, h * 0.02); c.bezierCurveTo(w * 0.95, h * 0.5, w * 0.9, h * 0.98, w / 2, h * 0.98); c.bezierCurveTo(w * 0.1, h * 0.98, w * 0.05, h * 0.5, w / 2, h * 0.02);
    c.fillStyle = '#7FB7F2'; c.fill(); outline(c, w * 0.06); c.stroke(); c.fillStyle = 'rgba(255,255,255,.75)'; ellipse(c, w * 0.38, h * 0.62, w * 0.08, h * 0.1, 0.3); c.fill();
  } },
  { id: 'sweat', name: 'Sweat drops', ratio: 1, draw(c, w, h) {
    for (const [x, y, k] of [[0.35, 0.3, 1], [0.7, 0.55, 0.7]]) { const r = w * 0.18 * k; c.beginPath(); c.moveTo(w * x, h * y - r * 1.6); c.bezierCurveTo(w * x + r * 1.1, h * y, w * x + r, h * y + r, w * x, h * y + r); c.bezierCurveTo(w * x - r, h * y + r, w * x - r * 1.1, h * y, w * x, h * y - r * 1.6); c.fillStyle = '#A9DCF5'; c.fill(); outline(c, w * 0.035); c.stroke(); }
  } },
  { id: 'anger', name: 'Cross', ratio: 1, draw(c, w, h) {
    c.strokeStyle = '#E5484D'; c.lineCap = 'round'; c.lineWidth = w * 0.11;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const cx = w / 2 + dx * w * 0.36, cy = h / 2 + dy * h * 0.36, a = Math.atan2(-dy, -dx); c.beginPath(); c.arc(cx, cy, w * 0.26, a - 0.62, a + 0.62); c.stroke(); }
  } },
  { id: 'glasses', name: 'Round glasses', ratio: 2.4, draw(c, w, h) {
    outline(c, h * 0.1); for (const x of [0.25, 0.75]) { ellipse(c, w * x, h * 0.52, w * 0.19, h * 0.4); c.fillStyle = 'rgba(169,220,245,.25)'; c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(w * 0.44, h * 0.45); c.quadraticCurveTo(w / 2, h * 0.3, w * 0.56, h * 0.45); c.stroke();
  } },
  { id: 'bowtie', name: 'Bow tie', ratio: 2, draw(c, w, h) {
    c.fillStyle = '#E5484D'; outline(c, h * 0.06);
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + k * w * 0.46, h * 0.1); c.lineTo(w / 2 + k * w * 0.46, h * 0.9); c.closePath(); c.fill(); c.stroke(); }
    c.beginPath(); c.roundRect(w * 0.42, h * 0.3, w * 0.16, h * 0.4, h * 0.08); c.fillStyle = '#C8373D'; c.fill(); c.stroke();
  } },
  { id: 'xeyes', name: 'X eyes', ratio: 2.2, draw(c, w, h) {
    outline(c, h * 0.12); for (const x of [0.25, 0.75]) { const r = h * 0.3; c.beginPath(); c.moveTo(w * x - r, h / 2 - r); c.lineTo(w * x + r, h / 2 + r); c.moveTo(w * x + r, h / 2 - r); c.lineTo(w * x - r, h / 2 + r); c.stroke(); }
  } },
  { id: 'dizzy', name: 'Dizzy', ratio: 1.6, draw(c, w, h) {
    outline(c, h * 0.07); c.strokeStyle = '#8E5BD8';
    c.beginPath(); for (let t = 0; t < 7 * Math.PI; t += 0.15) { const r = h * 0.04 + t * h * 0.02; c.lineTo(w * 0.3 + Math.cos(t) * r, h / 2 + Math.sin(t) * r); } c.stroke();
    c.fillStyle = '#F5C542'; c.strokeStyle = INK; c.lineWidth = h * 0.03; for (const [x, y, r] of [[0.72, 0.25, 0.14], [0.86, 0.6, 0.1]]) { star(c, w * x, h * y, h * r); c.fill(); c.stroke(); }
  } },
  { id: 'stareyes', name: 'Star eyes', ratio: 2.2, draw(c, w, h) {
    c.fillStyle = '#F5C542'; outline(c, h * 0.06); for (const x of [0.25, 0.75]) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? h * 0.2 : h * 0.46; c.lineTo(w * x + Math.cos(a) * r, h * 0.52 + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); }
  } },
];

FACES.forEach(s => s.pack = 'faces'); WEATHER.forEach(s => s.pack = 'weather'); PARTS.forEach(s => s.pack = 'parts'); FUN.forEach(s => s.pack = 'fun');
THINGS.forEach(s => s.pack = 'things'); SPACE.forEach(s => s.pack = 'space'); FEELINGS.forEach(s => s.pack = 'feelings');
export const STICKERS = [...FACES, ...WEATHER, ...PARTS, ...FUN, ...THINGS, ...SPACE, ...FEELINGS];
export const byId = Object.fromEntries(STICKERS.map(s => [s.id, s]));

// ---------- 文字：三种字，白边，贴在什么底上都看得清 ----------
export const FONTS = {
  serif: { name: 'Serif', css: '600 100px Fraunces, Georgia, serif' },
  sans: { name: 'Bold', css: '800 100px -apple-system, system-ui, "Segoe UI", sans-serif' },
  hand: { name: 'Hand', css: '600 100px "Bradley Hand", "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive' },
};
const measure = document.createElement('canvas').getContext('2d');
export function textRatio(o) {
  measure.font = (FONTS[o.f] || FONTS.serif).css;
  return Math.max(0.5, measure.measureText(o.text).width / 118);
}
export function paintText(ctx, o, x, y, w) {
  const h = w / (o.ratio || textRatio(o)), size = h * 0.85;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.r || 0); if (o.flip) ctx.scale(-1, 1);
  ctx.font = (FONTS[o.f] || FONTS.serif).css.replace('100px', size + 'px');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const light = isLight(o.c);
  ctx.lineWidth = size * 0.16; ctx.strokeStyle = light ? 'rgba(26,27,36,.85)' : 'rgba(255,255,255,.92)'; ctx.strokeText(o.text, 0, h * 0.04);
  ctx.fillStyle = o.c || INK; ctx.fillText(o.text, 0, h * 0.04);
  ctx.restore();
}
function isLight(c) { if (!c || c[0] !== '#') return false; const v = parseInt(c.slice(1), 16); return ((v >> 16 & 255) * 0.3 + (v >> 8 & 255) * 0.59 + (v & 255) * 0.11) > 170; }

/** 一枚贴纸画进 ctx：中心 (x, y)，宽 w（高按比例），转 r 弧度 */
export function paint(ctx, st, x, y, w, r, flip) {
  const h = w / st.ratio;
  ctx.save(); ctx.translate(x, y); ctx.rotate(r); if (flip) ctx.scale(-1, 1); ctx.translate(-w / 2, -h / 2);
  st.draw(ctx, w, h);
  ctx.restore();
}

/** 托盘里的小图标 */
export function icon(st, size, dpr) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const pad = size * 0.14, w0 = size - pad * 2;
  const w = st.ratio >= 1 ? w0 : w0 * st.ratio;
  paint(g, st, size / 2, size / 2, w, 0);
  return c;
}
