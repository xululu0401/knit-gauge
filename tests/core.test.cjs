/* 十厘米里几针 · 核心测试
 * 跑法：node --test tests/core.test.cjs
 * 纪律：
 *  - 锚点 A1–A9 来自 ../evidence/手算锚点.py（独立写的 Python，用分数精确算，不读 core.js）；
 *  - ok=false 时断言「算不出来」与错误码，不断言 0；断言前先确认字段存在且是有限数字；
 *  - 建议里带的数字一律按它改输入重算一遍当断言；
 *  - 最后一组「人工注入错误」：每个注入都必须让至少一个锚点变红。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC_PATH = path.join(__dirname, '..', 'core.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');
const C = require(SRC_PATH);

function loadFromSource(src) {
  const ctx = { console: console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.AppCore;
}
function near(a, b, eps, msg) {
  assert.ok(typeof a === 'number' && isFinite(a), (msg || '') + ' —— 期望有限数字，实际 ' + a);
  assert.ok(Math.abs(a - b) <= (eps == null ? 1e-6 : eps), (msg || '') + ' —— 期望 ' + b + '，实际 ' + a);
}
function S(mut) { const s = C.defaultState(); if (mut) mut(s); return s; }
function D(mut) { return C.compute(S(mut)); }
function codes(o) { return o.errors.map((e) => e.code); }

/* 锚点指纹：注入错误组用同一套断言判红 */
function anchors(A) {
  const o = A.compute(A.defaultState());
  const r = [];
  const chk = (name, cond) => r.push([name, !!cond]);
  const n = (a, b, e) => typeof a === 'number' && Math.abs(a - b) <= (e || 1e-6);
  chk('ok', o.ok);
  if (!o.ok) return r;
  const P = o.pieces;
  chk('A1 我的针密度', n(o.gauge.myS, 19.2));
  chk('A1 我的行密度', n(o.gauge.myR, 27.826087));
  chk('A2 罗纹平局取大 98', P[0].start2 === 98);
  chk('A3 身片 96 针', P[1].start2 === 96);
  chk('A3 身片 111 行', P[1].rows2 === 111);
  chk('A4 袖起 44', P[2].start2 === 44);
  chk('A4 袖结束 70', P[2].end2 === 70);
  chk('A4 袖 117 行', P[2].rows2 === 117);
  chk('A4 袖 每 9 行 × 13', JSON.stringify(P[2].dist2) === JSON.stringify([{ every: 9, times: 13 }]));
  chk('A4b 原袖 8×9 + 9×6', JSON.stringify(P[2].distO) === JSON.stringify([{ every: 8, times: 9 }, { every: 9, times: 6 }]));
  chk('A5 领口 80', P[3].start2 === 80);
  chk('A5 领口宽差', n(P[3].dW, -1.969697));
  chk('A5 领口 narrow', P[3].flag === 'narrow');
  chk('A6 原面积', n(o.areaO, 7285.454545));
  chk('A6 改面积', n(o.area2, 7303.922526));
  chk('A7 称重 g', n(o.yarn.weight.grams, 499.912920));
  chk('A7 称重 10 团', o.yarn.weight.balls === 10);
  chk('A8 米数 m', n(o.yarn.meter.meters, 1102.788402));
  chk('A8 米数 12 团', o.yarn.meter.balls === 12);
  chk('A9 还买 8 团 144 元', o.yarn.buy === 8 && o.yarn.cost === 144);
  const up = o.actions.find((a) => a.kind === 'roundUp');
  chk('A5 往上取 88、宽 +2.197', !!up && up.to === 88 && n(up.dW, 2.196970));
  const mx = o.actions.find((a) => a.kind === 'maxMethod');
  chk('A9 按多的 12 团 买 10 团 180 元', !!mx && mx.balls === 12 && mx.buy === 10 && mx.cost === 180);
  /* 第一轮注入 4 个存活后补的尖锚点（A10–A12，见 手算锚点.py） */
  chk('A10 93 针按 8 倍 +6 → 94', A.roundRepeat(93, 8, 6, 'near') === 94);
  const s11 = A.defaultState(); s11.pieces[2].start = '52';
  const o11 = A.compute(s11);
  chk('A11 袖起 52 → 45 针、结束 69（差 24 = 2 × 12）', o11.ok && o11.pieces[2].start2 === 45 && o11.pieces[2].end2 === 69);
  const s12 = A.defaultState(); Object.assign(s12, { swS: '22', swW: '10', swR: '30', swH: '10', method: 'meter' });
  const o12 = A.compute(s12);
  chk('A12 米数 1100 m 每团 100 m → 正好 11 团', o12.ok && n(o12.yarn.meter.meters, 1100) && o12.yarn.meter.balls === 11);
  s12.yM = '120'; const o12b = A.compute(s12);
  chk('A12 每团 120 m → 9.17 进成 10 团', o12b.ok && o12b.yarn.meter.balls === 10);
  /* 称重法同理：反推正好 500 g（10 团）与 459 g（9.18 → 10 团） */
  const sw = A.defaultState(); Object.assign(sw, { swS: '22', swW: '10', swR: '30', swH: '10' });
  const area = A.compute(sw).area2;
  sw.wg = String(500 / 1.1 / area * 225); const ow = A.compute(sw);
  chk('A12w 正好 500 g → 10 团', ow.ok && n(ow.yarn.weight.grams, 500, 1e-6) && ow.yarn.weight.balls === 10);
  sw.wg = String(459 / 1.1 / area * 225); const ow2 = A.compute(sw);
  chk('A12w 459 g → 9.18 进成 10 团', ow2.ok && ow2.yarn.weight.balls === 10);
  return r;
}

