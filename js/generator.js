/* 멘사 스타일 3×3 도형 행렬 생성기 — 브라우저와 Node 양쪽에서 동작 (ES 모듈 아님: file:// 에서도 열리도록)
 *
 * 실제 멘사 온라인 연습 테스트의 형식(완전 흑백 선화, 3×3 중 8칸 + 보기 6개 A~F, 뒤로 갈수록 어려워짐)을 따르되
 * 문제는 전부 오리지널이다 (이미지/문항을 복사하지 않고 규칙을 조합해 매번 새로 만든다).
 *
 * 문제 유형(family)
 *   pix     — 3×3 칸 위에 검은 칸 패턴. 위치 이동(shift) / 변환(회전·반전·이동·반전색) / 겹침 연산(OR·XOR·AND·차집합·XNOR)
 *   overlay — 도형·선분·원+점/선 같은 요소를 겹치는 문제 (3번째 칸 = 두 칸의 합/XOR/교집합/차집합)
 *   glyph   — 우산·화살표·깃발 모양이 45°씩 회전하고 속이 흰색/검정/빗금으로 바뀌는 문제
 * 정답은 규칙에서 계산하고, 보이는 8칸만으로 별도 풀이기가 정답을 하나로 추론해 내는 문제만 통과시킨다.
 * 같은 seed → 같은 문제 (재현 가능).
 */
