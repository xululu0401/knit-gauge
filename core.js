/* 十厘米里几针 · 核心（core.js）
 * 纯函数，不碰 DOM、不读时间、不用随机：同样的输入永远给同样的输出。
 *
 * 一条链：
 *   原图解密度（10 cm 多少针、多少行）+ 我的样片（数了几针量得几 cm、几行量得几 cm）
 *   → 针数比 rs = 我的针/10cm ÷ 原图解针/10cm，行数比 rr 同理
 *   → 每一片：起针 × rs 按花样倍数（k 的倍数 + e）取整；结束针 × rs 按「每次加减几针」对齐；行数 × rr 取整
 *   → 加减针次数 = |结束 − 起针| ÷ 每次针数，在新行数里尽量均分（a 行一次 × 若干 + a+1 行一次 × 若干）
 *   → 改完的宽/高与原尺寸差几 cm
 *   → 毛线：称重法（样片克/cm² × 面积）与米数法（原图解米数 × 面积比，粗估）→ 几团、还要买几团、多少钱
 *   → 两条可点的建议：某片按最近取整会窄过容差 → 改向上取整；两种毛线算法差 ≥ 1 团 → 按多的买
 *
 * 做不到的情形一律返回 ok=false 和错误清单，绝不返回 0 冒充结果。
 * 默认场景（图解、样片、毛线）都是虚构示例。本页不判断针号、不判断织物手感。
 */