test('默认场景：全部锚点（来自独立 Python 手算）', () => {
  const bad = anchors(C).filter((x) => !x[1]).map((x) => x[0]);
  assert.deepStrictEqual(bad, []);
});

test('默认场景：字段存在、有限、值域合理', () => {
  const o = D();
  assert.strictEqual(o.ok, true);
  o.pieces.forEach((p) => {
    ['start2', 'end2', 'rows2', 'w2', 'h2', 'dW', 'dH', 'area2'].forEach((k) => assert.ok(typeof p[k] === 'number' && isFinite(p[k]), p.name + '.' + k));
    assert.ok(Number.isInteger(p.start2) && Number.isInteger(p.end2) && Number.isInteger(p.rows2));
    assert.strictEqual((p.start2 - p.e) % p.k, 0, p.name + ' 起针要满足花样倍数');
    assert.strictEqual(Math.abs(p.end2 - p.start2) % p.per, 0, p.name + ' 加减针要是每次针数的整数倍');
    const sum = p.dist2.reduce((a, d) => a + d.every * d.times, 0);
    const cnt = p.dist2.reduce((a, d) => a + d.times, 0);
    assert.strictEqual(cnt, p.n2, p.name + ' 次数之和');
    if (p.n2 > 0) assert.strictEqual(sum, p.rows2, p.name + ' 均分后行数之和 = 新行数');
  });
  assert.strictEqual(o.pieceCount, 7);
});

test('花样倍数取整：最近 / 往上 / 往下 / 平局取大 / 至少一个花样', () => {
  assert.strictEqual(C.roundRepeat(83.78, 8, 0, 'near'), 80);
  assert.strictEqual(C.roundRepeat(83.78, 8, 0, 'up'), 88);
  assert.strictEqual(C.roundRepeat(84.1, 8, 0, 'near'), 88);
  assert.strictEqual(C.roundRepeat(84, 8, 0, 'near'), 88, '正中间取大');
  assert.strictEqual(C.roundRepeat(83.9, 8, 0, 'down'), 80);
  assert.strictEqual(C.roundRepeat(96, 4, 2, 'near'), 98, '96 在 94 与 98 正中间，取 98');
  assert.strictEqual(C.roundRepeat(95.9, 4, 2, 'near'), 94);
  assert.strictEqual(C.roundRepeat(2, 8, 0, 'down'), 8, '不会取到 0 个花样');
  assert.strictEqual(C.roundRepeat(48, 8, 0, 'up'), 48, '正好整倍数 up 不多加');
  assert.strictEqual(C.roundRepeat(0.35 / 0.1 * 8, 8, 0, 'down'), 24, '0.35/0.1 = 3.4999… 的浮点误差不能把 down 弄错');
  assert.strictEqual(C.roundRepeat(0.3 / 0.1 * 8, 8, 0, 'down'), 24, '0.3/0.1 = 2.9999… 往下仍是 3 个花样');
});

