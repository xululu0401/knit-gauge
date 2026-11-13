/* 十厘米里几针 · 界面（ui.js）
 * 把输入读成 state → 交给 AppCore.compute → 把同一次输出画出来。页面不自己算数。 */
(function () {
  'use strict';
  var A = window.AppCore;
  var KEY = 'knit-gauge:v1';
  var $ = function (id) { return document.getElementById(id); };
  var PF = ['n', 'start', 'end', 'rows', 'per', 'k', 'e'];
  var PL = { n: '片数', start: '起针', end: '结束针数', rows: '行数', per: '每次加减', k: '花样倍数', e: '倍数外加' };
  var RN = { near: '最近', up: '往上取（宁宽）', down: '往下取（宁窄）' };
  var saved = load();
  var state = saved || A.defaultState();
  var out = null;

  function str(v) { return String(v == null ? '' : v); }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState();
    A.SCALARS.forEach(function (k) { if (s[k] != null) d[k] = str(s[k]); });
    if (A.METHODS.indexOf(s.method) >= 0) d.method = s.method;
    if (Array.isArray(s.pieces) && s.pieces.length) {
      d.pieces = s.pieces.slice(0, A.MAX_PIECES).map(function (p) {
        p = p || {};
        var o = { name: str(p.name) };
        PF.forEach(function (k) { o[k] = str(p[k]); });
        o.round = ['near', 'up', 'down'].indexOf(p.round) >= 0 ? p.round : 'near';
        return o;
      });
    }
    return d;
  }
  function load() {
    try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return sanitize(j && j.state); } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ state: state })); $('saveTag').textContent = '· 已存到本机'; }
    catch (e) { $('saveTag').textContent = '· 没能存到本机'; }
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ── 预设 ── */
  function renderPresets() {
    var k = A.presetKey(state);
    $('presets').innerHTML = A.PRESETS.map(function (p) {
      return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (k === p.key) + '">' + esc(p.name) + '</button>';
    }).join('');
    var cur = A.PRESETS.filter(function (p) { return p.key === k; })[0];
    $('presetNote').textContent = cur ? cur.note : '已按你的输入计算（不是预设）。';
  }
  $('presets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-p]'); if (!b) return;
    state = A.stateFromPreset(b.getAttribute('data-p')); fillAll(); update();
  });

  /* ── 每一片 ── */
  function renderPieces() {
    $('pieces').innerHTML = state.pieces.map(function (p, i) {
      return '<div class="pc" id="pc' + i + '">' +
        '<div class="pchead">' +
          '<div class="f" id="f_q' + i + '_name"><label for="q' + i + '_name">第 ' + (i + 1) + ' 片 <span id="flag' + i + '"></span></label><input id="q' + i + '_name" data-i="' + i + '" data-sub="name" value="' + esc(p.name) + '"></div>' +
          '<div class="f" id="f_q' + i + '_n"><label for="q' + i + '_n">片数</label><input id="q' + i + '_n" data-i="' + i + '" data-sub="n" inputmode="numeric" value="' + esc(p.n) + '"></div>' +
          '<button type="button" class="btn ghost mini" data-del="' + i + '"' + (state.pieces.length <= 1 ? ' disabled' : '') + ' aria-label="删掉第 ' + (i + 1) + ' 片">删</button>' +
        '</div>' +
        '<div class="pcin">' + PF.filter(function (k) { return k !== 'n'; }).map(function (k) {
          return '<div class="f" id="f_q' + i + '_' + k + '"><label for="q' + i + '_' + k + '">原' + PL[k] + '</label><input id="q' + i + '_' + k + '" data-i="' + i + '" data-sub="' + k + '" inputmode="numeric" value="' + esc(p[k]) + '"></div>';
        }).join('') + '</div>' +
        '<div class="rounds" role="group" aria-label="起针取整方式">起针取整：' + ['near', 'up', 'down'].map(function (r) {
          return '<button type="button" id="rd' + i + '_' + r + '" data-rd="' + r + '" data-i="' + i + '" aria-pressed="' + (p.round === r) + '">' + RN[r] + '</button>';
        }).join('') + '</div>' +
        '<div id="cmp' + i + '"></div><div class="rowmsg" id="qmsg' + i + '"></div></div>';
    }).join('');
    $('addPc').disabled = state.pieces.length >= A.MAX_PIECES;
  }
  $('pieces').addEventListener('input', function (e) {
    var el = e.target; if (!el.hasAttribute('data-sub')) return;
    state.pieces[+el.getAttribute('data-i')][el.getAttribute('data-sub')] = el.value; update();
  });
  $('pieces').addEventListener('click', function (e) {
    var r = e.target.closest('[data-rd]');
    if (r) { var i = +r.getAttribute('data-i'); state.pieces[i].round = r.getAttribute('data-rd'); renderPieces(); update(); return; }
    var b = e.target.closest('[data-del]'); if (!b || b.disabled) return;
    state.pieces.splice(+b.getAttribute('data-del'), 1); renderPieces(); update();
  });
  $('addPc').addEventListener('click', function () {
    if (state.pieces.length >= A.MAX_PIECES) return;
    state.pieces.push({ name: '新的一片', n: '1', start: '60', end: '60', rows: '40', per: '2', k: '1', e: '0', round: 'near' });
    renderPieces(); update();
  });

  A.SCALARS.forEach(function (k) { $(k).addEventListener('input', function () { state[k] = $(k).value; update(); }); });
  $('method').addEventListener('change', function () { state.method = $('method').value; update(); });
  function fillAll() {
    A.SCALARS.forEach(function (k) { $(k).value = state[k]; });
    $('method').value = state.method || 'auto';
    renderPieces();
  }

  /* ── 10 cm 尺子：一格一针，按真实针数画（多于 60 针只画 60 并标注） ── */
  function ruler(n) {
    var W = 300, cnt = Math.min(60, Math.floor(n + 1e-9)), step = W / n, s = '';
    s += '<line x1="0" y1="56" x2="300" y2="56" stroke="#8a8490" stroke-width="1.5"/>';
    for (var i = 0; i <= 10; i++) s += '<line x1="' + (i * 30).toFixed(1) + '" y1="' + (i % 5 ? 50 : 44) + '" x2="' + (i * 30).toFixed(1) + '" y2="56" stroke="#8a8490" stroke-width="1"/>';
    for (var j = 0; j < cnt; j++) {
      var x = j * step + step / 2, w = step * 0.42;
      s += '<path d="M' + (x - w).toFixed(1) + ' 8 L' + x.toFixed(1) + ' 36 L' + (x + w).toFixed(1) + ' 8" fill="none" stroke="currentColor" stroke-width="' + Math.max(1, Math.min(3, step / 4)).toFixed(1) + '" stroke-linecap="round"/>';
    }
    return s;
  }

  /* ── 渲染 ── */
  function markErrors() {
    document.querySelectorAll('.f.bad').forEach(function (f) { f.classList.remove('bad'); });
    document.querySelectorAll('.rowmsg').forEach(function (m) { m.textContent = ''; });
    (out.errors || []).forEach(function (e) {
      if (e.field === 'pieces' && e.row != null) {
        var f = $('f_q' + e.row + '_' + (e.sub || 'name')); if (f) f.classList.add('bad');
        var mm = $('qmsg' + e.row); if (mm) mm.textContent = (mm.textContent ? mm.textContent + ' ' : '') + e.message;
      } else if ($('f_' + e.field)) $('f_' + e.field).classList.add('bad');
    });
  }
  function cmpTable(p) {
    function row(h, o, n, tx) { return '<tr><th>' + h + '</th><td class="o">' + esc(o) + '</td><td class="arrow">→</td><td class="n' + (tx ? ' tx' : '') + '">' + esc(n) + '</td></tr>'; }
    return '<table class="cmp">' +
      row('起针', p.start + ' 针', p.start2 + ' 针') +
      (p.end !== p.start ? row('结束针', p.end + ' 针', p.end2 + ' 针') : '') +
      row('行数', p.rows + ' 行', p.rows2 + ' 行') +
      (p.end !== p.start ? row(p.inc ? '加针' : '减针', p.textO, p.text2, true) : '') +
      row('织出来宽', A.fmtCm(p.wO) + ' cm', A.fmtCm(p.w2) + ' cm（' + A.fmtSigned(p.dW, 1) + '）') +
      row('织出来高', A.fmtCm(p.hO) + ' cm', A.fmtCm(p.h2) + ' cm（' + A.fmtSigned(p.dH, 1) + '）') +
      '</table>';
  }
  function render() {
    var bad = !out.ok;
    $('errBox').classList.toggle('hide', !bad);
    $('okHead').classList.toggle('hide', bad);
    state.pieces.forEach(function (p, i) { $('cmp' + i).innerHTML = ''; $('flag' + i).innerHTML = ''; $('pc' + i).className = 'pc'; });
    $('yarnOut').innerHTML = ''; $('warnBox').classList.add('hide'); $('actsBlock').classList.add('hide');
    var ps = Number(state.ps), sw = Number(state.swS) / Number(state.swW) * 10;
    $('dOld').textContent = isFinite(ps) && ps > 0 ? A.fmtV(ps, 2) + ' 针 × ' + A.fmtV(Number(state.pr), 2) + ' 行' : '—';
    $('rOld').innerHTML = isFinite(ps) && ps > 0 && ps <= 100 ? ruler(ps) : '';
    $('rOld').style.color = '#6f7d8c'; $('rNew').style.color = '#8c3b5a';
    if (bad) {
      var pg = out.gauge;
      $('dNew').textContent = pg ? A.fmtV(pg.myS, 2) + ' 针 × ' + A.fmtV(pg.myR, 2) + ' 行' : '—';
      $('rNew').innerHTML = pg && pg.myS <= 100 ? ruler(pg.myS) : '';
      $('ratio').innerHTML = pg ? '针数 × <b>' + A.fmtV(pg.rs, 4) + '</b>，行数 × <b>' + A.fmtV(pg.rr, 4) + '</b>（先把下面标红的改对，才能改图解）。' : '';
      $('errBox').innerHTML = '<b>还算不出来</b>，先把这些改对（原文都保留着）：<ul>' + out.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>';
      return;
    }
    var g = out.gauge, y = out.yarn;
    $('dNew').textContent = A.fmtV(g.myS, 2) + ' 针 × ' + A.fmtV(g.myR, 2) + ' 行';
    $('rNew').innerHTML = g.myS <= 100 ? ruler(g.myS) : '';
    var looser = g.rs < 1;
    $('ratio').innerHTML = '你的 10 cm 比图解' + (Math.abs(g.rs - 1) < 1e-9 ? '一样多针' : (looser ? '<b>少 ' + A.fmtV(g.ps - g.myS, 2) + ' 针</b>（织松了）' : '<b>多 ' + A.fmtV(g.myS - g.ps, 2) + ' 针</b>（织紧了）')) +
      '：针数 × <b>' + A.fmtV(g.rs, 4) + '</b>，行数 × <b>' + A.fmtV(g.rr, 4) + '</b>。';
    $('sRatio').textContent = '× ' + A.fmtV(g.rs, 3);
    $('sRatioTx').textContent = '针数要乘的比例（行数 × ' + A.fmtV(g.rr, 3) + '）';
    $('sDev').textContent = (out.narrowCount ? out.narrowCount + ' 片窄了' : '都在 ±' + A.fmtV(g.tol, 2) + ' cm 内');
    $('sDevTx').textContent = '按花样倍数取整后，宽差最大 ' + A.fmtSigned(out.maxDev, 1) + ' cm';
    $('sBuy').textContent = y.buy + ' 团';
    $('sBuyTx').textContent = '还要买（共 ' + y.balls + ' 团，已有 ' + y.have + '），' + A.fmtV(y.cost, 2) + ' 元';
    var worst = out.pieces.filter(function (p) { return p.flag === 'narrow'; })[0];
    $('lead').innerHTML = worst
      ? '最要留意的是<b>' + esc(worst.name) + '</b>：' + worst.start + ' 针按 ' + worst.k + ' 针一组取到 ' + worst.start2 + ' 针，会窄 ' + esc(A.fmtCm(-worst.dW)) + ' cm。'
      : '每一片按花样倍数取整后，宽都在你能接受的偏差内。';
    if (out.actions.length) $('lead').innerHTML += ' 下面有 ' + out.actions.length + ' 条可以直接点的调整。';
    out.pieces.forEach(function (p) {
      $('cmp' + p.idx).innerHTML = cmpTable(p);
      $('pc' + p.idx).className = 'pc ' + p.flag;
      $('flag' + p.idx).innerHTML = '<span class="flag ' + p.flag + '">' + ({ ok: '宽合适', narrow: '窄了', wide: '宽了' })[p.flag] + '</span>';
    });
    var rows = [];
    if (y.weight) rows.push(['按样片称重', A.fmtV(y.weight.grams, 1) + ' g', y.weight.balls + ' 团', y.used === 'weight' || (y.used === 'max' && y.weight.balls >= (y.meter ? y.meter.balls : 0))]);
    if (y.meter) rows.push(['按原图解米数（粗估）', A.fmtV(y.meter.meters, 1) + ' m', y.meter.balls + ' 团', y.used === 'meter' || (y.used === 'max' && y.meter.balls > (y.weight ? y.weight.balls : 0))]);
    $('yarnOut').innerHTML = '<table class="yarnTbl"><tr><th>算法</th><th>含多备 ' + A.fmtPct(y.spare) + '</th><th>团数</th></tr>' +
      rows.map(function (r) { return '<tr class="' + (r[3] ? 'use' : '') + '"><td>' + r[0] + (r[3] ? '（采用）' : '') + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>'; }).join('') + '</table>';
    $('warnBox').classList.toggle('hide', !out.warnings.length);
    $('warnBox').innerHTML = '<ul>' + out.warnings.map(function (w) { return '<li>' + esc(w.message) + '</li>'; }).join('') + '</ul>';
    $('actsBlock').classList.toggle('hide', !out.actions.length);
    $('acts').innerHTML = out.actions.map(function (a, i) { return '<button type="button" class="act" id="act_' + a.key + '" data-a="' + i + '">→ ' + esc(a.text) + '</button>'; }).join('');
  }
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    state = A.applyAction(state, out.actions[+b.getAttribute('data-a')]); fillAll(); update();
  });

  function update() { out = A.compute(state); markErrors(); render(); renderPresets(); save(); }

  /* ── 导出 ── */
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function download(name, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  $('dlCsv').addEventListener('click', function () { download('十厘米里几针.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { download('十厘米里几针.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () {
    download('十厘米里几针-备份.json', new Blob([JSON.stringify({ app: '十厘米里几针', slug: 'knit-gauge', version: 1, exported_at: stamp(), state: state, out: out }, null, 2)], { type: 'application/json' }));
  });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var r = new FileReader(); r.onload = function () { importText(String(r.result)); }; r.readAsText(f); this.value = '';
  });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('saveTag').textContent = '· 这个文件读不出来，没改动'; return false; }
    state = s; fillAll(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); fillAll(); update(); });

  /* PNG 改写单 1080×1350：所有文字取自 out */
  /* 按「词」折行：数字/字母串（如 2.2、cm、+0.2）不拆开，标点粘在前一个词后面，行首不出现标点。
   * （PNG 目检两次发现：先是「，180 元」行首逗号，第一版修法又把「2.2」拆成「2.」和「2 cm」。） */
  function wrapText(ctx, text, maxW) {
    var toks = String(text).match(/[0-9A-Za-z.+\-×%]+|\s|./g) || [];
    var merged = [];
    toks.forEach(function (tk) {
      if (merged.length && /^[，。、；：）」%,.;:)]$/.test(tk)) merged[merged.length - 1] += tk; else merged.push(tk);
    });
    var lines = [], cur = '';
    merged.forEach(function (tk) {
      if (cur && ctx.measureText(cur + tk).width > maxW) { lines.push(cur.replace(/\s+$/, '')); cur = /^\s$/.test(tk) ? '' : tk; }
      else cur += tk;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawCard() {
    var W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    var F = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', M = 'ui-monospace,Menlo,Consolas,monospace';
    g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fffdfa'; g.fillRect(48, 48, W - 96, H - 96);
    g.fillStyle = '#8c3b5a'; g.fillRect(48, 48, W - 96, 10);
    var L = 92, R = W - 92, maxW = R - L, y = 135;
    function para(t, size, color, lh, max, bold) {
      g.font = (bold ? '700 ' : '') + size + 'px ' + F; g.fillStyle = color;
      var ls = wrapText(g, t, maxW); if (max && ls.length > max) { ls = ls.slice(0, max); ls[max - 1] = ls[max - 1].slice(0, -1) + '…'; }
      ls.forEach(function (l) { g.fillText(l, L, y); y += lh; });
    }
    g.font = '700 42px ' + F; g.fillStyle = '#2b2730'; g.fillText('十厘米里几针 · 改写单', L, y); y += 44;
    g.font = '22px ' + F; g.fillStyle = '#8a8490'; g.fillText('导出时间 ' + stamp() + ' · 默认场景为虚构示例', L, y); y += 58;
    if (!out.ok) {
      para('还算不出来', 44, '#a3401f', 60, 1, true);
      out.errors.slice(0, 12).forEach(function (e) { para('· ' + e.message, 26, '#55505c', 38, 2); });
      return c;
    }
    var gg = out.gauge, yy = out.yarn;
    g.font = '28px ' + F; g.fillStyle = '#6f7d8c'; g.fillText('图解 ' + A.fmtV(gg.ps, 2) + ' 针 × ' + A.fmtV(gg.pr, 2) + ' 行', L, y);
    g.fillStyle = '#8c3b5a'; g.fillText('我的 ' + A.fmtV(gg.myS, 2) + ' 针 × ' + A.fmtV(gg.myR, 2) + ' 行', L + 470, y); y += 72;
    g.font = '700 64px ' + M; g.fillStyle = '#8c3b5a'; g.fillText('× ' + A.fmtV(gg.rs, 3), L, y);
    g.fillStyle = '#3f6b4a'; g.fillText(yy.buy + ' 团', L + 470, y); y += 40;
    g.font = '24px ' + F; g.fillStyle = '#55505c'; g.fillText('针数比例（行 × ' + A.fmtV(gg.rr, 3) + '）', L, y);
    g.fillText('还要买，共 ' + yy.balls + ' 团，' + A.fmtV(yy.cost, 2) + ' 元', L + 470, y); y += 40;
    g.strokeStyle = '#e4dde3'; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.setLineDash([]); y += 50;
    out.pieces.forEach(function (p) {
      if (y > H - 250) return;
      g.font = '700 30px ' + F; g.fillStyle = '#2b2730';
      var nm = wrapText(g, p.name + ' ×' + p.n, maxW - 200)[0]; g.fillText(nm + (nm !== p.name + ' ×' + p.n ? '…' : ''), L, y);
      g.font = '700 24px ' + F; g.fillStyle = p.flag === 'narrow' ? '#a3401f' : p.flag === 'wide' ? '#8a6512' : '#3f6b4a'; g.textAlign = 'right';
      g.fillText('宽 ' + A.fmtSigned(p.dW, 1) + ' cm', R, y); g.textAlign = 'left'; y += 42;
      g.font = '26px ' + M; g.fillStyle = '#8c3b5a';
      g.fillText('起 ' + p.start + '→' + p.start2 + (p.end !== p.start ? '  止 ' + p.end + '→' + p.end2 : '') + '  行 ' + p.rows + '→' + p.rows2, L, y); y += 36;
      if (p.end !== p.start) { g.font = '23px ' + F; g.fillStyle = '#55505c'; para(p.text2, 23, '#55505c', 32, 2); }
      y += 22;
    });
    if (out.actions.length && y < H - 220) {
      g.strokeStyle = '#e4dde3'; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(L, y - 10); g.lineTo(R, y - 10); g.stroke(); g.setLineDash([]); y += 30;
      out.actions.forEach(function (a) { if (y < H - 170) { para('→ ' + a.text, 24, '#3f6b4a', 34, 3); y += 6; } });
    }
    g.font = '21px ' + F; g.fillStyle = '#8a8490';
    g.fillText('按样片密度等比换算 · 加减针在新行数里均分 · 米数法为粗估', L, H - 92);
    return c;
  }
  $('dlPng').addEventListener('click', function () {
    drawCard().toBlob(function (b) { if (b) download('十厘米里几针-1080x1350.png', b); }, 'image/png');
  });

  window.__knitUi = {
    state: function () { return JSON.parse(JSON.stringify(state)); },
    out: function () { return out; },
    importText: importText, drawCard: drawCard, storageKey: KEY
  };

  fillAll(); update();
})();