(function (root) {
  'use strict';

  var EPS = 1e-9;
  var MAX_PIECES = 8, NAME_MAX = 40;

  var FIELDS = {
    ps:     { label: '原图解 10 cm 针数', unit: '针', min: 1, max: 100 },
    pr:     { label: '原图解 10 cm 行数', unit: '行', min: 1, max: 150 },
    swS:    { label: '样片数的针数', unit: '针', min: 1, max: 500, int: true },
    swW:    { label: '这些针量得的宽', unit: 'cm', min: 1, max: 100 },
    swR:    { label: '样片数的行数', unit: '行', min: 1, max: 500, int: true },
    swH:    { label: '这些行量得的高', unit: 'cm', min: 1, max: 100 },
    wg:     { label: '整块样片重量', unit: 'g', min: 0.1, max: 2000, optional: true },
    ww:     { label: '整块样片宽', unit: 'cm', min: 1, max: 200 },
    wh:     { label: '整块样片高', unit: 'cm', min: 1, max: 200 },
    pBalls: { label: '原图解用线团数', unit: '团', min: 0.1, max: 200, optional: true },
    pM:     { label: '原图解每团米数', unit: 'm', min: 1, max: 5000 },
    yM:     { label: '我的线每团米数', unit: 'm', min: 1, max: 5000 },
    yG:     { label: '我的线每团克数', unit: 'g', min: 1, max: 2000 },
    yPrice: { label: '我的线每团价格', unit: '元', min: 0, max: 100000 },
    yHave:  { label: '手里已有', unit: '团', min: 0, max: 999, int: true },
    spare:  { label: '多备', unit: '%', min: 0, max: 100 },
    tol:    { label: '可接受偏差', unit: 'cm', min: 0, max: 20 }
  };
  var SCALARS = ['ps', 'pr', 'swS', 'swW', 'swR', 'swH', 'wg', 'ww', 'wh', 'pBalls', 'pM', 'yM', 'yG', 'yPrice', 'yHave', 'spare', 'tol'];
  var PIECE_FIELDS = {
    n:     { label: '片数', min: 0, max: 99, int: true },
    start: { label: '起针', min: 1, max: 5000, int: true },
    end:   { label: '结束针数', min: 1, max: 5000, int: true },
    rows:  { label: '行数', min: 1, max: 5000, int: true },
    per:   { label: '每次加减几针', min: 1, max: 100, int: true },
    k:     { label: '花样倍数', min: 1, max: 200, int: true },
    e:     { label: '倍数外加几针', min: 0, max: 200, int: true }
  };
  var METHODS = ['auto', 'weight', 'meter', 'max'];
  var ROUNDS = ['near', 'up', 'down'];

  function Pc(name, n, start, end, rows, per, k, e) { return { name: name, n: n, start: start, end: end, rows: rows, per: per, k: k, e: e, round: 'near' }; }

  var BASE = {
    ps: '22', pr: '30', swS: '24', swW: '12.5', swR: '32', swH: '11.5',
    wg: '14', ww: '15', wh: '15',
    pBalls: '8', pM: '125', yM: '100', yG: '50', yPrice: '18', yHave: '2',
    spare: '10', tol: '0.5', method: 'auto',
    pieces: [
      Pc('前后片下摆罗纹', '2', '110', '110', '18', '2', '4', '2'),
      Pc('前后片身', '2', '110', '110', '120', '2', '1', '0'),
      Pc('袖子（往上加针）', '2', '50', '80', '126', '2', '1', '0'),
      Pc('领口麻花（圈织）', '1', '96', '96', '14', '2', '8', '0')
    ]
  };
  var PRESETS = [
    { key: 'default', name: '套头毛衣（默认）', note: '虚构示例：原图解 22 针 × 30 行 / 10 cm，样片织松了（24 针量得 12.5 cm）。', state: BASE },
    { key: 'scarf', name: '一条围巾', note: '虚构示例：一片直织，没有加减针；看换线后起针和长度怎么改。',
      state: { ps: '18', pr: '24', swS: '20', swW: '10', swR: '26', swH: '10', wg: '12', ww: '15', wh: '15', pBalls: '4', pM: '110', yM: '90', yG: '50', yPrice: '22', yHave: '0', spare: '10', tol: '0.5', method: 'auto',
        pieces: [Pc('围巾', '1', '45', '45', '420', '2', '1', '0')] } },
    { key: 'hat', name: '一顶帽子', note: '虚构示例：圈织，帽顶每 2 圈减 8 针（分 8 处各减 1），帽身与帽顶按各自取整，接缝处针数要自己对一下。',
      state: { ps: '20', pr: '28', swS: '22', swW: '10', swR: '30', swH: '10', wg: '', ww: '15', wh: '15', pBalls: '2', pM: '100', yM: '120', yG: '50', yPrice: '20', yHave: '0', spare: '10', tol: '0.5', method: 'auto',
        pieces: [Pc('帽檐罗纹', '1', '104', '104', '20', '8', '4', '0'), Pc('帽身', '1', '104', '104', '40', '8', '8', '0'), Pc('帽顶减针', '1', '104', '8', '24', '8', '8', '0')] } }
  ];

  function cloneState(s) { return JSON.parse(JSON.stringify(s)); }
  function defaultState() { return cloneState(BASE); }
  function stateFromPreset(key) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].key === key) return cloneState(PRESETS[i].state);
    return defaultState();
  }
  function presetKey(state) {
    var t = JSON.stringify(state);
    for (var i = 0; i < PRESETS.length; i++) if (JSON.stringify(PRESETS[i].state) === t) return PRESETS[i].key;
    return null;
  }

  /* ── 数字 ── */
  function fmtV(x, d) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    var t = (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
    if (t.indexOf('.') >= 0) t = t.replace(/0+$/, '').replace(/\.$/, '');
    if (t === '-0') t = '0';
    return t;
  }
  function fmtCm(x) { return fmtV(x, 1); }
  function fmtSigned(x, d) { var t = fmtV(x, d); return (x > 0 && t !== '0' ? '+' : '') + t; }
  function fmtPct(f) { return fmtV(f * 100, 1) + '%'; }

  function parseNum(raw, spec) {
    var t = String(raw == null ? '' : raw).trim().replace(/，/g, '.');
    if (t === '') return { empty: true };
    if (!/^-?\d+(\.\d+)?$/.test(t)) return { bad: 'nan' };
    var v = Number(t);
    if (!isFinite(v)) return { bad: 'nan' };
    if (spec.int && Math.abs(v - Math.round(v)) > EPS) return { bad: 'int' };
    if (v < spec.min - EPS || v > spec.max + EPS) return { bad: 'range' };
    return { v: v };
  }
  function msgFor(label, unit, spec, bad) {
    if (bad === 'nan') return label + '要填数字';
    if (bad === 'int') return label + '要填整数';
    if (bad === 'range') return label + '要在 ' + spec.min + '–' + spec.max + (unit ? ' ' + unit : '') + ' 之间';
    return label + '要填';
  }

  /* 按花样倍数取整：候选 v = k·m + e（m ≥ 1）。near 平局取大（宁宽勿窄）。 */
  function roundRepeat(x, k, e, mode) {
    var q = (x - e) / k, m;
    if (mode === 'up') m = Math.ceil(q - EPS);
    else if (mode === 'down') m = Math.floor(q + EPS);
    else { var f = Math.floor(q + EPS), c = Math.ceil(q - EPS); m = (q - f) < (c - q) - EPS ? f : c; }
    if (m < 1) m = 1;
    return k * m + e;
  }
  /* 结束针对齐：v − s 必须是 per 的倍数（每次加减 per 针）；平局取离 s 更远的（加减次数不少于原比例） */
  function alignEnd(x, s, per) {
    var q = (x - s) / per, f = Math.floor(q + EPS), c = Math.ceil(q - EPS), m;
    if (Math.abs(q - f) < Math.abs(c - q) - EPS) m = f;
    else if (Math.abs(c - q) < Math.abs(q - f) - EPS) m = c;
    else m = Math.abs(f) > Math.abs(c) ? f : c;
    return s + per * m;
  }
  /* n 次加减均分进 R 行：a = floor(R/n)，余 rem 次用 a+1 行 */
  function distribute(n, R) {
    if (!(n > 0)) return [];
    var a = Math.floor(R / n), rem = R - n * a, out = [];
    if (n - rem > 0) out.push({ every: a, times: n - rem });
    if (rem > 0) out.push({ every: a + 1, times: rem });
    return out;
  }
  function distText(d, per, inc) {
    if (!d.length) return '直织，不加减针';
    return d.map(function (x) { return '每 ' + x.every + ' 行' + (inc ? '加' : '减') + ' ' + per + ' 针 × ' + x.times + ' 次'; }).join('，再');
  }

  /* ── 主计算 ── */
  function compute(state, noActs) {
    var errors = [], warnings = [], v = {};
    state = state || {};
    SCALARS.forEach(function (k) {
      var sp = FIELDS[k], r = parseNum(state[k], sp);
      if (r.empty) { if (!sp.optional) errors.push({ field: k, code: 'empty', message: sp.label + '要填' }); else v[k] = null; }
      else if (r.bad) errors.push({ field: k, code: r.bad, message: msgFor(sp.label, sp.unit, sp, r.bad) });
      else v[k] = r.v;
    });
    var method = METHODS.indexOf(state.method) >= 0 ? state.method : 'auto';
    var pieces = Array.isArray(state.pieces) ? state.pieces : [];
    if (!pieces.length) errors.push({ field: 'pieces', code: 'nopiece', message: '至少要有一片' });
    if (pieces.length > MAX_PIECES) errors.push({ field: 'pieces', code: 'toomany', message: '最多 ' + MAX_PIECES + ' 片' });
    var pv = pieces.slice(0, MAX_PIECES).map(function (p, i) {
      p = p || {};
      var o = { idx: i, name: String(p.name == null ? '' : p.name).trim(), round: ROUNDS.indexOf(p.round) >= 0 ? p.round : 'near' };
      var label = '第 ' + (i + 1) + ' 片';
      if (!o.name) errors.push({ field: 'pieces', row: i, sub: 'name', code: 'noname', message: label + '要起个名字' });
      else if (o.name.length > NAME_MAX) errors.push({ field: 'pieces', row: i, sub: 'name', code: 'long', message: label + '名字最多 ' + NAME_MAX + ' 个字' });
      if (o.name) label = '「' + o.name.slice(0, 12) + '」';
      Object.keys(PIECE_FIELDS).forEach(function (k) {
        var sp = PIECE_FIELDS[k], r = parseNum(p[k], sp);
        if (r.empty || r.bad) errors.push({ field: 'pieces', row: i, sub: k, code: r.bad || 'empty', message: label + msgFor(sp.label, '', sp, r.bad || 'empty') });
        else o[k] = r.v;
      });
      o.label = label;
      return o;
    });
    /* 密度（样片四格与图解两格都合法时先算出来：只是某一片填错时，页面仍能显示我的密度） */
    var gaugeOk = ['ps', 'pr', 'swS', 'swW', 'swR', 'swH'].every(function (k) { return typeof v[k] === 'number'; });
    var myS = gaugeOk ? v.swS / v.swW * 10 : NaN, myR = gaugeOk ? v.swR / v.swH * 10 : NaN;
    var rs = myS / v.ps, rr = myR / v.pr;
    var partial = gaugeOk ? { ps: v.ps, pr: v.pr, myS: myS, myR: myR, rs: rs, rr: rr } : null;
    function fail(errs) { var o = { ok: false, errors: errs, warnings: [] }; if (partial) o.gauge = partial; return o; }
    if (errors.length) return fail(errors);

    if (v.swW < 10 - EPS || v.swH < 10 - EPS) warnings.push({ code: 'smallSwatch', message: '样片量的宽或高不到 10 cm，边缘针会让密度偏差变大；能量 10 cm 以上更准。' });

    var outP = [];
    pv.forEach(function (p) {
      var row = p.idx, L = p.label;
      var dO = p.end - p.start;
      if (Math.abs(dO) % p.per !== 0) { errors.push({ field: 'pieces', row: row, sub: 'end', code: 'perMismatch', message: L + '起针与结束针差 ' + Math.abs(dO) + ' 针，不是「每次 ' + p.per + ' 针」的整数倍' }); return; }
      var nO = Math.abs(dO) / p.per;
      if (nO > p.rows) { errors.push({ field: 'pieces', row: row, sub: 'rows', code: 'steepOrig', message: L + '原图解要加减 ' + nO + ' 次，比 ' + p.rows + ' 行还多' }); return; }
      if ((p.start - p.e) % p.k !== 0 || p.start < p.k + p.e) warnings.push({ code: 'origRepeat', row: row, message: L + '原起针 ' + p.start + ' 不是「' + p.k + ' 的倍数 + ' + p.e + '」，请核对花样倍数。' });
      var xs = p.start * rs, s2 = roundRepeat(xs, p.k, p.e, p.round);
      var xe = p.end * rs, e2 = dO === 0 ? s2 : alignEnd(xe, s2, p.per);
      if (e2 < 1) { errors.push({ field: 'pieces', row: row, sub: 'end', code: 'endZero', message: L + '换算后结束针不到 1 针' }); return; }
      var xr = p.rows * rr, r2 = Math.max(1, Math.round(xr));
      var n2 = Math.abs(e2 - s2) / p.per;
      if (n2 > r2) { errors.push({ field: 'pieces', row: row, sub: 'rows', code: 'steep', message: L + '换算后要加减 ' + n2 + ' 次，只有 ' + r2 + ' 行，排不下（每行最多一次）' }); return; }
      if (dO !== 0 && n2 === 0) warnings.push({ code: 'lostShaping', row: row, message: L + '换算后起针和结束针一样了，原来的加减针被取整吃掉了。' });
      var inc = dO > 0;
      var o = {
        idx: row, name: p.name, n: p.n, round: p.round, per: p.per, k: p.k, e: p.e, inc: inc,
        start: p.start, end: p.end, rows: p.rows,
        startX: xs, endX: xe, rowsX: xr,
        start2: s2, end2: e2, rows2: r2,
        wO: p.start / v.ps * 10, wEO: p.end / v.ps * 10, hO: p.rows / v.pr * 10,
        w2: s2 / myS * 10, wE2: e2 / myS * 10, h2: r2 / myR * 10,
        nO: nO, n2: n2, distO: distribute(nO, p.rows), dist2: distribute(n2, r2)
      };
      o.dW = o.w2 - o.wO; o.dWE = o.wE2 - o.wEO; o.dH = o.h2 - o.hO;
      o.areaO = (o.wO + o.wEO) / 2 * o.hO * p.n;
      o.area2 = (o.w2 + o.wE2) / 2 * o.h2 * p.n;
      o.textO = distText(o.distO, p.per, inc);
      o.text2 = distText(o.dist2, p.per, inc);
      if (o.dW < -v.tol - EPS) o.flag = 'narrow';
      else if (o.dW > v.tol + EPS) o.flag = 'wide';
      else o.flag = 'ok';
      outP.push(o);
    });
    if (errors.length) return fail(errors);
    var counted = outP.filter(function (p) { return p.n > 0; });
    if (!counted.length) return fail([{ field: 'pieces', code: 'allzero', message: '每片的片数都是 0，没有要织的' }]);

    var areaO = 0, area2 = 0;
    outP.forEach(function (p) { areaO += p.areaO; area2 += p.area2; });

    /* 毛线 */
    var spare = v.spare / 100;
    var yarn = { spare: spare, weight: null, meter: null };
    if (v.wg != null) {
      var gpc = v.wg / (v.ww * v.wh);
      var g = area2 * gpc * (1 + spare);
      yarn.weight = { gPerCm2: gpc, grams: g, balls: Math.ceil(g / v.yG - EPS), meters: g / v.yG * v.yM };
    }
    if (v.pBalls != null) {
      var pmTotal = v.pBalls * v.pM, mpc = pmTotal / areaO;
      var m = area2 * mpc * (1 + spare);
      yarn.meter = { patternMeters: pmTotal, mPerCm2: mpc, meters: m, balls: Math.ceil(m / v.yM - EPS) };
    }
    if (!yarn.weight && !yarn.meter) {
      return fail([{ field: 'wg', code: 'noyarn', message: '毛线没法算：整块样片重量和原图解用线团数至少填一个' }]);
    }
    var used = method;
    if (method === 'auto') used = yarn.weight ? 'weight' : 'meter';
    if (used === 'weight' && !yarn.weight) return fail([{ field: 'wg', code: 'needWeight', message: '选了「按样片称重」，但整块样片重量没填' }]);
    if (used === 'meter' && !yarn.meter) return fail([{ field: 'pBalls', code: 'needMeter', message: '选了「按原图解米数」，但原图解用线团数没填' }]);
    if (used === 'max' && !(yarn.weight && yarn.meter)) return fail([{ field: 'method', code: 'needBoth', message: '「取两者较多」要两种算法都能算：样片重量和原图解团数都要填' }]);
    var balls = used === 'weight' ? yarn.weight.balls : used === 'meter' ? yarn.meter.balls : Math.max(yarn.weight.balls, yarn.meter.balls);
    var buy = Math.max(0, balls - v.yHave);
    yarn.method = method; yarn.used = used; yarn.balls = balls; yarn.have = v.yHave; yarn.buy = buy;
    yarn.cost = buy * v.yPrice; yarn.price = v.yPrice; yarn.ballM = v.yM; yarn.ballG = v.yG;
    if (Math.abs(rs - 1) > 0.1 && yarn.meter && used !== 'weight') warnings.push({ code: 'meterRough', message: '针数密度差了 ' + fmtPct(Math.abs(rs - 1)) + '，米数法假设每平方厘米用线一样长，偏差会变大；称一下样片更准。' });

    var out = {
      ok: true, errors: [], warnings: warnings,
      gauge: { ps: v.ps, pr: v.pr, myS: myS, myR: myR, rs: rs, rr: rr, tol: v.tol },
      pieces: outP, pieceCount: counted.reduce(function (a, p) { return a + p.n; }, 0),
      areaO: areaO, area2: area2, yarn: yarn, actions: []
    };
    out.narrowCount = outP.filter(function (p) { return p.flag === 'narrow'; }).length;
    out.maxDev = outP.reduce(function (m, p) { return Math.abs(p.dW) > Math.abs(m) ? p.dW : m; }, 0);
    if (!noActs) out.actions = makeActions(state, out);
    return out;
  }

  /* ── 建议：每条都按它改输入重算一遍，确认它说的数字成立才给 ── */
  function makeActions(state, out) {
    var acts = [];
    out.pieces.forEach(function (p) {
      if (p.flag !== 'narrow' || p.round !== 'near') return;
      var s2 = cloneState(state); s2.pieces[p.idx].round = 'up';
      var o2 = compute(s2, true);
      if (!o2.ok) return;
      var q = o2.pieces.filter(function (x) { return x.idx === p.idx; })[0];
      if (!q || !(q.start2 > p.start2) || !(q.dW >= p.dW)) return;
      acts.push({ key: 'roundUp' + p.idx, kind: 'roundUp', set: { piece: p.idx, round: 'up' }, piece: p.idx, from: p.start2, to: q.start2, dW: q.dW,
        text: '「' + p.name + '」按最近取整 ' + p.start2 + ' 针会窄 ' + fmtCm(-p.dW) + ' cm；改成往上取 ' + q.start2 + ' 针，宽 ' + fmtSigned(q.dW, 1) + ' cm' });
    });
    var y = out.yarn;
    if (y.weight && y.meter && y.used !== 'max' && Math.abs(y.weight.balls - y.meter.balls) >= 1) {
      var s3 = cloneState(state); s3.method = 'max';
      var o3 = compute(s3, true);
      var hi = Math.max(y.weight.balls, y.meter.balls);
      if (o3.ok && o3.yarn.balls === hi && hi > y.balls) {
        acts.push({ key: 'maxMethod', kind: 'maxMethod', set: { method: 'max' }, balls: hi, buy: o3.yarn.buy, cost: o3.yarn.cost,
          text: '称重法 ' + y.weight.balls + ' 团、米数法 ' + y.meter.balls + ' 团，差 ' + Math.abs(y.weight.balls - y.meter.balls) + ' 团；怕断线就按多的买：' + hi + ' 团（还要买 ' + o3.yarn.buy + ' 团，' + fmtV(o3.yarn.cost, 2) + ' 元）' });
      }
    }
    return acts;
  }
  function applyAction(state, a) {
    var s = cloneState(state);
    if (!a || !a.set) return s;
    if (a.set.method) s.method = a.set.method;
    if (a.set.piece != null && s.pieces[a.set.piece]) s.pieces[a.set.piece].round = a.set.round;
    return s;
  }

  /* ── 导出 ── */
  var METHOD_NAME = { weight: '按样片称重', meter: '按原图解米数（粗估）', max: '取两者较多', auto: '自动' };
  function csvCell(x) { var t = String(x == null ? '' : x); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }
  function toCSV(out, stamp) {
    var R = [['十厘米里几针', '导出时间 ' + stamp]];
    if (!out.ok) { R.push(['还算不出来']); out.errors.forEach(function (e) { R.push([e.message]); }); return R.map(function (r) { return r.map(csvCell).join(','); }).join('\n') + '\n'; }
    var g = out.gauge;
    R.push([]); R.push(['密度', '10 cm 针数', '10 cm 行数']);
    R.push(['原图解', fmtV(g.ps, 2), fmtV(g.pr, 2)]); R.push(['我的样片', fmtV(g.myS, 2), fmtV(g.myR, 2)]);
    R.push([]); R.push(['片', '片数', '原起针', '我的起针', '原结束针', '我的结束针', '原行数', '我的行数', '原加减针', '我的加减针', '宽差 cm', '高差 cm']);
    out.pieces.forEach(function (p) { R.push([p.name, p.n, p.start, p.start2, p.end, p.end2, p.rows, p.rows2, p.textO, p.text2, fmtSigned(p.dW, 2), fmtSigned(p.dH, 2)]); });
    var y = out.yarn;
    R.push([]); R.push(['毛线', '算法', '需要', '团数']);
    if (y.weight) R.push(['', '按样片称重', fmtV(y.weight.grams, 1) + ' g', y.weight.balls]);
    if (y.meter) R.push(['', '按原图解米数（粗估）', fmtV(y.meter.meters, 1) + ' m', y.meter.balls]);
    R.push(['采用', METHOD_NAME[y.used], '多备 ' + fmtPct(y.spare), y.balls]);
    R.push(['已有', '', '', y.have]); R.push(['还要买', '', fmtV(y.cost, 2) + ' 元', y.buy]);
    if (out.actions.length) { R.push([]); out.actions.forEach(function (a) { R.push(['建议', a.text]); }); }
    R.push([]); R.push(['说明', '按样片密度等比换算；加减针在行数里均分；默认场景为虚构示例']);
    return R.map(function (r) { return r.map(csvCell).join(','); }).join('\n') + '\n';
  }
  function mdEsc(t) { return String(t).replace(/\|/g, '\\|'); }
  function toMD(out, stamp) {
    var L = ['# 十厘米里几针', '', '导出时间 ' + stamp, ''];
    if (!out.ok) { L.push('还算不出来：', ''); out.errors.forEach(function (e) { L.push('- ' + e.message); }); return L.join('\n') + '\n'; }
    var g = out.gauge, y = out.yarn;
    L.push('原图解 ' + fmtV(g.ps, 2) + ' 针 × ' + fmtV(g.pr, 2) + ' 行 / 10 cm，我的样片 ' + fmtV(g.myS, 2) + ' 针 × ' + fmtV(g.myR, 2) + ' 行 / 10 cm。', '');
    L.push('## 改好的图解', '', '| 片 | 片数 | 起针 | 结束针 | 行数 | 加减针 | 宽差 cm |', '|---|---|---|---|---|---|---|');
    out.pieces.forEach(function (p) { L.push('| ' + mdEsc(p.name) + ' | ' + p.n + ' | ' + p.start + ' → ' + p.start2 + ' | ' + p.end + ' → ' + p.end2 + ' | ' + p.rows + ' → ' + p.rows2 + ' | ' + p.text2 + ' | ' + fmtSigned(p.dW, 2) + ' |'); });
    L.push('', '## 毛线', '');
    if (y.weight) L.push('- 按样片称重：' + fmtV(y.weight.grams, 1) + ' g → ' + y.weight.balls + ' 团');
    if (y.meter) L.push('- 按原图解米数（粗估）：' + fmtV(y.meter.meters, 1) + ' m → ' + y.meter.balls + ' 团');
    L.push('- 采用' + METHOD_NAME[y.used] + '：' + y.balls + ' 团（多备 ' + fmtPct(y.spare) + '），已有 ' + y.have + ' 团，还要买 ' + y.buy + ' 团，' + fmtV(y.cost, 2) + ' 元');
    if (out.actions.length) { L.push('', '## 建议', ''); out.actions.forEach(function (a) { L.push('- ' + a.text); }); }
    if (out.warnings.length) { L.push('', '## 提示', ''); out.warnings.forEach(function (w) { L.push('- ' + w.message); }); }
    L.push('', '> 按样片密度等比换算，加减针在行数里均分（不区分正反面行）。默认场景为虚构示例。');
    return L.join('\n') + '\n';
  }

  var API = {
    MAX_PIECES: MAX_PIECES, NAME_MAX: NAME_MAX, FIELDS: FIELDS, PIECE_FIELDS: PIECE_FIELDS, SCALARS: SCALARS, METHODS: METHODS, METHOD_NAME: METHOD_NAME,
    PRESETS: PRESETS, defaultState: defaultState, stateFromPreset: stateFromPreset, presetKey: presetKey, cloneState: cloneState,
    compute: compute, applyAction: applyAction, roundRepeat: roundRepeat, alignEnd: alignEnd, distribute: distribute,
    fmtV: fmtV, fmtCm: fmtCm, fmtSigned: fmtSigned, fmtPct: fmtPct, toCSV: toCSV, toMD: toMD
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  root.AppCore = API;
})(typeof window !== 'undefined' ? window : this);