test('加减针对齐与均分', () => {
  assert.strictEqual(C.alignEnd(69.818, 44, 2), 70);
  assert.strictEqual(C.alignEnd(69, 44, 2), 70, '差 25 → 12.5 次平局，取离起针更远的 13 次');
  assert.strictEqual(C.alignEnd(19, 44, 2), 18, '减针平局也取更远：差 −25 → 12.5 次，取 13 次 → 44 − 26 = 18');
  assert.strictEqual(C.alignEnd(20.9, 44, 2), 20, '不是平局：−11.55 次 → 12 次 → 20');
});

test('均分：余数分给 a+1 行；整除时只有一段', () => {
  assert.deepStrictEqual(C.distribute(15, 126), [{ every: 8, times: 9 }, { every: 9, times: 6 }]);
  assert.deepStrictEqual(C.distribute(13, 117), [{ every: 9, times: 13 }]);
  assert.deepStrictEqual(C.distribute(0, 50), []);
  assert.deepStrictEqual(C.distribute(5, 5), [{ every: 1, times: 5 }]);
  for (let n = 1; n <= 30; n++) for (let R = n; R <= 60; R++) {
    const d = C.distribute(n, R);
    assert.strictEqual(d.reduce((a, x) => a + x.times, 0), n);
    assert.strictEqual(d.reduce((a, x) => a + x.times * x.every, 0), R);
    assert.ok(d.length <= 2 && (d.length < 2 || d[1].every - d[0].every === 1));
  }
});

test('穷举：样片 12–30 针 × 10–14 cm，每片都满足倍数、对齐与行数守恒', () => {
  let n = 0;
  for (let sw = 12; sw <= 30; sw++) for (let w = 10; w <= 14; w += 0.5) {
    const o = D((s) => { s.swS = String(sw); s.swW = String(w); });
    if (!o.ok) { assert.ok(codes(o).every((c) => c === 'steep' || c === 'endZero'), JSON.stringify(codes(o))); continue; }
    o.pieces.forEach((p) => {
      assert.strictEqual((p.start2 - p.e) % p.k, 0);
      assert.strictEqual(Math.abs(p.end2 - p.start2) % p.per, 0);
      if (p.round === 'near') assert.ok(Math.abs(p.start2 - p.startX) <= p.k / 2 + 1e-9, '最近取整偏离不超过半个花样');
      n++;
    });
  }
  assert.ok(n > 300, '穷举覆盖 ' + n);
});

test('样片和原图解一样：所有数不变、宽高差为 0', () => {
  const o = D((s) => { s.swS = '22'; s.swW = '10'; s.swR = '30'; s.swH = '10'; });
  assert.strictEqual(o.ok, true);
  o.pieces.forEach((p) => { assert.strictEqual(p.start2, p.start); assert.strictEqual(p.end2, p.end); assert.strictEqual(p.rows2, p.rows); near(p.dW, 0, 1e-9); near(p.dH, 0, 1e-9); });
  near(o.area2, o.areaO, 1e-6);
  near(o.yarn.meter.meters, 8 * 125 * 1.1, 1e-6, '密度相同时米数法 = 原图解米数 × 多备');
});

