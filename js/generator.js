/* 멘사 스타일 문제 생성기 — 브라우저와 Node 양쪽에서 동작 (ES 모듈 아님: file:// 에서도 열리도록)
 *
 * 문제는 "저장된 목록"이 아니라 규칙 조합으로 매번 새로 만들어집니다.
 * 같은 seed → 같은 문제 (재현 가능). 정답은 규칙에서 계산되고, 보기는 서로 다르게 렌더링됩니다.
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

  function seqOf(n, fn) { var o = []; for (var i = 0; i < n; i++) o.push(fn(i)); return o; }

  /* ───────── 도형 렌더링 (SVG 안쪽 마크업, viewBox 0 0 100 100) ───────── */
  var INK = '#273142';
  var FILLS = ['#ffffff', '#b9c3d3', '#273142'];
  var SIZE_MUL = [0.6, 0.8, 1];
  var LAYOUT = {
    1: { r: 30, pos: [[50, 50]] },
    2: { r: 15, pos: [[30, 50], [70, 50]] },
    3: { r: 14, pos: [[50, 29], [29, 69], [71, 69]] },
    4: { r: 13, pos: [[30, 30], [70, 30], [30, 70], [70, 70]] },
    5: { r: 11, pos: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]] },
    6: { r: 10.5, pos: [[22, 33], [50, 33], [78, 33], [22, 67], [50, 67], [78, 67]] }
  };
  var DOTS = [[50, 6], [94, 50], [50, 94], [6, 50]];

  function f1(n) { return Math.round(n * 10) / 10; }

  function polyPts(cx, cy, r, n, rotDeg) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var ang = (rotDeg + i * 360 / n) * Math.PI / 180;
      pts.push(f1(cx + r * Math.cos(ang)) + ',' + f1(cy + r * Math.sin(ang)));
    }
    return pts.join(' ');
  }

  // shape: 0 원 1 사각 2 삼각 3 마름모 4 오각 5 육각
  function figure(shape, cx, cy, r, fill, angle) {
    var st = 'fill="' + FILLS[fill] + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"';
    var s;
    if (shape === 0) {
      s = '<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + f1(r) + '" ' + st + '/>';
    } else if (shape === 1) {
      s = '<rect x="' + f1(cx - r * 0.88) + '" y="' + f1(cy - r * 0.88) + '" width="' + f1(r * 1.76) +
        '" height="' + f1(r * 1.76) + '" ' + st + '/>';
    } else if (shape === 2) {
      s = '<polygon points="' + polyPts(cx, cy, r * 1.15, 3, -90) + '" ' + st + '/>';
    } else if (shape === 3) {
      s = '<polygon points="' + polyPts(cx, cy, r * 1.15, 4, -90) + '" ' + st + '/>';
    } else if (shape === 4) {
      s = '<polygon points="' + polyPts(cx, cy, r * 1.05, 5, -90) + '" ' + st + '/>';
    } else {
      s = '<polygon points="' + polyPts(cx, cy, r * 1.05, 6, 0) + '" ' + st + '/>';
    }
    if (angle >= 0) {
      var a = angle * 45 * Math.PI / 180, L = r * 0.8;
      s += '<line x1="' + f1(cx - L * Math.cos(a)) + '" y1="' + f1(cy - L * Math.sin(a)) +
        '" x2="' + f1(cx + L * Math.cos(a)) + '" y2="' + f1(cy + L * Math.sin(a)) +
        '" stroke="' + (fill === 2 ? '#ffffff' : INK) + '" stroke-width="2.2" stroke-linecap="round"/>';
    }
    return s;
  }

  function renderCell(t) {
    var lay = LAYOUT[t.count], r = lay.r * SIZE_MUL[t.size], s = '';
    for (var i = 0; i < lay.pos.length; i++) s += figure(t.shape, lay.pos[i][0], lay.pos[i][1], r, t.fill, t.angle);
    if (t.dot >= 0) s += '<circle cx="' + DOTS[t.dot][0] + '" cy="' + DOTS[t.dot][1] + '" r="4" fill="' + INK + '"/>';
    return s;
  }

  var NAMES = ['shape', 'fill', 'size', 'count', 'angle', 'dot'];
  var CORE = ['shape', 'fill', 'size', 'count'];
  var N_OF = { shape: 3, fill: 3, size: 3, count: 3, angle: 4, dot: 4 };

  function tupleKey(t) { return NAMES.map(function (n) { return t[n]; }).join('|'); }

  /* ───────── 도형 문제 공통: 속성 선택 / 보기 만들기 ───────── */
  function pickVarying(rng, level) {
    if (level === 1) return [rng.pick(CORE)];
    var sh = rng.shuffle(NAMES);
    if (level === 2) return sh.slice(0, 2);
    return sh.slice(0, rng.chance(0.65) ? 3 : 4);
  }

  function domainOf(spec, nm) {
    if (nm === 'shape') return spec.shapes;
    if (nm === 'count') return spec.attrs.count && spec.attrs.count.sum ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
    if (nm === 'angle' || nm === 'dot') return [0, 1, 2, 3];
    return [0, 1, 2];
  }

  // 정답 + 오답 5개 → 섞어서 [옵션 튜플들, 정답 인덱스]
  function makeOptions(rng, correct, spec, level) {
    var active = NAMES.filter(function (nm) { return spec.attrs[nm]; });
    var seen = {}; seen[tupleKey(correct)] = true;
    var distract = [];

    function add(t) {
      var k = tupleKey(t);
      if (seen[k]) return false;
      seen[k] = true; distract.push(t); return true;
    }
    function withChange(base, nm) {
      var vals = domainOf(spec, nm).filter(function (v) { return v !== base[nm]; });
      var t = {}; NAMES.forEach(function (n) { t[n] = base[n]; });
      t[nm] = rng.pick(vals); return t;
    }

    var singles = [];
    active.forEach(function (nm) {
      domainOf(spec, nm).forEach(function (v) {
        if (v !== correct[nm]) { var t = {}; NAMES.forEach(function (n) { t[n] = correct[n]; }); t[nm] = v; singles.push(t); }
      });
    });
    singles = rng.shuffle(singles);
    var wantSingles = level === 1 ? 5 : 3;
    for (var i = 0; i < singles.length && distract.length < wantSingles; i++) add(singles[i]);

    var guard = 0;
    while (distract.length < 5 && guard++ < 400) {
      var a = rng.pick(active), b = rng.pick(active);
      if (a === b) continue;
      add(withChange(withChange(correct, a), b));
    }
    for (i = 0; i < singles.length && distract.length < 5; i++) add(singles[i]);

    var all = rng.shuffle([correct].concat(distract.slice(0, 5)));
    return { options: all, answer: all.indexOf(correct) };
  }

  /* ───────── 3×3 도형 행렬 ───────── */
  function buildGridSpec(rng, level) {
    var varying = pickVarying(rng, level);
    var sumCount = level === 3 && varying.indexOf('count') >= 0 && varying.indexOf('angle') < 0 && rng.chance(0.5);
    var spec = { shapes: rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3), attrs: {}, sum: sumCount };

    NAMES.forEach(function (nm) {
      var n = N_OF[nm], isVar = varying.indexOf(nm) >= 0;
      if (nm === 'count' && sumCount) {
        var pairs = [], keys = {};
        while (pairs.length < 3) {
          var x = rng.range(1, 3), y = rng.range(1, 3), k = x + ',' + y;
          if (!keys[k]) { keys[k] = 1; pairs.push([x, y]); }
        }
        spec.attrs.count = { sum: true, pairs: pairs };
      } else if (isVar) {
        var dr, dc;
        do { dr = rng.int(n); dc = rng.int(n); } while ((dr === 0 && dc === 0) || (level === 1 && dc === 0));
        spec.attrs[nm] = { n: n, a: rng.int(n), dr: dr, dc: dc };
      } else if (nm === 'angle' || nm === 'dot') {
        spec.attrs[nm] = null;
      } else {
        spec.attrs[nm] = { n: n, a: rng.int(n), dr: 0, dc: 0 };
      }
    });
    spec.varying = varying;
    return spec;
  }

  function gridCell(spec, r, c) {
    var t = {};
    NAMES.forEach(function (nm) {
      var at = spec.attrs[nm];
      if (!at) { t[nm] = -1; return; }
      if (at.sum) { t.count = c === 0 ? at.pairs[r][0] : c === 1 ? at.pairs[r][1] : at.pairs[r][0] + at.pairs[r][1]; return; }
      var idx = (at.a + at.dr * r + at.dc * c) % at.n;
      t[nm] = nm === 'shape' ? spec.shapes[idx] : nm === 'count' ? idx + 1 : idx;
    });
    return t;
  }

  function genMatrix(rng, level) {
    var spec = buildGridSpec(rng, level);
    var cells = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cells.push(gridCell(spec, r, c));
    var correct = cells[8];
    var op = makeOptions(rng, correct, spec, level);
    var score = level + Math.min(0.9, 0.12 * spec.varying.length + (spec.sum ? 0.2 : 0));
    return {
      type: 'matrix', level: level, score: score, answer: op.answer,
      fp: 'M' + level + JSON.stringify([spec.shapes, spec.attrs]),
      cells: cells.slice(0, 8).map(renderCell),
      options: op.options.map(renderCell),
      _data: { cells: cells, options: op.options }
    };
  }

  /* ───────── 도형 수열 (5개 보고 6번째 맞히기) ───────── */
  function bounceIdx(n, p, i) { var per = 2 * (n - 1), j = (p + i) % per; return j < n ? j : per - j; }

  function genFigSeq(rng, level) {
    var varying = pickVarying(rng, level);
    var spec = { shapes: rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3), attrs: {} };
    var bounceAt = level === 3 ? rng.pick(varying) : null;
    NAMES.forEach(function (nm) {
      var n = N_OF[nm];
      if (varying.indexOf(nm) >= 0) {
        if (nm === bounceAt) spec.attrs[nm] = { kind: 'bounce', n: n, p: rng.int(2 * (n - 1)) };
        else spec.attrs[nm] = { kind: 'lin', n: n, a: rng.int(n), d: rng.range(1, n - 1) };
      } else if (nm === 'angle' || nm === 'dot') spec.attrs[nm] = null;
      else spec.attrs[nm] = { kind: 'const', n: n, a: rng.int(n) };
    });

    function cell(i) {
      var t = {};
      NAMES.forEach(function (nm) {
        var at = spec.attrs[nm];
        if (!at) { t[nm] = -1; return; }
        var idx = at.kind === 'const' ? at.a : at.kind === 'lin' ? (at.a + at.d * i) % at.n : bounceIdx(at.n, at.p, i);
        t[nm] = nm === 'shape' ? spec.shapes[idx] : nm === 'count' ? idx + 1 : idx;
      });
      return t;
    }
    var cells = seqOf(6, cell);
    var op = makeOptions(rng, cells[5], spec, level);
    return {
      type: 'figseq', level: level, score: level + Math.min(0.9, 0.15 * varying.length + (bounceAt ? 0.2 : 0)),
      answer: op.answer, fp: 'F' + level + JSON.stringify([spec.shapes, spec.attrs]),
      cells: cells.slice(0, 5).map(renderCell), options: op.options.map(renderCell),
      _data: { cells: cells, options: op.options }
    };
  }

  /* ───────── 숫자 수열 ───────── */
  function diffs(t) { var o = []; for (var i = 1; i < t.length; i++) o.push(t[i] - t[i - 1]); return o; }
  function allEq(a) { for (var i = 1; i < a.length; i++) if (a[i] !== a[0]) return false; return a.length > 0; }

  // 단순 규칙들 중 "보여준 항에 모두 들어맞는" 규칙이 예측하는 다음 값들. 출제 의도와 다른 답이 나오면 그 문제는 버린다.
  function predictNext(t) {
    var m = t.length, preds = [], d1 = diffs(t), d2 = diffs(d1), d3 = diffs(d2);
    if (allEq(d1)) preds.push(t[m - 1] + d1[0]);
    if (d2.length >= 2 && allEq(d2)) preds.push(t[m - 1] + d1[d1.length - 1] + d2[0]);
    if (d3.length >= 2 && allEq(d3)) {
      var n2 = d2[d2.length - 1] + d3[0], n1 = d1[d1.length - 1] + n2;
      preds.push(t[m - 1] + n1);
    }
    if (m >= 3 && t[0] !== 0) {
      var geo = true;
      for (var i = 1; i < m - 1; i++) if (t[i + 1] * t[0] !== t[i] * t[1]) { geo = false; break; }
      if (geo && (t[m - 1] * t[1]) % t[0] === 0) preds.push(t[m - 1] * t[1] / t[0]);
    }
    if (m >= 4) {
      var fib = true;
      for (i = 2; i < m; i++) if (t[i] !== t[i - 1] + t[i - 2]) { fib = false; break; }
      if (fib) preds.push(t[m - 1] + t[m - 2]);
      var a = t[1] - t[0], b = t[2] - t[1];
      if (a !== 0 && b % a === 0) {
        var k = b / a, j = t[1] - k * t[0], lin = true;
        for (i = 1; i < m; i++) if (t[i] !== k * t[i - 1] + j) { lin = false; break; }
        if (lin) preds.push(k * t[m - 1] + j);
      }
    }
    if (m >= 5) {
      var sub = t.filter(function (_, i) { return (i % 2) === (m % 2); });
      if (sub.length >= 3) {
        var ds = diffs(sub);
        if (allEq(ds)) preds.push(sub[sub.length - 1] + ds[0]);
        if (sub[0] !== 0) {
          var g = true;
          for (i = 1; i < sub.length - 1; i++) if (sub[i + 1] * sub[0] !== sub[i] * sub[1]) { g = false; break; }
          if (g && (sub[sub.length - 1] * sub[1]) % sub[0] === 0) preds.push(sub[sub.length - 1] * sub[1] / sub[0]);
        }
      }
    }
    return preds;
  }

  var PRIMES = [2, 3, 5, 7, 11, 13, 17, 19];
  var SGEN = {
    arith: function (r) {
      var neg = r.chance(0.3), d = r.range(2, 14) * (neg ? -1 : 1), s = neg ? r.range(70, 160) : r.range(1, 99);
      return { t: seqOf(6, function (i) { return s + d * i; }), shown: 5, sc: 0.1 };
    },
    geo: function (r) {
      var q = r.pick([2, 3, 4]), s = r.range(1, 9);
      return { t: seqOf(6, function (i) { return s * Math.pow(q, i); }), shown: 5, sc: 0.3 };
    },
    altpm: function (r) {
      var a = r.range(4, 16), b = r.range(1, a - 1), t = [r.range(5, 70)];
      for (var i = 1; i < 7; i++) t.push(t[i - 1] + (i % 2 ? a : -b));
      return { t: t, shown: 6, sc: 0.5 };
    },
    quad: function (r) {
      var d0 = r.range(1, 8), c = r.range(1, 5), t = [r.range(1, 30)];
      for (var i = 0; i < 6; i++) t.push(t[i] + d0 + c * i);
      return { t: t, shown: 6, sc: 0.1 };
    },
    fib: function (r) {
      var a = r.range(1, 12), b = r.range(1, 12); if (b === a) b++;
      var t = [a, b]; for (var i = 2; i < 7; i++) t.push(t[i - 1] + t[i - 2]);
      return { t: t, shown: 6, sc: 0.3 };
    },
    linrec: function (r) {
      var k = r.pick([2, 3, 4]), j = r.pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]), t = [r.range(2, 9)];
      for (var i = 1; i < 7; i++) t.push(k * t[i - 1] + j);
      return { t: t, shown: 6, sc: 0.5 };
    },
    interleave: function (r) {
      var a0 = r.range(1, 40), da = r.range(2, 12), b0 = r.range(1, 40), db = r.range(2, 13);
      return { t: seqOf(8, function (i) { return i % 2 ? b0 + db * ((i - 1) / 2) : a0 + da * (i / 2); }), shown: 7, sc: 0.7 };
    },
    cube: function (r) {
      var s = r.range(1, 4), c = r.range(0, 40);
      return { t: seqOf(7, function (i) { return Math.pow(i + s, 3) + c; }), shown: 6, sc: 0.2 };
    },
    altops: function (r) {
      var q = r.pick([2, 3]), b = r.range(1, 12), t = [r.range(1, 12)];
      for (var i = 1; i < 8; i++) t.push(i % 2 ? t[i - 1] * q : t[i - 1] + b);
      return { t: t, shown: 7, sc: 0.5 };
    },
    imix: function (r) {
      var s = r.range(1, 5), q = r.pick([2, 3]), b0 = r.range(1, 60), db = r.range(2, 14);
      return { t: seqOf(9, function (i) { return i % 2 ? b0 + db * ((i - 1) / 2) : s * Math.pow(q, i / 2); }), shown: 8, sc: 0.8 };
    },
    sqdiff: function (r) {
      var s = r.range(0, 3), t = [r.range(1, 40)];
      for (var i = 1; i < 7; i++) t.push(t[i - 1] + Math.pow(i + s, 2));
      return { t: t, shown: 6, sc: 0.4 };
    },
    fibplus: function (r) {
      var c = r.range(1, 6), t = [r.range(1, 9), r.range(1, 9)];
      for (var i = 2; i < 7; i++) t.push(t[i - 1] + t[i - 2] + c);
      return { t: t, shown: 6, sc: 0.6 };
    },
    primes: function (r) {
      var t = [r.range(1, 60)];
      for (var i = 1; i < 8; i++) t.push(t[i - 1] + PRIMES[i - 1]);
      return { t: t, shown: 7, sc: 0.9 };
    }
  };
  var SLEVEL = { 1: ['arith', 'geo', 'altpm'], 2: ['quad', 'fib', 'linrec', 'interleave'], 3: ['cube', 'altops', 'imix', 'sqdiff', 'fibplus', 'primes'] };

  function numericOptions(rng, answer, extras, avoid) {
    var seen = {}; seen[answer] = true;
    (avoid || []).forEach(function (v) { seen[v] = true; });
    var cand = rng.shuffle(extras.filter(function (v) { return isFinite(v) && Math.floor(v) === v && Math.abs(v) < 1e6; }));
    var out = [];
    cand.forEach(function (v) { if (!seen[v] && out.length < 5) { seen[v] = true; out.push(v); } });
    var guard = 0;
    while (out.length < 5 && guard++ < 200) {
      var v = answer + rng.range(-15, 15);
      if (!seen[v] && v >= 0) { seen[v] = true; out.push(v); }
    }
    var all = rng.shuffle([answer].concat(out));
    return { options: all, answer: all.indexOf(answer) };
  }

  function genSeries(rng, level) {
    for (var tries = 0; tries < 80; tries++) {
      var key = rng.pick(SLEVEL[level]), g = SGEN[key](rng);
      var shown = g.t.slice(0, g.shown), ans = g.t[g.shown];
      var ok = g.t.every(function (v) { return v >= 0 && v < 20000; });
      if (!ok) continue;
      var preds = predictNext(shown);
      if (preds.some(function (p) { return p !== ans; })) continue;
      var last = shown[shown.length - 1], ld = last - shown[shown.length - 2], fd = shown[1] - shown[0];
      var extras = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 3, ans - 3, last + ld, last + fd, last * 2, last + 1,
        last + ld + 1, last + ld - 1, ans + ld, ans - ld, ans * 2, last + (ans - last) * 2];
      var op = numericOptions(rng, ans, extras, shown);
      if (op.options.length !== 6) continue;
      return {
        type: 'series', level: level, score: level + g.sc, answer: op.answer,
        fp: 'S' + key + shown.join(','), shown: shown, options: op.options
      };
    }
    throw new Error('series generation failed');
  }

  /* ───────── 숫자 표 (각 행에 같은 규칙) ───────── */
  var NG = [
    { id: 'add', lv: 1, f: function (a, b) { return a + b; }, gen: function (r) { return [r.range(2, 20), r.range(2, 20)]; } },
    { id: 'sub', lv: 1, f: function (a, b) { return a - b; }, gen: function (r) { var b = r.range(2, 15); return [b + r.range(2, 20), b]; } },
    { id: 'mul', lv: 1, f: function (a, b) { return a * b; }, gen: function (r) { return [r.range(2, 9), r.range(2, 9)]; } },
    { id: '2ab', lv: 1, f: function (a, b) { return 2 * a + b; }, gen: function (r) { return [r.range(2, 15), r.range(2, 15)]; } },
    { id: 'x2sum', lv: 2, f: function (a, b) { return (a + b) * 2; }, gen: function (r) { return [r.range(2, 20), r.range(2, 20)]; } },
    { id: 'mulsub', lv: 2, f: function (a, b) { return a * b - a; }, gen: function (r) { return [r.range(3, 9), r.range(2, 9)]; } },
    { id: 'muladd', lv: 2, f: function (a, b) { return a * b + b; }, gen: function (r) { return [r.range(2, 9), r.range(2, 9)]; } },
    { id: 'sqadd', lv: 2, f: function (a, b) { return a * a + b; }, gen: function (r) { return [r.range(2, 9), r.range(1, 9)]; } },
    { id: 'sqsub', lv: 3, f: function (a, b) { return a * a - b * b; }, gen: function (r) { var b = r.range(1, 8); return [r.range(b + 1, 9), b]; } },
    { id: 'sumsq', lv: 3, f: function (a, b) { return a * a + b * b; }, gen: function (r) { return [r.range(2, 9), r.range(2, 9)]; } },
    { id: 'mulsum', lv: 3, f: function (a, b) { return a * b + a + b; }, gen: function (r) { return [r.range(2, 9), r.range(2, 9)]; } },
    { id: 'sumb', lv: 3, f: function (a, b) { return (a + b) * b; }, gen: function (r) { return [r.range(2, 9), r.range(2, 9)]; } },
    { id: '3a-b', lv: 3, f: function (a, b) { return 3 * a - b; }, gen: function (r) { var b = r.range(1, 12); return [r.range(Math.ceil((b + 1) / 3), 15), b]; } }
  ];

  function genNumGrid(rng, level) {
    var pool = NG.filter(function (g) { return g.lv === level; });
    for (var tries = 0; tries < 80; tries++) {
      var rule = rng.pick(pool), rows = [], keys = {};
      while (rows.length < 3) {
        var ab = rule.gen(rng), k = ab.join(',');
        if (!keys[k]) { keys[k] = 1; rows.push([ab[0], ab[1], rule.f(ab[0], ab[1])]); }
      }
      if (rows.some(function (x) { return x[2] < 0 || x[2] > 500; })) continue;
      var ans = rows[2][2], a3 = rows[2][0], b3 = rows[2][1], clash = false, wrongs = [];
      NG.forEach(function (g) {
        var fits = g.f(rows[0][0], rows[0][1]) === rows[0][2] && g.f(rows[1][0], rows[1][1]) === rows[1][2];
        var v = g.f(a3, b3);
        if (fits && v !== ans) clash = true;
        if (!fits && v !== ans && v >= 0) wrongs.push(v);
      });
      if (clash) continue;
      var extras = wrongs.concat([ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10, ans + 3, ans - 3]);
      var op = numericOptions(rng, ans, extras, []);
      if (op.options.length !== 6) continue;
      return {
        type: 'numgrid', level: level, score: level + (pool.indexOf(rule) + 1) / (pool.length + 1) * 0.9, answer: op.answer,
        fp: 'N' + rule.id + JSON.stringify(rows), rows: [rows[0], rows[1], [rows[2][0], rows[2][1], null]], options: op.options
      };
    }
    throw new Error('numgrid generation failed');
  }

  /* ───────── 문제 / 시험 생성 ───────── */
  function generateProblem(type, level, seed) {
    var rng = makeRng(seed), p;
    if (type === 'matrix') p = genMatrix(rng, level);
    else if (type === 'figseq') p = genFigSeq(rng, level);
    else if (type === 'series') p = genSeries(rng, level);
    else p = genNumGrid(rng, level);
    p.seed = seed;
    return p;
  }

  var PLAN = [[1, 10], [2, 12], [3, 8]];
  var WEIGHTS = {
    1: [['matrix', 0.35], ['figseq', 0.30], ['series', 0.20], ['numgrid', 0.15]],
    2: [['matrix', 0.40], ['figseq', 0.25], ['series', 0.20], ['numgrid', 0.15]],
    3: [['matrix', 0.45], ['figseq', 0.25], ['series', 0.20], ['numgrid', 0.10]]
  };

  function pickType(rng, level) {
    var x = rng.next(), acc = 0, w = WEIGHTS[level];
    for (var i = 0; i < w.length; i++) { acc += w[i][1]; if (x < acc) return w[i][0]; }
    return w[0][0];
  }

  // 한 번의 시험: 쉬움 10 → 보통 12 → 어려움 8, 각 구간 안에서도 쉬운 것부터. 한 시험 안에 같은 문제 없음.
  function generateTest(seed) {
    var rng = makeRng(seed), seen = {}, out = [];
    PLAN.forEach(function (pl) {
      var level = pl[0], group = [];
      for (var n = 0; n < pl[1]; n++) {
        var p;
        for (var tries = 0; tries < 30; tries++) {
          p = generateProblem(pickType(rng, level), level, rng.int(2147483647));
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
    predictNext: predictNext, TOTAL: 30, LEVELS: PLAN
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MensaGen = api;
})(typeof self !== 'undefined' ? self : this);