(function (root) {
  'use strict';

  /* ───────── 난수 ───────── */
  function makeRng(seed) {
    var a = seed >>> 0;
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      int: function (n) { return Math.floor(next() * n); },
      range: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      chance: function (p) { return next() < p; },
      shuffle: function (arr) {
        var x = arr.slice();
        for (var i = x.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var tmp = x[i]; x[i] = x[j]; x[j] = tmp;
        }
        return x;
      }
    };
  }

  function popcount(x) { var c = 0; while (x) { c += x & 1; x >>= 1; } return c; }
  function bitsOf(m, nb) { var o = []; for (var i = 0; i < nb; i++) if (m & (1 << i)) o.push(i); return o; }
  function randMask(rng, nb, k) {
    var m = 0;
    rng.shuffle(bitsOf((1 << nb) - 1, nb)).slice(0, k).forEach(function (i) { m |= 1 << i; });
    return m;
  }

  /* ───────── 그리기: 흑백 선화 (SVG 안쪽 마크업, viewBox 0 0 100 100) ───────── */
  var SW = 3.2;
  var ST = 'fill="none" stroke="#000" stroke-width="' + SW + '" stroke-linejoin="round" stroke-linecap="square"';
  function f1(n) { return Math.round(n * 10) / 10; }
  function polyPts(cx, cy, r, n, rotDeg) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var ang = (rotDeg + i * 360 / n) * Math.PI / 180;
      pts.push(f1(cx + r * Math.cos(ang)) + ',' + f1(cy + r * Math.sin(ang)));
    }
    return pts.join(' ');
  }
  function seg(x1, y1, x2, y2, cap) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" fill="none" stroke="#000" stroke-width="' + SW +
      '" stroke-linecap="' + (cap || 'square') + '"/>';
  }

  // pix: 3×3 칸 위에 검은 칸 (비트 i = 행 i/3, 열 i%3)
  function renderPix(mask) {
    var X0 = 17, S = 66, c = S / 3, s = '', i;
    for (i = 0; i < 9; i++) {
      if (mask & (1 << i)) {
        s += '<rect x="' + f1(X0 + (i % 3) * c + 1.6) + '" y="' + f1(X0 + Math.floor(i / 3) * c + 1.6) + '" width="' + f1(c - 3.2) + '" height="' + f1(c - 3.2) + '" fill="#000"/>';
      }
    }
    s += '<rect x="' + X0 + '" y="' + X0 + '" width="' + S + '" height="' + S + '" fill="none" stroke="#000" stroke-width="2.6"/>';
    for (i = 1; i < 3; i++) {
      s += '<line x1="' + f1(X0 + i * c) + '" y1="' + X0 + '" x2="' + f1(X0 + i * c) + '" y2="' + (X0 + S) + '" stroke="#000" stroke-width="2.2"/>';
      s += '<line x1="' + X0 + '" y1="' + f1(X0 + i * c) + '" x2="' + (X0 + S) + '" y2="' + f1(X0 + i * c) + '" stroke="#000" stroke-width="2.2"/>';
    }
    return s;
  }

  // overlay: 테마별 요소 목록 (비트 i가 켜져 있으면 그 요소를 그린다)
  var PRIMS = {
    shapes: [
      '<ellipse cx="50" cy="50" rx="11" ry="25" ' + ST + '/>',
      '<ellipse cx="50" cy="50" rx="25" ry="11" ' + ST + '/>',
      '<rect x="20" y="20" width="60" height="60" ' + ST + '/>',
      '<circle cx="50" cy="50" r="17" ' + ST + '/>',
      '<circle cx="50" cy="50" r="4.8" fill="#000"/>',
      '<polygon points="50,24 76,50 50,76 24,50" ' + ST + '/>'
    ],
    lines: [
      seg(24, 24, 76, 24), seg(24, 76, 76, 76), seg(24, 24, 24, 76), seg(76, 24, 76, 76),
      seg(50, 24, 50, 76), seg(24, 50, 76, 50), seg(24, 24, 76, 76), seg(76, 24, 24, 76)
    ],
    dial: [
      '<circle cx="50" cy="36" r="3.9" fill="#000"/>', '<circle cx="64" cy="50" r="3.9" fill="#000"/>',
      '<circle cx="50" cy="64" r="3.9" fill="#000"/>', '<circle cx="36" cy="50" r="3.9" fill="#000"/>',
      seg(50, 50, 76, 24, 'butt'), seg(50, 50, 76, 76, 'butt'), seg(50, 50, 24, 76, 'butt'), seg(50, 50, 24, 24, 'butt')
    ]
  };
  function renderOverlay(theme, mask) {
    var s = theme === 'dial' ? '<circle cx="50" cy="50" r="27" ' + ST + '/>' : '';
    PRIMS[theme].forEach(function (p, i) { if (mask & (1 << i)) s += p; });
    return s;
  }

  // glyph: 막대 끝에 머리가 달린 비대칭 모양 (0 우산 1 화살표 2 깃발), 회전 45° 단위, 속 0 흰색 1 검정 2 빗금
  var GHEAD = {
    0: { d: 'M28 40 A22 22 0 0 1 72 40 Z', top: 40 },
    1: { d: 'M50 12 L68 42 L32 42 Z', top: 42 },
    2: { d: 'M50 16 L78 29 L50 42 Z', top: 42 },
    3: { d: 'M36 33 L64 33 L64 46 L36 46 Z', top: 46 }
  };
  function renderGlyph(rot, fill, glyph) {
    var h = GHEAD[glyph], s = '<g transform="rotate(' + (rot * 45) + ' 50 50)">';
    s += '<line x1="50" y1="80" x2="50" y2="' + h.top + '" stroke="#000" stroke-width="' + SW + '" stroke-linecap="round"/>';
    s += '<path d="' + h.d + '" fill="' + (fill === 1 ? '#000' : '#fff') + '" stroke="#000" stroke-width="' + SW + '" stroke-linejoin="round"/>';
    if (fill === 2) {
      s += '<clipPath id="gc' + glyph + '"><path d="' + h.d + '"/></clipPath><g clip-path="url(#gc' + glyph + ')">';
      for (var x = 22; x <= 80; x += 4.6) s += '<line x1="' + f1(x) + '" y1="0" x2="' + f1(x) + '" y2="100" stroke="#000" stroke-width="1.7"/>';
      s += '</g><path d="' + h.d + '" fill="none" stroke="#000" stroke-width="' + SW + '" stroke-linejoin="round"/>';
    }
    return s + '</g>';
  }

  // combo: 바깥 도형(0 원 1 사각 2 삼각 3 마름모 4 육각 5 모서리 점 4개 6 오목 별) x 안쪽 기호(0 없음 1 점 2 플러스 3 작은 원 4 작은 마름모 5 작은 사각) x 채우기
  var CFILL = { B: ['#ffffff', '#8f8f8f', '#000000'], C: ['#ffffff', '#c4c4c4', '#8f8f8f'], A: ['#ffffff', '#ffffff', '#ffffff'] };
  function comboOuter(o, fill) {
    var st = 'fill="' + fill + '" stroke="#000" stroke-width="' + SW + '" stroke-linejoin="round"';
    if (o === 0) return '<circle cx="50" cy="50" r="30" ' + st + '/>';
    if (o === 1) return '<rect x="22" y="22" width="56" height="56" ' + st + '/>';
    if (o === 2) return '<polygon points="50,18 82,76 18,76" ' + st + '/>';
    if (o === 3) return '<polygon points="50,16 84,50 50,84 16,50" ' + st + '/>';
    if (o === 4) return '<polygon points="' + polyPts(50, 50, 32, 6, 0) + '" ' + st + '/>';
    if (o === 5) return [[24, 24], [76, 24], [24, 76], [76, 76]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.4" fill="#000"/>'; }).join('');
    return '<path d="M50 14 Q54 46 86 50 Q54 54 50 86 Q46 54 14 50 Q46 46 50 14 Z" ' + st + '/>';
  }
  function comboInner(i, cx, cy) {
    var st = 'fill="#fff" stroke="#000" stroke-width="' + SW + '" stroke-linejoin="round"';
    if (i === 1) return '<circle cx="' + cx + '" cy="' + cy + '" r="5.6" fill="#000"/>';
    if (i === 2) return seg(cx - 12, cy, cx + 12, cy) + seg(cx, cy - 12, cx, cy + 12);
    if (i === 3) return '<circle cx="' + cx + '" cy="' + cy + '" r="8.5" ' + st + '/>';
    if (i === 4) return '<polygon points="' + cx + ',' + (cy - 10) + ' ' + (cx + 10) + ',' + cy + ' ' + cx + ',' + (cy + 10) + ' ' + (cx - 10) + ',' + cy + '" ' + st + '/>';
    if (i === 5) return '<rect x="' + (cx - 8) + '" y="' + (cy - 8) + '" width="16" height="16" ' + st + '/>';
    return '';
  }
  function renderCombo(variant, d) {
    var s = comboOuter(d.o, d.f >= 0 ? CFILL[variant][d.f] : '#ffffff');
    if (d.i > 0) s += comboInner(d.i, 50, d.o === 2 ? 58 : 50);
    return s;
  }

  /* ───────── 마스크 연산 / 변환 ───────── */
  var OPS = {
    or:   function (a, b) { return a | b; },
    xor:  function (a, b) { return a ^ b; },
    and:  function (a, b) { return a & b; },
    d12:  function (a, b, full) { return a & ~b & full; },
    d21:  function (a, b, full) { return b & ~a & full; },
    xnor: function (a, b, full) { return ~(a ^ b) & full; }
  };

  function mapMask(m, f) {
    var o = 0;
    for (var i = 0; i < 9; i++) if (m & (1 << i)) { var p = f(Math.floor(i / 3), i % 3); o |= 1 << (p[0] * 3 + p[1]); }
    return o;
  }
  var SPATIAL = {
    rot90:  function (r, c) { return [c, 2 - r]; },
    rot180: function (r, c) { return [2 - r, 2 - c]; },
    rot270: function (r, c) { return [2 - c, r]; },
    flipH:  function (r, c) { return [r, 2 - c]; },
    flipV:  function (r, c) { return [2 - r, c]; },
    trans:  function (r, c) { return [c, r]; },
    shiftR: function (r, c) { return [r, (c + 1) % 3]; },
    shiftL: function (r, c) { return [r, (c + 2) % 3]; },
    shiftD: function (r, c) { return [(r + 1) % 3, c]; },
    shiftU: function (r, c) { return [(r + 2) % 3, c]; }
  };
  var TFS = [], TF_SIMPLE = [], TF_HARD = [];
  Object.keys(SPATIAL).forEach(function (k) {
    var f = (function (g) { return function (m) { return mapMask(m, g); }; })(SPATIAL[k]);
    var t = { name: k, f: f }; TFS.push(t); TF_SIMPLE.push(t);
  });
  (function () { var t = { name: 'invert', f: function (m) { return m ^ 511; } }; TFS.push(t); TF_SIMPLE.push(t); })();
  ['rot90', 'flipH', 'flipV', 'shiftR', 'shiftD', 'trans'].forEach(function (k) {
    var g = SPATIAL[k];
    var t = { name: k + '+invert', f: function (m) { return mapMask(m, g) ^ 511; } };
    TFS.push(t); TF_HARD.push(t);
  });
  function rotl9(m, s) { s = ((s % 9) + 9) % 9; return ((m << s) | (m >> (9 - s))) & 511; }

  // 마스크 문제 풀이기: 보이는 8칸(cells[0..7])만 보고 9번째를 추론. 단일 예측이면 ok
  function solveMasks(m, meta) {
    var preds = {}, full = meta.full;
    Object.keys(meta.ops).forEach(function (k) {
      var f = OPS[k];
      if (f(m[0], m[1], full) === m[2] && f(m[3], m[4], full) === m[5]) preds[f(m[6], m[7], full)] = 1;
      if (f(m[0], m[3], full) === m[6] && f(m[1], m[4], full) === m[7]) preds[f(m[2], m[5], full)] = 1;
    });
    if (meta.tf) {
      TFS.forEach(function (T) {
        var fn = T.f;
        if (fn(m[0]) === m[1] && fn(m[1]) === m[2] && fn(m[3]) === m[4] && fn(m[4]) === m[5] && fn(m[6]) === m[7]) preds[fn(m[7])] = 1;
        if (fn(m[0]) === m[3] && fn(m[3]) === m[6] && fn(m[1]) === m[4] && fn(m[4]) === m[7] && fn(m[2]) === m[5]) preds[fn(m[5])] = 1;
      });
    }
    if (meta.shift) {
      for (var dr = 0; dr < 9; dr++) for (var dc = 0; dc < 9; dc++) {
        var ok = true;
        for (var r = 0; r < 3 && ok; r++) for (var c = 0; c < 3; c++) {
          if (r === 2 && c === 2) continue;
          if (rotl9(m[0], dr * r + dc * c) !== m[r * 3 + c]) { ok = false; break; }
        }
        if (ok) preds[rotl9(m[0], 2 * dr + 2 * dc)] = 1;
      }
    }
    var ks = Object.keys(preds);
    return { ok: ks.length === 1, pred: ks.length === 1 ? +ks[0] : null };
  }

  /* ───────── glyph 풀이기 ───────── */
  var GATTR = { rot: { n: 8, ord: true }, fill: { n: 3, ord: false }, glyph: { n: 3, ord: false } };
  function perms3(a) {
    return [[a[0], a[1], a[2]], [a[0], a[2], a[1]], [a[1], a[0], a[2]], [a[1], a[2], a[0]], [a[2], a[0], a[1]], [a[2], a[1], a[0]]];
  }
  function predictAttr(A, vals) {
    var n = A.n, preds = {}, maps;
    if (A.ord) maps = [function (i) { return i; }];
    else {
      var D = [];
      for (var i = 0; i < 8; i++) if (D.indexOf(vals[i]) < 0) D.push(vals[i]);
      if (D.length === 1) return [D[0]];
      if (D.length !== 3) return null;
      maps = perms3(D).map(function (p) { return function (k) { return p[k]; }; });
    }
    maps.forEach(function (map) {
      for (var a = 0; a < n; a++) for (var dr = 0; dr < n; dr++) for (var dc = 0; dc < n; dc++) {
        var ok = true;
        for (var r = 0; r < 3 && ok; r++) for (var c = 0; c < 3; c++) {
          if (r === 2 && c === 2) continue;
          if (map((a + dr * r + dc * c) % n) !== vals[r * 3 + c]) { ok = false; break; }
        }
        if (ok) preds[map((a + 2 * dr + 2 * dc) % n)] = 1;
      }
    });
    return Object.keys(preds).map(Number);
  }
  function solveGlyph(cells) {
    var pred = {}, ok = true;
    Object.keys(GATTR).forEach(function (nm) {
      var p = predictAttr(GATTR[nm], cells.map(function (c) { return c[nm]; }));
      if (!p || p.length !== 1) ok = false; else pred[nm] = p[0];
    });
    return { ok: ok, pred: ok ? glyphData(pred.rot, pred.fill, pred.glyph) : null };
  }
  function comboData(o, i, f) { return { o: o, i: i, f: f, k: 'c' + o + '.' + i + '.' + f }; }
  function solveCombo(cells) {
    var pred = {}, ok = true;
    ['o', 'i', 'f'].forEach(function (nm) {
      var vals = cells.map(function (c) { return c[nm]; });
      if (vals[0] === -1) { pred[nm] = -1; return; }
      var p = predictAttr({ n: 3, ord: false }, vals);
      if (!p || p.length !== 1) ok = false; else pred[nm] = p[0];
    });
    return { ok: ok, pred: ok ? comboData(pred.o, pred.i, pred.f) : null };
  }
  function glyphData(rot, fill, glyph) { return { rot: rot, fill: fill, glyph: glyph, k: 'g' + rot + '.' + fill + '.' + glyph }; }
  function maskData(prefix, m) { return { m: m, k: prefix + m }; }

  /* 풀이기 공개: 보이는 8칸만 사용. 반환 {ok, key} */
  function solve(p) {
    var d = p._data, r;
    if (p.family === 'glyph') { r = solveGlyph(d.cells); return { ok: r.ok, key: r.ok ? r.pred.k : null }; }
    if (p.family === 'combo') { r = solveCombo(d.cells); return { ok: r.ok, key: r.ok ? r.pred.k : null }; }
    r = solveMasks(d.cells.map(function (c) { return c.m; }), d.meta);
    return { ok: r.ok, key: r.ok ? (p.family === 'pix' ? 'p' : 'o') + r.pred : null };
  }

  /* ───────── 보기 만들기 ───────── */
  function pickOptions(rng, correct, groups, want) {
    // groups: 우선순위 순서의 후보 묶음(각각 섞어서 사용). 부족하면 null
    var seen = {}; seen[correct.k] = 1;
    var out = [];
    groups.forEach(function (g) {
      g.list.forEach(function (t) {
        if (out.length >= want || g.max === 0) return;
        if (g.used >= g.max) return;
        if (!t || seen[t.k]) return;
        seen[t.k] = 1; out.push(t); g.used++;
      });
    });
    if (out.length < want) return null;
    var all = rng.shuffle([correct].concat(out.slice(0, want)));
    return { options: all, answer: all.indexOf(correct) };
  }
  function grp(rng, list, max) { return { list: rng.shuffle(list), max: max, used: 0 }; }

  function maskOptions(rng, family, correct, cells, meta, level) {
    var pre = family === 'pix' ? 'p' : 'o', nb = meta.nb, full = meta.full, c = correct.m;
    function md(m) { return m > 0 && m <= full ? maskData(pre, m) : null; }
    var toggles = [], alt = [], dbl = [];
    for (var i = 0; i < nb; i++) toggles.push(md(c ^ (1 << i)));
    var nbrs = [md(cells[7].m), md(cells[5].m)];
    Object.keys(meta.ops).forEach(function (k) {
      alt.push(md(OPS[k](cells[6].m, cells[7].m, full)), md(OPS[k](cells[2].m, cells[5].m, full)));
    });
    if (family === 'pix') {
      TF_SIMPLE.forEach(function (T) { alt.push(md(T.f(c))); });
      alt.push(md(rotl9(c, 1)), md(rotl9(c, 3)), md(rotl9(c, 8)), md(rotl9(c, 6)));
    }
    for (var g = 0; g < 60; g++) {
      var a = rng.int(nb), b = rng.int(nb);
      if (a !== b) dbl.push(md(c ^ (1 << a) ^ (1 << b)));
    }
    var groups = [
      grp(rng, nbrs, level === 3 ? 2 : 1),
      grp(rng, alt, level === 1 ? 1 : 2),
      grp(rng, toggles, 5),
      grp(rng, dbl, 5)
    ];
    return pickOptions(rng, correct, groups, 5);
  }

  function glyphOptions(rng, correct, cells, spec, level) {
    function gd(rot, fill, glyph) { return glyphData(((rot % 8) + 8) % 8, fill, glyph); }
    function varies(nm) { return spec.attrs[nm].dr !== 0 || spec.attrs[nm].dc !== 0; }
    var vr = varies('rot'), vf = varies('fill'), vg = varies('glyph');
    var singles = [], dbl = [], wild = [];
    // 퍼즐에서 실제로 바뀌는 속성만 건드린 그럴듯한 오답 우선
    if (vr) [1, 2, 4, 6, 7].forEach(function (d) { singles.push(gd(correct.rot + d, correct.fill, correct.glyph)); });
    if (vf) [0, 1, 2].forEach(function (f) { if (f !== correct.fill) singles.push(gd(correct.rot, f, correct.glyph)); });
    if (vg) spec.dom.glyph.forEach(function (g) { if (g !== correct.glyph) singles.push(gd(correct.rot, correct.fill, g)); });
    for (var i = 0; i < 60; i++) {
      var rr = vr ? correct.rot + rng.pick([1, 2, 4, 6, 7]) : correct.rot;
      var ff = vf ? rng.int(3) : correct.fill;
      var gg = vg ? rng.pick(spec.dom.glyph) : correct.glyph;
      dbl.push(gd(rr, ff, gg));
      wild.push(gd(correct.rot + rng.pick([1, 2, 4, 6, 7]), rng.int(3), rng.pick(spec.dom.glyph)));
    }
    var groups = [grp(rng, singles, 4), grp(rng, dbl, 5), grp(rng, wild, 5)];
    return pickOptions(rng, correct, groups, 5);
  }

  /* ───────── pix 문제 ───────── */
  function genPix(rng, level) {
    var kinds = level === 1 ? ['shift1', 'shift1', 'tfS']
      : level === 2 ? ['shift1', 'shiftK', 'shiftK', 'tfS', 'tfS', 'opE']
      : ['shiftK', 'tfS', 'tfH', 'tfH', 'opH', 'opH', 'opH'];
    var kind = rng.pick(kinds), spec = { kind: kind }, cells = [], r, c, i;
    var meta = { nb: 9, full: 511, ops: { or: 1, xor: 1, and: 1, d12: 1, d21: 1, xnor: 1 }, tf: true, shift: true };

    if (kind === 'shift1' || kind === 'shiftK') {
      var k = kind === 'shift1' ? 1 : rng.range(2, 3), m0 = 0, tries = 0;
      do {
        m0 = randMask(rng, 9, k); tries++;
        var periodic = false;
        for (i = 1; i < 9; i++) if (rotl9(m0, i) === m0) periodic = true;
      } while (periodic && tries < 50);
      var dr, dc;
      do { dr = rng.int(9); dc = rng.int(9); } while ((dr === 0 && dc === 0) || (level === 1 && dc === 0));
      spec.m0 = m0; spec.dr = dr; spec.dc = dc;
      for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) cells.push(rotl9(m0, dr * r + dc * c));
    } else if (kind === 'tfS' || kind === 'tfH') {
      var T = rng.pick(kind === 'tfS' ? TF_SIMPLE : TF_HARD), rows = [], seen = {};
      for (var t2 = 0; rows.length < 3 && t2 < 200; t2++) {
        var m = randMask(rng, 9, rng.range(2, 5)), m1 = T.f(m), m2 = T.f(m1);
        if (m === m1 || m1 === m2 || m === m2 || seen[m]) continue;
        seen[m] = 1; rows.push([m, m1, m2]);
      }
      if (rows.length < 3) return null;
      spec.tf = T.name; spec.rows = rows;
      var tr = rng.chance(level === 1 ? 0 : 0.5);
      spec.orient = tr ? 'col' : 'row';
      for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) cells.push(tr ? rows[c][r] : rows[r][c]);
    } else {
      var ops = kind === 'opE' ? ['or', 'xor'] : ['or', 'xor', 'and', 'd12', 'd21', 'xnor'];
      var op = rng.pick(ops), rows2 = [], seen2 = {};
      for (var t3 = 0; rows2.length < 3 && t3 < 400; t3++) {
        var lo = op === 'and' ? 4 : op === 'xnor' ? 3 : op === 'or' || op === 'xor' ? 2 : 3;
        var hi = op === 'and' ? 6 : op === 'xnor' ? 5 : op === 'or' || op === 'xor' ? 3 : 5;
        var a = randMask(rng, 9, rng.range(lo, hi)), b = randMask(rng, 9, rng.range(lo, hi)), res = OPS[op](a, b, 511), pc = popcount(res);
        if (pc < 1 || pc > 7 || res === a || res === b || a === b || seen2[a + ',' + b]) continue;
        seen2[a + ',' + b] = 1; rows2.push([a, b, res]);
      }
      if (rows2.length < 3) return null;
      spec.op = op; spec.rows = rows2;
      var tr2 = rng.chance(0.5);
      spec.orient = tr2 ? 'col' : 'row';
      for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) cells.push(tr2 ? rows2[c][r] : rows2[r][c]);
    }
    var data = cells.map(function (mm) { return maskData('p', mm); });
    var sol = solveMasks(cells, meta);
    if (!sol.ok || sol.pred !== cells[8]) return null;
    var opt = maskOptions(rng, 'pix', data[8], data, meta, level);
    if (!opt) return null;
    return {
      family: 'pix', spec: spec, data: data, meta: meta, opt: opt,
      score: level + { shift1: 0, tfS: 0.25, shiftK: 0.3, opE: 0.4, tfH: 0.6, opH: 0.75 }[kind],
      render: function (d) { return renderPix(d.m); }
    };
  }

  /* ───────── overlay 문제 ───────── */
  var NB = { shapes: 6, lines: 8, dial: 8 };
  function genOverlay(rng, level) {
    var theme = rng.pick(['shapes', 'lines', 'dial']), nb = NB[theme], full = (1 << nb) - 1;
    var op = rng.pick(level === 1 ? ['or'] : level === 2 ? ['or', 'xor'] : ['or', 'xor', 'and', 'd12', 'd21']);
    var orient = level === 1 ? 'row' : rng.pick(['row', 'col']);
    var rows = [], seen = {};
    for (var t = 0; rows.length < 3 && t < 400; t++) {
      var lo = op === 'and' ? 3 : op === 'or' && level === 1 ? 1 : op === 'or' || op === 'xor' ? 2 : 2;
      var hi = op === 'and' ? Math.min(5, nb - 1) : op === 'or' && level === 1 ? 2 : op === 'or' || op === 'xor' ? 3 : 4;
      var a = randMask(rng, nb, rng.range(lo, hi)), b = randMask(rng, nb, rng.range(lo, hi)), res = OPS[op](a, b, full);
      if (res === 0 || res === a || res === b || a === b || popcount(res) > 5 || seen[a + ',' + b]) continue;
      seen[a + ',' + b] = 1; rows.push([a, b, res]);
    }
    if (rows.length < 3) return null;
    var cells = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cells.push(orient === 'col' ? rows[c][r] : rows[r][c]);
    var meta = { nb: nb, full: full, ops: { or: 1, xor: 1, and: 1, d12: 1, d21: 1 }, tf: false, shift: false, theme: theme };
    var data = cells.map(function (m) { return maskData('o', m); });
    var sol = solveMasks(cells, meta);
    if (!sol.ok || sol.pred !== cells[8]) return null;
    var opt = maskOptions(rng, 'overlay', data[8], data, meta, level);
    if (!opt) return null;
    return {
      family: 'overlay', spec: { theme: theme, op: op, orient: orient, rows: rows }, data: data, meta: meta, opt: opt,
      score: level + { or: 0.2, xor: 0.4, and: 0.7, d12: 0.8, d21: 0.8 }[op] + (theme === 'shapes' ? 0.05 : 0),
      render: function (d) { return renderOverlay(theme, d.m); }
    };
  }

  /* ───────── glyph 문제 ───────── */
  function genGlyph(rng, level) {
    var spec = { dom: { fill: rng.shuffle([0, 1, 2]), glyph: rng.shuffle([0, 1, 2, 3]).slice(0, 3) }, attrs: {} };
    var names = ['rot', 'fill', 'glyph'];
    var varying = level === 1 ? ['rot', 'fill'] : names;
    function step(nm, nonzero) { return rng.pick(nm === 'rot' ? (nonzero ? [1, 2, 4, 6, 7] : [0, 1, 2, 4, 6, 7]) : (nonzero ? [1, 2] : [0, 1, 2])); }
    var rowAttr = rng.pick(['rot', 'fill']);
    names.forEach(function (nm) {
      var a = rng.int(GATTR[nm].n), dr = 0, dc = 0;
      if (level === 1) {
        // 한 속성은 줄마다, 다른 속성은 칸마다 바뀐다
        if (nm === rowAttr) dr = step(nm, true); else dc = step(nm, true);
      } else if (level === 2) {
        do { dr = step(nm, false); dc = step(nm, false); } while (dr === 0 && dc === 0);
      } else {
        dr = step(nm, true); dc = step(nm, true);
      }
      spec.attrs[nm] = { a: a, dr: dr, dc: dc };
    });
    var data = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
      var v = {};
      names.forEach(function (nm) {
        var at = spec.attrs[nm], idx = (at.a + at.dr * r + at.dc * c) % GATTR[nm].n;
        v[nm] = nm === 'rot' ? idx : spec.dom[nm][idx];
      });
      data.push(glyphData(v.rot, v.fill, v.glyph));
    }
    var sol = solveGlyph(data);
    if (!sol.ok || sol.pred.k !== data[8].k) return null;
    var opt = glyphOptions(rng, data[8], data, spec, level);
    if (!opt) return null;
    return {
      family: 'glyph', spec: spec, data: data, meta: {}, opt: opt, score: level + 0.1 * varying.length,
      render: function (d) { return renderGlyph(d.rot, d.fill, d.glyph); }
    };
  }

  /* ───────── combo 문제: 바깥 도형 x 안쪽 기호 x 채우기 (3값 순환) ───────── */
  function genCombo(rng, level) {
    var variant = level === 1 ? rng.pick(['A', 'A', 'A', 'B']) : level === 2 ? rng.pick(['A', 'B', 'B', 'C']) : rng.pick(['A', 'C', 'C']);
    var hasFill = variant !== 'A', hasInner = variant !== 'B';
    var pool = hasFill ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6];
    var dom = {
      o: rng.shuffle(pool).slice(0, 3), i: rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3),
      f: rng.shuffle([0, 1, 2])
    };
    var names = ['o'].concat(hasInner ? ['i'] : []).concat(hasFill ? ['f'] : []);
    var attrs = {};
    names.forEach(function (nm) { attrs[nm] = { a: rng.int(3), dr: 0, dc: 0 }; });
    if (level === 1) {
      // 한 속성은 줄마다, 다른 속성은 칸마다 바뀐다 (직교하는 라틴 방진)
      var rowAttr = rng.pick(names), colAttr = names.filter(function (n) { return n !== rowAttr; })[0];
      attrs[rowAttr].dr = rng.range(1, 2); attrs[colAttr].dc = rng.range(1, 2);
    } else {
      names.forEach(function (nm) {
        do { attrs[nm].dr = rng.int(3); attrs[nm].dc = rng.int(3); } while (attrs[nm].dr === 0 && attrs[nm].dc === 0);
      });
    }
    var data = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
      var v = { o: -1, i: -1, f: -1 };
      names.forEach(function (nm) { v[nm] = dom[nm][(attrs[nm].a + attrs[nm].dr * r + attrs[nm].dc * c) % 3]; });
      data.push(comboData(v.o, v.i, v.f));
    }
    var sol = solveCombo(data);
    if (!sol.ok || sol.pred.k !== data[8].k) return null;
    var cor = data[8], singles = [], dbl = [];
    names.forEach(function (nm) {
      dom[nm].forEach(function (x) {
        if (x !== cor[nm]) { var t = { o: cor.o, i: cor.i, f: cor.f }; t[nm] = x; singles.push(comboData(t.o, t.i, t.f)); }
      });
    });
    for (var g = 0; g < 40; g++) {
      var a = rng.pick(names), b = rng.pick(names);
      if (a === b) continue;
      var t2 = { o: cor.o, i: cor.i, f: cor.f };
      t2[a] = rng.pick(dom[a]); t2[b] = rng.pick(dom[b]);
      dbl.push(comboData(t2.o, t2.i, t2.f));
    }
    var nbrs = [data[7], data[5]].map(function (x) { return comboData(x.o, x.i, x.f); });
    var opt = pickOptions(rng, cor, [grp(rng, nbrs, level === 3 ? 2 : 1), grp(rng, singles, 4), grp(rng, dbl, 5)], 5);
    if (!opt) return null;
    return {
      family: 'combo', spec: { variant: variant, dom: dom, attrs: attrs }, data: data, meta: { variant: variant }, opt: opt,
      score: level + 0.15 * names.length + (level === 1 ? 0 : 0.1),
      render: function (d) { return renderCombo(variant, d); }
    };
  }

  /* ───────── 문제 / 시험 생성 ───────── */
  var FAMILY_WEIGHTS = {
    1: [['combo', 0.30], ['pix', 0.30], ['glyph', 0.25], ['overlay', 0.15]],
    2: [['combo', 0.20], ['pix', 0.25], ['glyph', 0.25], ['overlay', 0.30]],
    3: [['combo', 0.15], ['pix', 0.30], ['glyph', 0.15], ['overlay', 0.40]]
  };
  function pickFamily(rng, level) {
    var x = rng.next(), acc = 0, w = FAMILY_WEIGHTS[level];
    for (var i = 0; i < w.length; i++) { acc += w[i][1]; if (x < acc) return w[i][0]; }
    return w[0][0];
  }

  function generateProblem(type, level, seed) {
    var rng = makeRng(seed);
    for (var tries = 0; tries < 400; tries++) {
      var fam = pickFamily(rng, level);
      var g = fam === 'pix' ? genPix(rng, level) : fam === 'overlay' ? genOverlay(rng, level) : fam === 'combo' ? genCombo(rng, level) : genGlyph(rng, level);
      if (!g) continue;
      var distinct = {};
      g.data.forEach(function (d) { distinct[d.k] = 1; });
      if (Object.keys(distinct).length !== 9) continue;
      return {
        type: 'matrix', family: g.family, level: level, answer: g.opt.answer, score: g.score, seed: seed,
        fp: g.family[0].toUpperCase() + level + JSON.stringify(g.spec),
        cells: g.data.slice(0, 8).map(g.render), options: g.opt.options.map(g.render),
        _data: { cells: g.data, options: g.opt.options, meta: g.meta }
      };
    }
    throw new Error('problem generation failed');
  }

  var PLAN = [[1, 9], [2, 14], [3, 12]];   // 35문항 (실제 연습 테스트와 같은 문항 수, 뒤쪽 비중이 큼)
  var TOTAL = PLAN.reduce(function (s, p) { return s + p[1]; }, 0);

  // 한 번의 시험: 쉬움 → 보통 → 어려움, 각 구간 안에서도 쉬운 것부터. 한 시험 안에 같은 문제 없음.
  function generateTest(seed) {
    var rng = makeRng(seed), seen = {}, out = [];
    PLAN.forEach(function (pl) {
      var level = pl[0], group = [];
      for (var n = 0; n < pl[1]; n++) {
        var p;
        for (var tries = 0; tries < 30; tries++) {
          p = generateProblem('matrix', level, rng.int(2147483647));
          if (!seen[p.fp]) break;
        }
        seen[p.fp] = true;
        p.order = p.score + rng.next() * 0.35;
        group.push(p);
      }
      group.sort(function (a, b) { return a.order - b.order; });
      out = out.concat(group);
    });
    return out;
  }

  var api = {
    makeRng: makeRng, generateProblem: generateProblem, generateTest: generateTest,
    solve: solve, TOTAL: TOTAL, LEVELS: PLAN
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MensaGen = api;
})(typeof self !== 'undefined' ? self : this);