test('单位：样片量 25 cm 数 48 针 与 12.5 cm 数 24 针等价', () => {
  const a = D(), b = D((s) => { s.swS = '48'; s.swW = '25'; });
  assert.strictEqual(JSON.stringify(a.pieces), JSON.stringify(b.pieces));
});

test('非法输入：返回 ok=false 和错误码，原文不变成 0', () => {
  let o = D((s) => { s.ps = 'abc'; });
  assert.strictEqual(o.ok, false); assert.ok(codes(o).includes('nan'));
  o = D((s) => { s.swS = '24.5'; }); assert.ok(codes(o).includes('int'));
  o = D((s) => { s.swW = '0'; }); assert.ok(codes(o).includes('range'), '零分母要报错');
  o = D((s) => { s.ps = ''; }); assert.ok(codes(o).includes('empty'));
  o = D((s) => { s.pieces[0].start = '-5'; }); assert.ok(codes(o).includes('range'));
  o = D((s) => { s.pieces[0].name = ''; }); assert.ok(codes(o).includes('noname'));
  o = D((s) => { s.pieces[0].name = '长'.repeat(41); }); assert.ok(codes(o).includes('long'));
  o = D((s) => { s.pieces = []; }); assert.ok(codes(o).includes('nopiece'));
  o = D((s) => { s.ps = '22，5'; }); assert.strictEqual(o.ok, true, '中文逗号当小数点');
  assert.ok(o.errors.length === 0);
});

test('图解自身不成立：加减针差不是每次针数的整数倍、加减次数超过行数', () => {
  let o = D((s) => { s.pieces[2].end = '81'; }); assert.ok(codes(o).includes('perMismatch'));
  o = D((s) => { s.pieces[2].rows = '10'; }); assert.ok(codes(o).includes('steepOrig'));
});

test('换算后排不下：加减次数比新行数多', () => {
  const o = D((s) => { s.swR = '5'; s.swH = '20'; }); /* 2.5 行/10 cm：袖子 126 行 → 11 行，要加 13 次 */
  assert.strictEqual(o.ok, false); assert.ok(codes(o).includes('steep'));
});

test('片数全 0：报没有要织的', () => {
  const o = D((s) => s.pieces.forEach((p) => { p.n = '0'; }));
  assert.strictEqual(o.ok, false); assert.deepStrictEqual(codes(o), ['allzero']);
});

test('毛线：两种算法都没得算 → 报错；选了的算法缺输入 → 报错', () => {
  let o = D((s) => { s.wg = ''; s.pBalls = ''; }); assert.deepStrictEqual(codes(o), ['noyarn']);
  o = D((s) => { s.wg = ''; s.method = 'weight'; }); assert.deepStrictEqual(codes(o), ['needWeight']);
  o = D((s) => { s.pBalls = ''; s.method = 'meter'; }); assert.deepStrictEqual(codes(o), ['needMeter']);
  o = D((s) => { s.pBalls = ''; s.method = 'max'; }); assert.deepStrictEqual(codes(o), ['needBoth']);
  o = D((s) => { s.wg = ''; }); assert.strictEqual(o.ok, true); assert.strictEqual(o.yarn.used, 'meter', '自动：没称重就用米数');
});

test('毛线进位：9.998 团进 10；正好整团不多进', () => {
  const o = D(); near(o.yarn.weight.grams / 50, 9.998258, 1e-6); assert.strictEqual(o.yarn.weight.balls, 10);
  const area2 = o.area2;
  /* 构造正好 10 团：wg 使 grams = 500 */
  const wg = 500 / 1.1 / area2 * 225;
  const o2 = D((s) => { s.wg = String(wg); });
  near(o2.yarn.weight.grams, 500, 1e-6); assert.strictEqual(o2.yarn.weight.balls, 10, '正好 500 g 是 10 团，不是 11');
  const o3 = D((s) => { s.yHave = '20'; }); assert.strictEqual(o3.yarn.buy, 0); assert.strictEqual(o3.yarn.cost, 0, '已有够了不倒找钱');
  const o4 = D((s) => { s.spare = '0'; }); near(o4.yarn.weight.grams, 499.912920 / 1.1, 1e-5);
});

