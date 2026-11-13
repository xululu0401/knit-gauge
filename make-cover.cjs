/* 封面 cover.svg（1200×1200），数字全部来自 core.js 默认场景的同一次 compute；再用浏览器截成 cover.png。
 * 字体名用单引号（SVG 是 XML，裸双引号会让整张图变错误页，批次 64 踩过）。 */
const fs = require('node:fs'), path = require('node:path');
const A = require('./core.js');
const o = A.compute(A.defaultState());
if (!o.ok) throw new Error('默认场景算不出来');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif", M = 'ui-monospace,Menlo,Consolas,monospace';
const g = o.gauge;
function stitches(n, y, color) {
  const W = 960, step = W / n; let s = '';
  for (let j = 0; j < Math.floor(n); j++) { const x = 120 + j * step + step / 2, w = step * 0.42; s += `<path d="M${(x - w).toFixed(1)} ${y} L${x.toFixed(1)} ${y + 70} L${(x + w).toFixed(1)} ${y}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`; }
  s += `<line x1="120" y1="${y + 95}" x2="1080" y2="${y + 95}" stroke="#8a8490" stroke-width="3"/>`;
  for (let i = 0; i <= 10; i++) s += `<line x1="${120 + i * 96}" y1="${y + (i % 5 ? 82 : 72)}" x2="${120 + i * 96}" y2="${y + 95}" stroke="#8a8490" stroke-width="3"/>`;
  return s;
}
const rows = o.pieces.map((p) => [p.name, p.start + ' → ' + p.start2 + ' 针', A.fmtSigned(p.dW, 1) + ' cm', p.flag]);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f4f1ec"/>
  <rect x="60" y="60" width="1080" height="1080" fill="#fffdfa" stroke="#e4dde3"/>
  <rect x="60" y="60" width="1080" height="12" fill="#8c3b5a"/>
  <text x="120" y="190" font-family="${F}" font-size="84" font-weight="700" fill="#2b2730">十厘米里几针</text>
  <text x="120" y="250" font-family="${F}" font-size="32" fill="#8a8490">样片和图解对不上，把图解按你的手劲改过来</text>
  <text x="120" y="330" font-family="${F}" font-size="32" fill="#6f7d8c">图解 ${A.fmtV(g.ps, 2)} 针 / 10 cm</text>
  ${stitches(g.ps, 352, '#6f7d8c')}
  <text x="120" y="520" font-family="${F}" font-size="32" fill="#8c3b5a">我的样片 ${A.fmtV(g.myS, 2)} 针 / 10 cm</text>
  ${stitches(g.myS, 542, '#8c3b5a')}
  <line x1="120" y1="700" x2="1080" y2="700" stroke="#e4dde3" stroke-dasharray="10 10" stroke-width="2"/>
  ${rows.map((r, i) => `<text x="120" y="${770 + i * 74}" font-family="${F}" font-size="36" font-weight="700" fill="#2b2730">${r[0]}</text>
  <text x="640" y="${770 + i * 74}" font-family="${M}" font-size="36" font-weight="700" fill="#8c3b5a">${r[1]}</text>
  <text x="1080" y="${770 + i * 74}" text-anchor="end" font-family="${M}" font-size="34" font-weight="700" fill="${r[3] === 'narrow' ? '#a3401f' : r[3] === 'wide' ? '#8a6512' : '#3f6b4a'}">${r[2]}</text>`).join('\n  ')}
  <text x="120" y="1090" font-family="${F}" font-size="24" fill="#8a8490">默认场景为虚构示例 · 按样片密度等比换算 · 按花样倍数取整</text>
</svg>`;
fs.writeFileSync(path.join(__dirname, 'cover.svg'), svg);
console.log('cover.svg', fs.statSync(path.join(__dirname, 'cover.svg')).size, 'bytes');
