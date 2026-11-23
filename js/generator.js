/* 멘사(레이븐) 스타일 3×3 도형 행렬 생성기 — 브라우저와 Node 양쪽에서 동작 (ES 모듈 아님: file:// 에서도 열리도록)
 *
 * 구성: 8개 도형을 보여주고 빈칸(9번째)에 들어갈 도형을 보기 6개 중에서 고르는 문제.
 * 도형 하나는 여러 겹(바깥 도형 + 빗금 + 안쪽 도형 + 점/표식)으로 이루어지고,
 * 각 겹에는 레이븐 행렬의 대표 규칙이 적용된다.
 *   · 고정(Constant)      — 같은 값이 유지된다
 *   · 점진 변화(Progression) — 칸마다 한 단계씩 변한다 (명암, 크기, 점 위치)
 *   · 3값 순환(Distribute Three) — 한 줄에 세 값이 한 번씩 등장한다 (도형, 빗금)
 *   · 겹침 연산(Arithmetic) — 3번째 칸 = 1번째와 2번째의 합/XOR/교집합/차집합 (표식 점)
 * 정답은 규칙에서 계산하고, 별도의 풀이기(solveGrid)가 보이는 8칸만으로 정답이 하나로 정해지는지 다시 확인한다.
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

  /* ───────── 그리기 (SVG 안쪽 마크업, viewBox 0 0 100 100) ───────── */
  var INK = '#273142';
  var HATCH_INK = '#5b667a';
  var FILLS = ['#ffffff', '#b9c3d3', '#273142'];
  var SIZE_MUL = [0.65, 1, 1.4];

  function f1(n) { return Math.round(n * 10) / 10; }
  function polyPts(cx, cy, r, n, rotDeg) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var ang = (rotDeg + i * 360 / n) * Math.PI / 180;
      pts.push(f1(cx + r * Math.cos(ang)) + ',' + f1(cy + r * Math.sin(ang)));
    }
    return pts.join(' ');
  }

  // 바깥 도형 0 원 1 사각 2 삼각 3 마름모 4 육각 5 오각
  var OUTER = {
    0: { tag: 'circle', a: 'cx="50" cy="50" r="40"', c: [50, 50], scale: 1 },
    1: { tag: 'rect', a: 'x="12" y="12" width="76" height="76" rx="3"', c: [50, 50], scale: 1 },
    2: { tag: 'polygon', a: 'points="50,10 90,79 10,79"', c: [50, 57], scale: 0.8 },
    3: { tag: 'polygon', a: 'points="50,10 90,50 50,90 10,50"', c: [50, 50], scale: 0.9 },
    4: { tag: 'polygon', a: 'points="' + polyPts(50, 50, 40, 6, 0) + '"', c: [50, 50], scale: 1 },
    5: { tag: 'polygon', a: 'points="' + polyPts(50, 52, 40, 5, -90) + '"', c: [50, 52], scale: 0.95 }
  };

  function outerSvg(id) {
    var g = OUTER[id];
    return '<' + g.tag + ' ' + g.a + ' fill="#ffffff" stroke="' + INK + '" stroke-width="2.8" stroke-linejoin="round"/>';
  }
  function clipDef(id) {
    var g = OUTER[id];
    return '<defs><clipPath id="k' + id + '"><' + g.tag + ' ' + g.a + '/></clipPath></defs>';
  }
  function ln(x1, y1, x2, y2) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + HATCH_INK + '" stroke-width="1.4"/>';
  }
  // 빗금 0 가로 1 세로 2 / 3 \ 4 격자
  function hatchLines(type) {
    var s = '', i;
    if (type === 0 || type === 4) for (i = 12; i <= 90; i += 7) s += ln(0, i, 100, i);
    if (type === 1 || type === 4) for (i = 12; i <= 90; i += 7) s += ln(i, 0, i, 100);
    if (type === 2) for (i = 0; i <= 200; i += 9) s += ln(i, 0, i - 100, 100);
    if (type === 3) for (i = 0; i <= 200; i += 9) s += ln(i - 100, 0, i, 100);
    return s;
  }

  // 안쪽 도형 0 원 1 사각 2 삼각 3 마름모 4 십자
  function innerSvg(shape, cx, cy, r, fill) {
    var st = 'fill="' + FILLS[fill] + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"';
    if (shape === 0) return '<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + f1(r) + '" ' + st + '/>';
    if (shape === 1) {
      return '<rect x="' + f1(cx - r * 0.9) + '" y="' + f1(cy - r * 0.9) + '" width="' + f1(r * 1.8) + '" height="' + f1(r * 1.8) + '" ' + st + '/>';
    }
    if (shape === 2) return '<polygon points="' + polyPts(cx, cy + r * 0.2, r * 1.25, 3, -90) + '" ' + st + '/>';
    if (shape === 3) return '<polygon points="' + polyPts(cx, cy, r * 1.3, 4, -90) + '" ' + st + '/>';
    var L = r * 1.2, t = r * 0.42;
    var p = [[-t, -L], [t, -L], [t, -t], [L, -t], [L, t], [t, t], [t, L], [-t, L], [-t, t], [-L, t], [-L, -t], [-t, -t]]
      .map(function (q) { return f1(cx + q[0]) + ',' + f1(cy + q[1]); }).join(' ');
    return '<polygon points="' + p + '" ' + st + '/>';
  }

  var DOTS = [[50, 4], [96, 50], [50, 96], [4, 50]];
  var SLOT = [33, 50, 67];

  function renderCell(t) {
    var s = '';
    if (t.pattern >= 0) s += clipDef(t.outer);
    s += outerSvg(t.outer);
    if (t.pattern >= 0) s += '<g clip-path="url(#k' + t.outer + ')">' + hatchLines(t.pattern) + '</g>';
    if (t.inner >= 0) {
      var g = OUTER[t.outer];
      s += innerSvg(t.inner, g.c[0], g.c[1], 13 * SIZE_MUL[t.size] * g.scale, t.fill);
    }
    if (t.marks >= 0) {
      for (var i = 0; i < 9; i++) {
        if (t.marks & (1 << i)) {
          s += '<circle cx="' + SLOT[i % 3] + '" cy="' + SLOT[Math.floor(i / 3)] + '" r="6.2" fill="' + FILLS[t.fill] +
            '" stroke="' + INK + '" stroke-width="2.2"/>';
        }
      }
    }
    if (t.dot >= 0) s += '<circle cx="' + DOTS[t.dot][0] + '" cy="' + DOTS[t.dot][1] + '" r="3.2" fill="' + INK + '"/>';
    return s;
  }

  /* ───────── 속성 / 규칙 ───────── */
  var NAMES = ['outer', 'inner', 'fill', 'size', 'pattern', 'dot'];
  var ATTR = {
    outer:   { n: 3, ord: false, pool: [0, 1, 2, 3, 4, 5] },
    inner:   { n: 3, ord: false, pool: [0, 1, 2, 3, 4] },
    fill:    { n: 3, ord: true },
    size:    { n: 3, ord: true },
    pattern: { n: 3, ord: false, pool: [0, 1, 2, 3, 4] },
    dot:     { n: 4, ord: true }
  };
  var OPS = {
    or:  function (a, b) { return a | b; },
    xor: function (a, b) { return a ^ b; },
    and: function (a, b) { return a & b; },
    d12: function (a, b) { return a & ~b & 511; },
    d21: function (a, b) { return b & ~a & 511; }
  };

  function popcount(x) { var c = 0; while (x) { c += x & 1; x >>= 1; } return c; }
  function tupleKey(t) { return NAMES.map(function (n) { return t[n]; }).join('|') + '|' + t.marks; }
  function copyTuple(t) { var o = {}; NAMES.concat('marks').forEach(function (n) { o[n] = t[n]; }); return o; }

  function randSet(rng, k) {
    var idx = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, k), m = 0;
    idx.forEach(function (i) { m |= 1 << i; });
    return m;
  }

  function buildMarks(rng, level) {
    var op = rng.pick(level === 2 ? ['or', 'xor'] : ['or', 'xor', 'and', 'd12', 'd21']);
    var lo = op === 'and' ? 4 : op === 'or' || op === 'xor' ? 2 : 3, hi = op === 'and' ? 6 : op === 'or' || op === 'xor' ? 3 : 5;
    var rows = [], seen = {};
    for (var tries = 0; rows.length < 3 && tries < 300; tries++) {
      var s1 = randSet(rng, rng.range(lo, hi)), s2 = randSet(rng, rng.range(lo, hi));
      var s3 = OPS[op](s1, s2), pc = popcount(s3);
      if (pc < 1 || pc > 6 || s3 === s1 || s3 === s2 || s1 === s2) continue;
      var key = s1 + ',' + s2;
      if (seen[key]) continue;
      seen[key] = 1; rows.push([s1, s2, s3]);
    }
    return rows.length === 3 ? { op: op, rows: rows } : null;
  }

  function buildSpec(rng, level) {
    var scene = level === 1 ? 'comp' : rng.chance(level === 2 ? 0.7 : 0.5) ? 'comp' : 'overlay';
    var varying;
    if (scene === 'comp') {
      if (level === 1) varying = [rng.pick(['outer', 'inner', 'fill', 'size', 'pattern'])];
      else if (level === 2) varying = rng.shuffle(NAMES).slice(0, 2);
      else varying = rng.shuffle(NAMES).slice(0, rng.chance(0.6) ? 3 : 4);
    } else {
      var extra = ['outer', 'fill', 'dot'];
      varying = level === 2 ? (rng.chance(0.5) ? [rng.pick(extra)] : []) : rng.shuffle(extra).slice(0, rng.range(1, 2));
    }
    var spec = { scene: scene, dom: {}, attrs: {}, marks: null, varying: varying };
    ['outer', 'inner', 'pattern'].forEach(function (nm) {
      var pool = nm === 'outer' && scene === 'overlay' ? [0, 1, 4] : ATTR[nm].pool;
      spec.dom[nm] = rng.shuffle(pool).slice(0, 3);
    });
    var active = scene === 'comp' ? ['outer', 'inner', 'fill', 'size'] : ['outer', 'fill'];
    varying.forEach(function (v) { if (active.indexOf(v) < 0) active.push(v); });
    NAMES.forEach(function (nm) {
      if (active.indexOf(nm) < 0) { spec.attrs[nm] = null; return; }
      var n = ATTR[nm].n, a = rng.int(n), dr = 0, dc = 0;
      if (varying.indexOf(nm) >= 0) {
        do { dr = rng.int(n); dc = rng.int(n); } while ((dr === 0 && dc === 0) || (level === 1 && dc === 0));
      }
      spec.attrs[nm] = { a: a, dr: dr, dc: dc };
    });
    if (scene === 'overlay') {
      spec.marks = buildMarks(rng, level);
      if (!spec.marks) return null;
    }
    return spec;
  }

  function gridCell(spec, r, c) {
    var t = {};
    NAMES.forEach(function (nm) {
      var at = spec.attrs[nm];
      if (!at) { t[nm] = -1; return; }
      var idx = (at.a + at.dr * r + at.dc * c) % ATTR[nm].n;
      t[nm] = ATTR[nm].ord ? idx : spec.dom[nm][idx];
    });
    t.marks = spec.marks ? spec.marks.rows[r][c] : -1;
    return t;
  }

  /* ───────── 풀이기: 보이는 8칸만 보고 9번째를 추론 (정답이 하나로 정해지는지 검사) ───────── */
  function perms3(a) {
    return [[a[0], a[1], a[2]], [a[0], a[2], a[1]], [a[1], a[0], a[2]], [a[1], a[2], a[0]], [a[2], a[0], a[1]], [a[2], a[1], a[0]]];
  }

  // 값 배열(9칸, 마지막 칸은 무시) → 규칙 (a + dr·행 + dc·열) mod n 에 맞는 모든 가설의 예측값. 판단 불가면 null
  function predictAttr(nm, vals) {
    var A = ATTR[nm], n = A.n, preds = {}, maps;
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

  function solveGrid(cells) {
    var pred = {}, ok = true;
    NAMES.forEach(function (nm) {
      if (cells[0][nm] === -1) { pred[nm] = -1; return; }
      var p = predictAttr(nm, cells.map(function (c) { return c[nm]; }));
      if (!p || p.length !== 1) ok = false; else pred[nm] = p[0];
    });
    if (cells[0].marks === -1) pred.marks = -1;
    else {
      var m = cells.map(function (c) { return c.marks; }), res = {};
      Object.keys(OPS).forEach(function (k) {
        var f = OPS[k], good = true;
        for (var r = 0; r < 2; r++) if (f(m[r * 3], m[r * 3 + 1]) !== m[r * 3 + 2]) good = false;
        if (good) res[f(m[6], m[7])] = 1;
      });
      var ks = Object.keys(res);
      if (ks.length !== 1) ok = false; else pred.marks = +ks[0];
    }
    return { ok: ok, pred: pred };
  }

  /* ───────── 보기 (정답 1 + 오답 5) ───────── */
  function domainOf(spec, nm) { return ATTR[nm].ord ? (nm === 'dot' ? [0, 1, 2, 3] : [0, 1, 2]) : spec.dom[nm]; }

  function makeOptions(rng, correct, cells, spec, level) {
    var seen = {}; seen[tupleKey(correct)] = true;
    var out = [];
    function add(t) { var k = tupleKey(t); if (seen[k]) return false; seen[k] = true; out.push(t); return true; }

    var active = NAMES.filter(function (nm) { return correct[nm] !== -1; });
    var singles = [];
    active.forEach(function (nm) {
      domainOf(spec, nm).forEach(function (v) {
        if (v !== correct[nm]) { var t = copyTuple(correct); t[nm] = v; singles.push(t); }
      });
    });
    var opResults = [];
    if (spec.marks) {
      for (var i = 0; i < 9; i++) {
        var m = correct.marks ^ (1 << i);
        if (popcount(m) >= 1) { var tt = copyTuple(correct); tt.marks = m; singles.push(tt); }
      }
      Object.keys(OPS).forEach(function (k) {
        var m2 = OPS[k](cells[6].marks, cells[7].marks);
        if (m2 && m2 !== correct.marks) { var t2 = copyTuple(correct); t2.marks = m2; opResults.push(t2); }
      });
    }
    singles = rng.shuffle(singles);
    var neighbors = rng.shuffle([cells[7], cells[5]].map(copyTuple));

    var wantNb = level === 3 ? 2 : 1;
    neighbors.slice(0, wantNb).forEach(add);
    rng.shuffle(opResults).slice(0, 2).forEach(add);
    for (var j = 0; j < singles.length && out.length < (level === 1 ? 5 : 4); j++) add(singles[j]);

    var guard = 0;
    while (out.length < 5 && guard++ < 400) {
      var a = rng.pick(active), b = rng.pick(active);
      if (a === b) continue;
      var base = copyTuple(correct);
      base[a] = rng.pick(domainOf(spec, a).filter(function (v) { return v !== correct[a]; }));
      base[b] = rng.pick(domainOf(spec, b).filter(function (v) { return v !== correct[b]; }));
      add(base);
    }
    for (j = 0; j < singles.length && out.length < 5; j++) add(singles[j]);
    if (out.length < 5) return null;

    var all = rng.shuffle([correct].concat(out.slice(0, 5)));
    return { options: all, answer: all.indexOf(correct) };
  }

  /* ───────── 문제 / 시험 생성 ───────── */
  function genMatrix(rng, level) {
    for (var tries = 0; tries < 300; tries++) {
      var spec = buildSpec(rng, level);
      if (!spec) continue;
      var cells = [];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cells.push(gridCell(spec, r, c));
      var sol = solveGrid(cells);
      if (!sol.ok) continue;
      var correct = cells[8], same = sol.pred.marks === correct.marks;
      NAMES.forEach(function (nm) { if (sol.pred[nm] !== correct[nm]) same = false; });
      if (!same) continue;
      var op = makeOptions(rng, correct, cells, spec, level);
      if (!op) continue;
      return {
        type: 'matrix', level: level, answer: op.answer,
        score: level + Math.min(0.9, 0.12 * spec.varying.length + (spec.marks ? 0.25 : 0)),
        fp: 'M' + level + JSON.stringify([spec.scene, spec.dom, spec.attrs, spec.marks]),
        cells: cells.slice(0, 8).map(renderCell), options: op.options.map(renderCell),
        _data: { cells: cells, options: op.options, scene: spec.scene }
      };
    }
    throw new Error('matrix generation failed');
  }

  function generateProblem(type, level, seed) {
    var p = genMatrix(makeRng(seed), level);
    p.seed = seed;
    return p;
  }

  var PLAN = [[1, 10], [2, 12], [3, 8]];

  // 한 번의 시험: 쉬움 10 → 보통 12 → 어려움 8, 각 구간 안에서도 쉬운 것부터. 한 시험 안에 같은 문제 없음.
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
    solveGrid: solveGrid, tupleKey: tupleKey, TOTAL: 30, LEVELS: PLAN
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MensaGen = api;
})(typeof self !== 'undefined' ? self : this);