test('建议：按它改输入重算，说的数字成立', () => {
  const o = D();
  o.actions.forEach((a) => {
    const s2 = C.applyAction(C.defaultState(), a), o2 = C.compute(s2);
    assert.strictEqual(o2.ok, true, a.key);
    if (a.kind === 'roundUp') { const p = o2.pieces[a.piece]; assert.strictEqual(p.start2, a.to); near(p.dW, a.dW, 1e-12); assert.strictEqual(p.round, 'up'); }
    if (a.kind === 'maxMethod') { assert.strictEqual(o2.yarn.balls, a.balls); assert.strictEqual(o2.yarn.buy, a.buy); assert.strictEqual(o2.yarn.cost, a.cost); }
    assert.ok(!o2.actions.some((b) => b.key === a.key), '执行后同一条建议不再出现：' + a.key);
  });
  assert.deepStrictEqual(o.actions.map((a) => a.key), ['roundUp3', 'maxMethod']);
});

test('建议不出现：都在容差内 / 两种算法一样多', () => {
  const o = D((s) => { s.tol = '3'; s.pBalls = ''; });
  assert.strictEqual(o.ok, true); assert.deepStrictEqual(o.actions, []);
});

test('预设都能算、presetKey 能认出来、改一处就不再是预设', () => {
  C.PRESETS.forEach((p) => {
    const st = C.stateFromPreset(p.key), o = C.compute(st);
    assert.strictEqual(o.ok, true, p.key); assert.strictEqual(C.presetKey(st), p.key);
  });
  assert.strictEqual(C.presetKey(S((s) => { s.ps = '23'; })), null);
});

test('帽顶减针：减针方向、对齐到 8 针、均分', () => {
  const o = C.compute(C.stateFromPreset('hat'));
  const p = o.pieces[2];
  assert.strictEqual(p.inc, false); assert.strictEqual(p.end2, 8); assert.strictEqual((p.start2 - p.end2) % 8, 0);
  assert.strictEqual(p.text2.indexOf('减') > 0, true);
});

test('导出：CSV / MD 只用同一次 out；失败时导出错误清单', () => {
  const o = D();
  const csv = C.toCSV(o, 'X'), md = C.toMD(o, 'X');
  assert.ok(csv.indexOf('领口麻花（圈织）,1,96,80,96,80,14,13') >= 0, csv);
  assert.ok(csv.indexOf('还要买,,144 元,8') >= 0);
  assert.ok(md.indexOf('| 袖子（往上加针） | 2 | 50 → 44 | 80 → 70 | 126 → 117 | 每 9 行加 2 针 × 13 次 | +0.19 |') >= 0, md);
  const bad = D((s) => { s.ps = 'x'; });
  assert.ok(C.toCSV(bad, 'X').indexOf('还算不出来') > 0 && C.toMD(bad, 'X').indexOf('还算不出来') > 0);
  const q = D((s) => { s.pieces[0].name = '带,逗号"和引号|竖线'; });
  assert.ok(C.toCSV(q, 'X').indexOf('"带,逗号""和引号|竖线"') >= 0);
  assert.ok(C.toMD(q, 'X').indexOf('带,逗号"和引号\\|竖线') >= 0);
});

test('同样输入同样输出、不改传入的 state', () => {
  const s = C.defaultState(), t = JSON.stringify(s);
  const a = JSON.stringify(C.compute(s)), b = JSON.stringify(C.compute(s));
  assert.strictEqual(a, b); assert.strictEqual(JSON.stringify(s), t);
});

test('人工注入错误：每个注入都必须让锚点变红', () => {
  const MUT = [
    ['针数比写反', 'var rs = myS / v.ps', 'var rs = v.ps / myS'],
    ['行数比用针数比', 'rr = myR / v.pr;', 'rr = myS / v.ps;'],
    ['密度少乘 10', 'v.swS / v.swW * 10 : NaN', 'v.swS / v.swW : NaN'],
    ['平局取小', "m = (q - f) < (c - q) - EPS ? f : c;", "m = (q - f) <= (c - q) + EPS ? f : c;"],
    ['忘了倍数外加针', 'var q = (x - e) / k, m;', 'var q = x / k, m;'],
    ['行数向下取整', 'r2 = Math.max(1, Math.round(xr))', 'r2 = Math.max(1, Math.floor(xr))'],
    ['结束针不对齐起针', 'e2 = dO === 0 ? s2 : alignEnd(xe, s2, p.per)', 'e2 = dO === 0 ? s2 : Math.round(xe)'],
    ['均分余数给错段', 'if (n - rem > 0) out.push({ every: a, times: n - rem });\n    if (rem > 0) out.push({ every: a + 1, times: rem });', 'if (rem > 0) out.push({ every: a, times: rem });\n    if (n - rem > 0) out.push({ every: a + 1, times: n - rem });'],
    ['面积忘了乘片数', 'o.area2 = (o.w2 + o.wE2) / 2 * o.h2 * p.n;', 'o.area2 = (o.w2 + o.wE2) / 2 * o.h2;'],
    ['面积只用起针宽', 'o.area2 = (o.w2 + o.wE2) / 2 * o.h2 * p.n;', 'o.area2 = o.w2 * o.h2 * p.n;'],
    ['称重漏多备', 'var g = area2 * gpc * (1 + spare);', 'var g = area2 * gpc;'],
    ['称重团数进位 EPS 改 +1e-6', 'balls: Math.ceil(g / v.yG - EPS)', 'balls: Math.ceil(g / v.yG + 1e-6)'],
    ['称重团数四舍五入', 'balls: Math.ceil(g / v.yG - EPS)', 'balls: Math.round(g / v.yG)'],
    ['米数团数进位 EPS 改 +1e-6', 'balls: Math.ceil(m / v.yM - EPS)', 'balls: Math.ceil(m / v.yM + 1e-6)'],
    ['米数团数四舍五入', 'balls: Math.ceil(m / v.yM - EPS)', 'balls: Math.round(m / v.yM)'],
    ['米数法用改后面积当分母', 'mpc = pmTotal / areaO;', 'mpc = pmTotal / area2;'],
    ['忘扣已有', 'var buy = Math.max(0, balls - v.yHave);', 'var buy = balls;'],
    ['宽差符号反', 'o.dW = o.w2 - o.wO;', 'o.dW = o.wO - o.w2;'],
    ['往上取整当成往下', "if (mode === 'up') m = Math.ceil(q - EPS);", "if (mode === 'up') m = Math.floor(q + EPS);"],
    ['按多的买用了少的', 'Math.max(y.weight.balls, y.meter.balls);\n      if (o3.ok', 'Math.min(y.weight.balls, y.meter.balls);\n      if (o3.ok']
  ];
  const survivors = [];
  MUT.forEach(([name, from, to]) => {
    let src = SRC;
    assert.ok(src.indexOf(from) >= 0, '注入点不存在：' + name);
    src = src.replace(from, to);
    let A;
    try { A = loadFromSource(src); } catch (e) { survivors.push(name + '（注入后加载失败，不能算抓到）'); return; }
    let red;
    try { red = anchors(A).some((x) => !x[1]); } catch (e) { red = true; }
    if (!red) survivors.push(name);
  });
  assert.deepStrictEqual(survivors, [], '这些注入错误没被锚点抓到');
});

test('某一片填错时仍带回密度（页面显示用），样片本身填错时不带', () => {
  const o = D((s) => { s.pieces[2].end = '81'; });
  assert.strictEqual(o.ok, false); near(o.gauge.myS, 19.2); near(o.gauge.rs, 0.872727, 1e-6);
  assert.strictEqual(D((s) => { s.swW = '0'; }).gauge, undefined);
});
