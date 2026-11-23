/* 3×3 도형 행렬 생성기 — 브라우저와 Node 양쪽에서 동작 (ES 모듈 아님: file:// 에서도 열리도록)
 *
 * 참고 테스트 35문항의 규칙 계열을 전사·검증한 설계도. 마지막 문항의 공개 풀이 참고 내역은 README에 표시한다.
 * 칸마다 규칙 계열이 다르다 (직교 → 이중 라틴 → 회전+속성 → 합성 → 겹침/XOR/분할 → 두 층 연산).
 * 문제 이미지·문항을 복사하지 않고, 규칙을 조합해 매번 새로 만든다.
 *
 * 속성형(attr)  : 도형이 여러 속성(회전, 모양, 채우기, 위치...)을 갖고, 속성마다 행/열/대각/합산 규칙이 적용된다.
 * 집합형(mask)  : 도형이 요소 집합이고, 3번째 칸 = 두 칸의 합/XOR/교집합/차집합/분할 (가운데 칸이 합집합인 배치 포함).
 * 정답은 규칙에서 계산하고, 별도 풀이기(solve)가 보이는 8칸만으로 정답이 하나로 정해지는지 다시 확인한다.
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
  function randMask(rng, nb, k) { var m = 0; rng.shuffle(bitsOf((1 << nb) - 1, nb)).slice(0, k).forEach(function (i) { m |= 1 << i; }); return m; }

  /* ───────── 그리기 도구 (viewBox 0 0 100 100, 흑백 선화) ───────── */
  var SW = 3.2, WHITE = '#ffffff', GRAY = '#8f8f8f', BLACK = '#000000';
  function f1(n) { return Math.round(n * 10) / 10; }
  function polyPts(cx, cy, r, n, rotDeg) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var ang = (rotDeg + i * 360 / n) * Math.PI / 180;
      pts.push(f1(cx + r * Math.cos(ang)) + ',' + f1(cy + r * Math.sin(ang)));
    }
    return pts.join(' ');
  }
  function L(x1, y1, x2, y2, cap, w) {
    return '<line x1="' + f1(x1) + '" y1="' + f1(y1) + '" x2="' + f1(x2) + '" y2="' + f1(y2) + '" stroke="#000" stroke-width="' + (w || SW) + '" stroke-linecap="' + (cap || 'butt') + '"/>';
  }
  function C(cx, cy, r, fill, w) {
    return '<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + f1(r) + '" fill="' + (fill || 'none') + '" stroke="#000" stroke-width="' + (w === undefined ? SW : w) + '"/>';
  }
  function Rc(x, y, w, h, fill, sw) {
    return '<rect x="' + f1(x) + '" y="' + f1(y) + '" width="' + f1(w) + '" height="' + f1(h) + '" fill="' + (fill || 'none') + '" stroke="#000" stroke-width="' + (sw === undefined ? SW : sw) + '" stroke-linejoin="round"/>';
  }
  function Pg(pts, fill, sw) {
    return '<polygon points="' + pts + '" fill="' + (fill || 'none') + '" stroke="#000" stroke-width="' + (sw === undefined ? SW : sw) + '" stroke-linejoin="round"/>';
  }
  function Pl(pts) { return '<polyline points="' + pts + '" fill="none" stroke="#000" stroke-width="' + SW + '" stroke-linejoin="round" stroke-linecap="round"/>'; }
  function Rot(deg, inner) { return '<g transform="rotate(' + deg + ' 50 50)">' + inner + '</g>'; }

  // 닫힌 도형 0 원 1 사각 2 삼각 3 마름모 4 육각
  function shapeSvg(id, fill) {
    fill = fill || WHITE;
    if (id === 0) return C(50, 50, 28, fill);
    if (id === 1) return Rc(24, 24, 52, 52, fill);
    if (id === 2) return Pg('50,20 80,74 20,74', fill);
    if (id === 3) return Pg('50,18 82,50 50,82 18,50', fill);
    return Pg(polyPts(50, 50, 30, 6, 0), fill);
  }
  // 바깥틀 0..4 닫힌 도형, 5 모서리 점 4개, 6 오목 별
  function frameSvg(id) {
    if (id <= 4) return shapeSvg(id, WHITE);
    if (id === 5) return [[24, 24], [76, 24], [24, 76], [76, 76]].map(function (p) { return C(p[0], p[1], 4.4, BLACK, 0); }).join('');
    return '<path d="M50 14 Q54 46 86 50 Q54 54 50 86 Q46 54 14 50 Q46 46 50 14 Z" fill="#fff" stroke="#000" stroke-width="' + SW + '" stroke-linejoin="round"/>';
  }
  // 안쪽 기호 0 없음 1 점 2 플러스 3 고리 4 작은 마름모 5 작은 사각
  function symbolSvg(id, cx, cy) {
    if (id === 1) return C(cx, cy, 5.6, BLACK, 0);
    if (id === 2) return L(cx - 12, cy, cx + 12, cy, 'butt') + L(cx, cy - 12, cx, cy + 12, 'butt');
    if (id === 3) return C(cx, cy, 8.5, WHITE);
    if (id === 4) return Pg(cx + ',' + (cy - 10) + ' ' + (cx + 10) + ',' + cy + ' ' + cx + ',' + (cy + 10) + ' ' + (cx - 10) + ',' + cy, WHITE);
    if (id === 5) return Rc(cx - 8, cy - 8, 16, 16, WHITE);
    return '';
  }
  // 도형을 가로지르는 선 0 가로 1 세로 2 / 3 \
  function lineSvg(d) {
    if (d === 0) return L(12, 50, 88, 50, 'butt');
    if (d === 1) return L(50, 12, 50, 88, 'butt');
    if (d === 2) return L(20, 80, 80, 20, 'butt');
    return L(20, 20, 80, 80, 'butt');
  }
  // 우산(0)·화살표(1)·깃발(2)·망치(3) 모양, 회전 45° 단위, 속 0 흰색 1 검정 2 빗금
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

  /* ───────── 속성 규칙: 클래스형(행/열/대각, 값 반복 가능) / 합산형(R[행]+C[열]) ───────── */
  function classRule(rng, kind, pat) {
    var dr = 0, dc = 0;
    if (kind === 'row') dr = rng.range(1, 2); else if (kind === 'col') dc = rng.range(1, 2);
    else { dr = rng.range(1, 2); dc = rng.range(1, 2); }
    var map = rng.shuffle([0, 1, 2]);
    if (pat) map = [map[0], map[1], map[0]];            // 값이 반복되는 3-주기 패턴 (예: 검정, 회색, 검정)
    return { t: 'class', a: rng.int(3), dr: dr, dc: dc, map: map };
  }
  function addRule(rng, n, kind) {
    var R = [0, 0, 0], C2 = [0, 0, 0], d, e;
    if (kind === 'row') { d = rng.range(1, n - 1); R = [0, d, (2 * d) % n]; }
    else if (kind === 'col') { d = rng.range(1, n - 1); C2 = [0, d, (2 * d) % n]; }
    else if (kind === 'both') {
      d = rng.range(1, n - 1); e = rng.range(1, n - 1);
      R = [0, d, (2 * d) % n]; C2 = [0, e, (2 * e) % n];
    } else {                                              // 'irreg': 증가량이 일정하지 않은 합산
      var x = rng.range(1, n - 1), y, u = rng.range(1, n - 1), w, g = 0;
      do { y = rng.range(1, n - 1); } while (y === x || y === (2 * x) % n);
      do { w = rng.range(1, n - 1); } while ((w === u || w === (2 * u) % n) && g++ < 20);
      R = [0, x, y]; C2 = [0, u, w];
    }
    return { t: 'add', n: n, base: rng.int(n), R: R, C: C2 };
  }
  function valueAt(rule, r, c) {
    if (rule.t === 'class') return rule.map[(rule.a + rule.dr * r + rule.dc * c) % 3];
    return (rule.base + rule.R[r] + rule.C[c]) % rule.n;
  }
  function usedStates(rule, n) {
    if (rule.t === 'add') { var all = []; for (var i = 0; i < n; i++) all.push(i); return all; }
    var s = []; rule.map.forEach(function (v) { if (s.indexOf(v) < 0) s.push(v); });
    return s;
  }

  // 풀이기: 클래스형 — 같은 클래스(선)의 칸은 값이 같다고 보는 모든 가설의 예측값
  function predictClass(v) {
    var preds = {};
    for (var dr = 0; dr < 3; dr++) for (var dc = 0; dc < 3; dc++) {
      var cv = [undefined, undefined, undefined], ok = true;
      for (var r = 0; r < 3 && ok; r++) for (var c = 0; c < 3; c++) {
        if (r === 2 && c === 2) continue;
        var cl = (dr * r + dc * c) % 3, x = v[r * 3 + c];
        if (cv[cl] === undefined) cv[cl] = x; else if (cv[cl] !== x) { ok = false; break; }
      }
      if (!ok) continue;
      var c22 = (2 * dr + 2 * dc) % 3;
      if (cv[c22] !== undefined) preds[cv[c22]] = 1;
    }
    return Object.keys(preds).map(Number);
  }
  // 풀이기: 합산형 — v(r,c) = base + R[r] + C[c] (mod n)
  function predictAdd(n, v) {
    var b = v[0], R1 = (v[3] - b + n) % n, R2 = (v[6] - b + n) % n, C1 = (v[1] - b + n) % n, C2 = (v[2] - b + n) % n;
    if ((b + R1 + C1) % n !== v[4] || (b + R1 + C2) % n !== v[5] || (b + R2 + C1) % n !== v[7]) return [];
    return [(b + R2 + C2) % n];
  }

  /* ───────── 보기 만들기 공통 ───────── */
  function pickOptions(rng, correct, groups, want) {
    var seen = {}; seen[correct.k] = 1;
    var out = [];
    groups.forEach(function (g) {
      g.list.forEach(function (t) {
        if (out.length >= want || g.used >= g.max) return;
        if (!t || seen[t.k]) return;
        seen[t.k] = 1; out.push(t); g.used++;
      });
    });
    if (out.length < want) return null;
    var all = rng.shuffle([correct].concat(out.slice(0, want)));
    return { options: all, answer: all.indexOf(correct) };
  }
  function grp(rng, list, max) { return { list: rng.shuffle(list), max: max, used: 0 }; }

  /* ───────── 속성형 문제 엔진 ───────── */
  // sc: { name, attrs:[{n, ord}], rules:[...], render(v)->svg, dup:true면 같은 그림이 여러 칸에 나와도 됨 }
  function genAttr(rng, sc, level) {
    var cells = [], r, c, i;
    for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) {
      var v = sc.rules.map(function (rule) { return valueAt(rule, r, c); });
      cells.push({ v: v, k: 's' + v.join('.') });
    }
    var preds = [];
    for (i = 0; i < sc.attrs.length; i++) {
      var vals = cells.map(function (x) { return x.v[i]; });
      var p = sc.attrs[i].ord ? predictAdd(sc.attrs[i].n, vals) : predictClass(vals);
      if (p.length !== 1) return null;
      preds.push(p[0]);
    }
    if (preds.join('.') !== cells[8].v.join('.')) return null;

    var keys = {}, vis = 0;
    cells.forEach(function (x, idx) { keys[x.k] = 1; if (idx < 8 && x.k === cells[8].k) vis++; });
    if (vis > 0) return null;                                    // 정답이 이미 보이는 칸과 같으면 안 됨
    if (!sc.dup && Object.keys(keys).length !== 9) return null;  // 9칸이 모두 달라야 함
    var rows = {}, cols = {};
    for (i = 0; i < 3; i++) {
      rows[[cells[i * 3].k, cells[i * 3 + 1].k, cells[i * 3 + 2].k].join('|')] = 1;
      cols[[cells[i].k, cells[3 + i].k, cells[6 + i].k].join('|')] = 1;
    }
    if (Object.keys(rows).length < 3 || Object.keys(cols).length < 3) return null;   // 줄/열이 반복되면 안 됨

    // 모든 상태가 눈으로 구분되는지 (속성 하나만 바꿔 렌더링이 서로 달라야 함)
    for (i = 0; i < sc.attrs.length; i++) {
      var seenR = {};
      for (var s = 0; s < sc.attrs[i].n; s++) {
        var vv = cells[8].v.slice(); vv[i] = s;
        var key = sc.render(vv);
        if (seenR[key]) return null;
        seenR[key] = 1;
      }
    }

    function mk(v) { return { v: v, k: 's' + v.join('.') }; }
    var cor = cells[8], singles = [], dbl = [];
    sc.attrs.forEach(function (a, ai) {
      var st = sc.used[ai];
      st.forEach(function (s) { if (s !== cor.v[ai]) { var v2 = cor.v.slice(); v2[ai] = s; singles.push(mk(v2)); } });
    });
    for (var g = 0; g < 50; g++) {
      var a1 = rng.int(sc.attrs.length), a2 = rng.int(sc.attrs.length);
      if (a1 === a2) continue;
      var v3 = cor.v.slice();
      v3[a1] = rng.pick(sc.used[a1]); v3[a2] = rng.pick(sc.used[a2]);
      dbl.push(mk(v3));
    }
    var nbrs = [cells[7], cells[5]].map(function (x) { return mk(x.v.slice()); });
    var opt = pickOptions(rng, cor, [grp(rng, nbrs, level >= 3 ? 2 : 1), grp(rng, singles, 4), grp(rng, dbl, 5), grp(rng, singles, 5)], 5);
    if (!opt) return null;
    return {
      family: sc.name, cells: cells, options: opt.options, answer: opt.answer, render: function (d) { return sc.render(d.v); },
      spec: [sc.name, sc.rules, sc.sig], score: 0, meta: { kind: 'attr', attrs: sc.attrs }
    };
  }

  function solveAttr(d) {
    var cells = d.cells, vals = [], ok = true;
    d.meta.attrs.forEach(function (a, i) {
      var arr = cells.map(function (x) { return x.v[i]; });
      var p = a.ord ? predictAdd(a.n, arr) : predictClass(arr);
      if (p.length !== 1) ok = false; else vals.push(p[0]);
    });
    if (!ok) return { ok: false };
    var key = 's' + vals.join('.');
    return { ok: true, match: function (o) { return o.k === key; } };
  }

  /* ───────── 속성형 장면들 ───────── */
  // 위/아래 점 묶음은 서로 독립적인 3주기 패턴 (Q7).
  function sceneDotGroups(rng) {
    var groups = rng.shuffle([[0, 4], [2], [1, 2, 3]]);
    return { name: 'dot-groups', attrs: [{ n: 3, ord: false }, { n: 3, ord: false }],
      rules: [classRule(rng, 'latin'), classRule(rng, 'latin')], dup: false,
      used: [[0, 1, 2], [0, 1, 2]], sig: [groups], render: function (v) {
        var s = ''; for (var i = 0; i < 5; i++) s += C(18 + i * 16, 50, 4.5, BLACK, 0);
        [0, 1].forEach(function (j) { groups[v[j]].forEach(function (x) { s += C(18 + x * 16, j ? 66 : 34, 4.5, BLACK, 0); }); });
        return s;
      } };
  }
  function sceneHalfArrow(rng) {
    var fillRule=classRule(rng,rng.pick(['row','col']),true), first=rng.int(2);fillRule.map=[first,1-first,first];
    return { name: 'half-arrow', attrs: [{ n: 4, ord: true }, { n: 2, ord: false }],
      rules: [addRule(rng, 4, 'both'), fillRule], dup: true,
      used: [[0, 1, 2, 3], [0, 1]], sig: [], render: function (v) {
        var left = v[1] === 0, right = v[1] === 1;
        return Rot(v[0] * 90, Pg('50,14 22,80 50,64', left ? BLACK : WHITE) + Pg('50,14 78,80 50,64', right ? BLACK : WHITE));
      } };
  }
  function sceneLineCounts(rng) {
    // Keep counts within 0..4 so the arithmetic never wraps on the page.
    var h = rng.shuffle([0, 1, 2]), v = rng.shuffle([0, 1, 2]), ch = rng.shuffle([0, 1, 2]), cv = rng.shuffle([0, 1, 2]);
    return { name: 'line-counts', attrs: [{ n: 5, ord: true }, { n: 5, ord: true }],
      rules: [{ t: 'add', n: 5, base: 0, R: h, C: ch }, { t: 'add', n: 5, base: 0, R: v, C: cv }], dup: true,
      used: [[0, 1, 2, 3, 4], [0, 1, 2, 3, 4]], sig: [], render: function (a) {
        var s = ''; for (var i = 0; i < a[0]; i++) { var y = 50 + (i - (a[0] - 1) / 2) * 13; s += L(18, y, 82, y, 'butt'); }
        for (var j = 0; j < a[1]; j++) { var x = 50 + (j - (a[1] - 1) / 2) * 13; s += L(x, 18, x, 82, 'butt'); } return s;
      } };
  }
  function ruleKinds(rng, pattern) {
    if (pattern === 'orth') return rng.chance(0.5) ? ['row', 'col'] : ['col', 'row'];
    if (pattern === 'mix') return rng.chance(0.5) ? ['row', 'latin'] : ['latin', 'col'];
    return ['latin', 'latin'];
  }
  function pickN(rng, pool, n) { return rng.shuffle(pool).slice(0, n); }

  // 바깥 도형 × 안쪽 기호 / 도형 × 채우기 / 도형 × 가로지르는 선  (Q1, Q2, Q12, Q13)
  function sceneFrameSym(rng, level, variant, pattern) {
    var kinds = ruleKinds(rng, pattern), rules = kinds.map(function (k) { return classRule(rng, k, false); });
    var d0, d1, render;
    if (variant === 'sym') {
      d0 = pickN(rng, [0, 1, 2, 3, 4, 5, 6], 3); d1 = pickN(rng, [0, 1, 2, 3, 4, 5], 3);
      render = function (v) { var f = d0[v[0]]; return frameSvg(f) + symbolSvg(d1[v[1]], 50, f === 2 ? 58 : 50); };
    } else if (variant === 'fill') {
      d0 = pickN(rng, [0, 1, 2, 3, 4], 3); d1 = rng.shuffle([WHITE, GRAY, BLACK]);
      render = function (v) { return shapeSvg(d0[v[0]], d1[v[1]]); };
    } else {
      d0 = pickN(rng, [0, 1, 2, 3, 4], 3); d1 = pickN(rng, [0, 1, 2, 3], 3);
      render = function (v) { return shapeSvg(d0[v[0]], WHITE) + lineSvg(d1[v[1]]); };
    }
    return { name: 'frame-' + variant, attrs: [{ n: 3, ord: false }, { n: 3, ord: false }], rules: rules, render: render, dup: false,
      used: [[0, 1, 2], [0, 1, 2]], sig: [d0, d1] };
  }

  // 막대 + 머리(망치/화살촉): 회전(45° 단위) × 머리 위치(끝/가운데/반대 끝)  (Q3, Q4)
  function sceneStick(rng, level, head, pattern) {
    var rotKind = pattern === 'orth' ? (rng.chance(0.5) ? 'row' : 'col') : 'both';
    var rules = [addRule(rng, 4, rotKind), classRule(rng, rotKind === 'row' ? 'col' : (rotKind === 'col' ? 'row' : 'latin'), false)];
    var dom = rng.shuffle([0, 1, 2]), X = [20, 50, 80];
    var render = function (v) {
      var x = X[dom[v[1]]], inner = L(12, 50, 88, 50, 'butt');
      inner += head === 'hammer' ? Rc(x - 5, 39, 10, 22, BLACK, 0) : Pl((x - 10) + ',40 ' + x + ',50 ' + (x - 10) + ',60');
      return Rot(v[0] * 45, inner);
    };
    return { name: 'stick-' + head, attrs: [{ n: 4, ord: true }, { n: 3, ord: false }], rules: rules, render: render, dup: false,
      used: [[0, 1, 2, 3], [0, 1, 2]], sig: [dom, head] };
  }

  // 십자 + 점 + 네모: 네모 위치(사분면) × 점 위치  (Q8)
  function sceneQuadrant(rng, level) {
    var k1 = rng.chance(0.5) ? 'row' : 'col', rules = [addRule(rng, 4, k1), addRule(rng, 4, k1 === 'row' ? 'col' : 'row')];
    var Q = [[68, 32], [68, 68], [32, 68], [32, 32]];
    var render = function (v) {
      var s = L(50, 16, 50, 84, 'butt') + L(16, 50, 84, 50, 'butt');
      s += Rc(Q[v[0]][0] - 8, Q[v[0]][1] - 8, 16, 16, WHITE);
      return s + C(Q[v[1]][0], Q[v[1]][1], 4.6, BLACK, 0);
    };
    return { name: 'quadrant', attrs: [{ n: 4, ord: true }, { n: 4, ord: true }], rules: rules, render: render, dup: false,
      used: [[0, 1, 2, 3], [0, 1, 2, 3]], sig: [] };
  }

  // 선의 위쪽 부분(열마다) + 아래쪽 부분(행마다)  (Q21)
  function sceneAboveBelow(rng, level, pattern) {
    function cfgs() {
      var out = [], seen = {};
      while (out.length < 3) {
        var cfg = [rng.int(3), rng.int(3), rng.int(3)];
        var nz = cfg.filter(function (x) { return x > 0; }).length;
        if (nz < 2 || seen[cfg.join('')]) continue;
        seen[cfg.join('')] = 1; out.push(cfg);
      }
      return out;
    }
    var top = cfgs(), bot = cfgs(), kinds = ruleKinds(rng, pattern);
    var rules = kinds.map(function (k) { return classRule(rng, k, false); });
    var X = [28, 50, 72];
    function tok(t, x, y) { return t === 1 ? Rc(x - 6, y - 6, 12, 12, WHITE) : t === 2 ? C(x, y, 6.4, '#c4c4c4') : ''; }
    var render = function (v) {
      var s = L(14, 50, 86, 50, 'butt');
      for (var i = 0; i < 3; i++) s += tok(top[v[0]][i], X[i], 34) + tok(bot[v[1]][i], X[i], 66);
      return s;
    };
    return { name: 'above-below', attrs: [{ n: 3, ord: false }, { n: 3, ord: false }], rules: rules, render: render, dup: false,
      used: [[0, 1, 2], [0, 1, 2]], sig: [top, bot] };
  }

  // 블록: 윗줄 길이 × 아랫줄 길이  (Q5)
  function scenePolyomino(rng, level) {
    var k1 = rng.chance(0.5) ? 'row' : 'col';
    var rules = [addRule(rng, 3, k1), addRule(rng, 3, k1 === 'row' ? 'col' : 'row')];
    var render = function (v) {
      var s = '', i;
      for (i = 0; i <= v[0]; i++) s += Rc(22 + i * 17, 34, 14, 14, BLACK, 0);
      for (i = 0; i <= v[1]; i++) s += Rc(22 + i * 17, 51, 14, 14, BLACK, 0);
      return s;
    };
    return { name: 'polyomino', attrs: [{ n: 3, ord: true }, { n: 3, ord: true }], rules: rules, render: render, dup: false,
      used: [[0, 1, 2], [0, 1, 2]], sig: [] };
  }

  // 대각선 사각형: 회전 × 색 패턴 (값 반복 패턴 [검정, 회색, 검정])  (Q11)
  function sceneDiagSquare(rng, level) {
    var rules = [addRule(rng, 4, 'both'), classRule(rng, 'latin', true)];
    var T = ['20,20 80,20 80,80', '80,20 80,80 20,80', '80,80 20,80 20,20', '20,80 20,20 80,20'];
    var col = rng.shuffle([BLACK, GRAY, WHITE]);
    var render = function (v) {
      return Rc(20, 20, 60, 60, WHITE) + Pg(T[v[0]], col[v[1]], 0) + (v[0] % 2 === 0 ? L(20, 20, 80, 80, 'butt') : L(80, 20, 20, 80, 'butt')) + Rc(20, 20, 60, 60, 'none');
    };
    return { name: 'diag-square', attrs: [{ n: 4, ord: true }, { n: 3, ord: false }], rules: rules, render: render, dup: true,
      used: [[0, 1, 2, 3], usedStates(rules[1], 3)], sig: [col] };
  }

  // 쉐브론 + 점 개수  (Q14)
  function sceneChevron(rng, level) {
    var rules = [addRule(rng, 4, 'both'), classRule(rng, 'latin', false)];
    var DOT = [[[50, 53]], [[43, 55], [57, 55]], [[43, 57], [57, 57], [50, 46]]], dom = rng.shuffle([0, 1, 2]);
    var render = function (v) {
      var s = Pl('24,62 50,32 76,62');
      DOT[dom[v[1]]].forEach(function (p) { s += C(p[0], p[1], 4.4, BLACK, 0); });
      return Rot(v[0] * 90, s);
    };
    return { name: 'chevron', attrs: [{ n: 4, ord: true }, { n: 3, ord: false }], rules: rules, render: render, dup: true,
      used: [[0, 1, 2, 3], [0, 1, 2]], sig: [dom] };
  }

  // 우산 + 채우기  (Q15)
  function sceneUmbrella(rng, level, pattern) {
    var rules = pattern === 'orth'
      ? (rng.chance(0.5) ? [addRule(rng, 4, 'col'), classRule(rng, 'row', false)] : [addRule(rng, 4, 'row'), classRule(rng, 'col', false)])
      : [addRule(rng, 4, 'both'), classRule(rng, 'latin', false)];
    var dom = rng.shuffle([0, 1, 2]);
    var render = function (v) { return renderGlyph(2 * v[0] + 1, dom[v[1]], 0); };
    return { name: 'umbrella', attrs: [{ n: 4, ord: true }, { n: 3, ord: false }], rules: rules, render: render, dup: true,
      used: [[0, 1, 2, 3], [0, 1, 2]], sig: [dom] };
  }

  // 시곗바늘: 각도 = R[행] + C[열] (증가량이 불규칙)  (Q16)
  function sceneClock(rng, level) {
    var rules = [addRule(rng, 8, 'irreg')];
    var render = function (v) {
      var a = v[0] * 45 * Math.PI / 180, x = 50 + 30 * Math.sin(a), y = 50 - 30 * Math.cos(a);
      var x0 = 50 + 4 * Math.sin(a), y0 = 50 - 4 * Math.cos(a);
      return C(50, 50, 30) + L(x0, y0, x, y, 'butt') + C(50, 50, 4, WHITE, 2.4);
    };
    return { name: 'clock', attrs: [{ n: 8, ord: true }], rules: rules, render: render, dup: true, used: [[0, 1, 2, 3, 4, 5, 6, 7]], sig: [] };
  }

  // 집게: 회전 × 벌어진 각(넓음/중간/좁음)  (Q26)
  function scenePincer(rng, level) {
    var rules = [addRule(rng, 4, 'both'), classRule(rng, 'latin', false)];
    var ANG = [100, 52, 16], dom = rng.shuffle([0, 1, 2]);
    var render = function (v) {
      var half = ANG[dom[v[1]]] / 2 * Math.PI / 180, s = '';
      [-1, 1].forEach(function (sg) {
        s += L(72, 50, 72 - 46 * Math.cos(half), 50 + sg * 46 * Math.sin(half), 'butt');
      });
      return Rot(v[0] * 90, s + C(72, 50, 5.2, WHITE, 2.6));
    };
    return { name: 'pincer', attrs: [{ n: 4, ord: true }, { n: 3, ord: false }], rules: rules, render: render, dup: true,
      used: [[0, 1, 2, 3], [0, 1, 2]], sig: [dom] };
  }

  // 나비넥타이(삼각형 두 개): 회전 × 빗금 위치(왼쪽/오른쪽/둘 다)  (Q32)
  function sceneBowtie(rng, level) {
    var rules = [addRule(rng, 4, 'both'), classRule(rng, 'latin', false)];
    var dom = rng.shuffle([0, 1, 2]);
    var TL = '50,50 16,32 16,68', TR = '50,50 84,32 84,68';
    function hatch(id, pts) {
      var s = '<clipPath id="' + id + '"><polygon points="' + pts + '"/></clipPath><g clip-path="url(#' + id + ')">';
      for (var x = 14; x <= 86; x += 4.8) s += '<line x1="' + x + '" y1="20" x2="' + x + '" y2="80" stroke="#000" stroke-width="1.7"/>';
      return s + '</g>';
    }
    var render = function (v) {
      var h = dom[v[1]], s = Pg(TL, WHITE) + Pg(TR, WHITE);
      if (h === 0 || h === 2) s += hatch('bwl', TL) + Pg(TL, 'none');
      if (h === 1 || h === 2) s += hatch('bwr', TR) + Pg(TR, 'none');
      return Rot(v[0] * 45, s);
    };
    return { name: 'bowtie', attrs: [{ n: 4, ord: true }, { n: 3, ord: false }], rules: rules, render: render, dup: true,
      used: [[0, 1, 2, 3], [0, 1, 2]], sig: [dom] };
  }

  // 기호 세 개: 검은 원 위치 × 나머지 두 기호 짝  (Q22)
  function sceneTokens(rng, level) {
    var T = [function (x) { return Rc(x - 8, 42, 16, 16, BLACK, 0); }, function (x) { return Rc(x - 8, 42, 16, 16, WHITE, 2.6); },
      function (x) { return Pg((x) + ',40 ' + (x + 10) + ',58 ' + (x - 10) + ',58', BLACK, 0); }, function (x) { return Pg((x) + ',40 ' + (x + 10) + ',58 ' + (x - 10) + ',58', WHITE, 2.6); }];
    var pairs = [], seen = {};
    while (pairs.length < 3) {
      var a = rng.int(4), b = rng.int(4), key = a + ',' + b;
      if (seen[key] || (a === b && pairs.some(function (p) { return p[0] === p[1]; }))) continue;
      seen[key] = 1; pairs.push([a, b]);
    }
    var rules = [classRule(rng, 'latin', false), classRule(rng, 'latin', false)], X = [24, 50, 76];
    var render = function (v) {
      var s = '', k = 0;
      for (var i = 0; i < 3; i++) {
        if (i === v[0]) s += C(X[i], 50, 9, BLACK, 0);
        else { k = (i - v[0] + 3) % 3 - 1; s += T[pairs[v[1]][k]](X[i]); }
      }
      return s;
    };
    return { name: 'tokens', attrs: [{ n: 3, ord: false }, { n: 3, ord: false }], rules: rules, render: render, dup: false,
      used: [[0, 1, 2], [0, 1, 2]], sig: [pairs] };
  }

  // 꺾은선: 회전 × 꺾은선 모양(3종)  (Q27)
  function scenePolyline(rng, level) {
    var G = [22, 50, 78], lines = [];
    function randLine() {
      var pts = [], used = {};
      while (pts.length < 4) {
        var p = [rng.pick(G), rng.pick(G)], k = p.join(',');
        if (used[k]) continue;
        used[k] = 1; pts.push(p);
      }
      return pts.map(function (p) { return p.join(','); }).join(' ');
    }
    while (lines.length < 3) { var ln = randLine(); if (lines.indexOf(ln) < 0) lines.push(ln); }
    var canon = {};
    for (var li = 0; li < 3; li++) for (var rt = 0; rt < 4; rt++) {
      var pts = lines[li].split(' ').map(function (p) { return p.split(',').map(Number); });
      for (var q = 0; q < rt; q++) pts = pts.map(function (p) { return [100 - p[1], p[0]]; });
      var edges = [];
      for (var e = 0; e + 1 < pts.length; e++) {
        var a = pts[e].join(','), b = pts[e + 1].join(',');
        edges.push(a < b ? a + '-' + b : b + '-' + a);
      }
      var ck = edges.sort().join('|');
      if (canon[ck]) return null;
      canon[ck] = 1;
    }
    var rules = [addRule(rng, 4, 'both'), classRule(rng, 'latin', false)];
    var render = function (v) { return Rot(v[0] * 90, Pl(lines[v[1]])); };
    return { name: 'polyline', attrs: [{ n: 4, ord: true }, { n: 3, ord: false }], rules: rules, render: render, dup: true,
      used: [[0, 1, 2, 3], [0, 1, 2]], sig: [lines] };
  }

  /* ───────── 집합형(mask) 문제 ───────── */
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
    rot90: function (r, c) { return [c, 2 - r]; }, rot180: function (r, c) { return [2 - r, 2 - c]; }, rot270: function (r, c) { return [2 - c, r]; },
    flipH: function (r, c) { return [r, 2 - c]; }, flipV: function (r, c) { return [2 - r, c]; }, trans: function (r, c) { return [c, r]; },
    shiftR: function (r, c) { return [r, (c + 1) % 3]; }, shiftL: function (r, c) { return [r, (c + 2) % 3]; },
    shiftD: function (r, c) { return [(r + 1) % 3, c]; }, shiftU: function (r, c) { return [(r + 2) % 3, c]; }
  };
  var TFS = [], TF_SIMPLE = [], TF_HARD = [];
  Object.keys(SPATIAL).forEach(function (k) {
    var t = { name: k, f: (function (g) { return function (m) { return mapMask(m, g); }; })(SPATIAL[k]) };
    TFS.push(t); TF_SIMPLE.push(t);
  });
  (function () { var t = { name: 'invert', f: function (m) { return m ^ 511; } }; TFS.push(t); TF_SIMPLE.push(t); })();
  ['rot90', 'flipH', 'flipV', 'shiftR', 'shiftD', 'trans'].forEach(function (k) {
    var g = SPATIAL[k], t = { name: k + '+invert', f: function (m) { return mapMask(m, g) ^ 511; } };
    TFS.push(t); TF_HARD.push(t);
  });
  function rotl9(m, s) { s = ((s % 9) + 9) % 9; return ((m << s) | (m >> (9 - s))) & 511; }

  // 한 겹(layer)의 풀이기: 보이는 8칸만 보고 9번째를 추론. 가설이 하나로 모이면 ok
  function solveLayer(m, meta) {
    if(meta.fold)return solveFold(m);
    if(meta.diagonalUnion)return solveDiagonalUnion(m,meta.nb);
    var preds = {}, full = meta.full, check = null, fits = 0;
    (meta.ops || []).forEach(function (k) {
      var f = meta.postPerm ? function(a,b,full){return permuteBits(OPS[k](a,b,full),meta.postPerm);} : OPS[k];
      if (f(m[0], m[1], full) === m[2] && f(m[3], m[4], full) === m[5]) preds[f(m[6], m[7], full)] = 1;
      if (f(m[0], m[3], full) === m[6] && f(m[1], m[4], full) === m[7]) preds[f(m[2], m[5], full)] = 1;
    });
    if (meta.mid) {            // 가운데 칸 = 양쪽 칸의 합집합 (서로소)
      if ((m[0] | m[2]) === m[1] && (m[0] & m[2]) === 0 && (m[3] | m[5]) === m[4] && (m[3] & m[5]) === 0) preds[m[7] & ~m[6] & full] = 1;
      if ((m[0] | m[6]) === m[3] && (m[0] & m[6]) === 0 && (m[1] | m[7]) === m[4] && (m[1] & m[7]) === 0) preds[m[5] & ~m[2] & full] = 1;
    }
    if (meta.part) {           // 한 줄의 세 칸이 같은 요소 집합을 서로 겹치지 않게 나눠 가짐
      var tri = function (a, b, c) { return (a & b) === 0 && (a & c) === 0 && (b & c) === 0; };
      var u = m[0] | m[1] | m[2];
      if (tri(m[0], m[1], m[2]) && tri(m[3], m[4], m[5]) && (m[3] | m[4] | m[5]) === u && (m[6] & m[7]) === 0 && ((m[6] | m[7]) & ~u) === 0) preds[u & ~(m[6] | m[7])] = 1;
      var u2 = m[0] | m[3] | m[6];
      if (tri(m[0], m[3], m[6]) && tri(m[1], m[4], m[7]) && (m[1] | m[4] | m[7]) === u2 && (m[2] & m[5]) === 0 && ((m[2] | m[5]) & ~u2) === 0) preds[u2 & ~(m[2] | m[5])] = 1;
    }
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
    if (meta.hankel &&   // 같은 대각선(행+열)은 같은 그림, 칸 수가 대각선마다 1씩 증가 → 빈칸은 칸 수가 하나 더 많은 그림
        m[1] === m[3] && m[2] === m[4] && m[4] === m[6] && m[5] === m[7] &&
        popcount(m[1]) === popcount(m[0]) + 1 && popcount(m[2]) === popcount(m[1]) + 1 && popcount(m[5]) === popcount(m[2]) + 1) {
      check = popcount(m[5]) + 1; fits++;
    }
    var ks = Object.keys(preds);
    if (check !== null) return ks.length === 0 ? { ok: true, count: check } : { ok: false };
    return { ok: ks.length === 1, pred: ks.length === 1 ? +ks[0] : null };
  }

  function solveMask(d) {
    if(d.meta.kind==='occluded')return solveOccluded(d);
    var layers = d.meta.layers.length, preds = [], ok = true;
    for (var li = 0; li < layers; li++) {
      var s = solveLayer(d.cells.map(function (c) { return c.m[li]; }), d.meta.layers[li]);
      if (!s.ok) ok = false; else preds.push(s);
    }
    if (!ok) return { ok: false };
    return {
      ok: true,
      match: function (o) {
        return preds.every(function (p, li) { return p.count !== undefined ? popcount(o.m[li]) === p.count : o.m[li] === p.pred; });
      }
    };
  }

  /* ── 집합형 렌더링 ── */
  function renderPix(mask, style) {
    var X0 = 17, S = 66, c = S / 3, s = '', i;
    if (style === 'dots') {
      for (i = 0; i < 9; i++) if (mask & (1 << i)) s += C(X0 + (i % 3) * c + c / 2, X0 + Math.floor(i / 3) * c + c / 2, 8.6, BLACK, 0);
      return s;
    }
    for (i = 0; i < 9; i++) {
      if (mask & (1 << i)) s += Rc(X0 + (i % 3) * c + 1.6, X0 + Math.floor(i / 3) * c + 1.6, c - 3.2, c - 3.2, BLACK, 0);
    }
    s += Rc(X0, X0, S, S, 'none', 2.6);
    for (i = 1; i < 3; i++) {
      s += '<line x1="' + f1(X0 + i * c) + '" y1="' + X0 + '" x2="' + f1(X0 + i * c) + '" y2="' + (X0 + S) + '" stroke="#000" stroke-width="2.2"/>';
      s += '<line x1="' + X0 + '" y1="' + f1(X0 + i * c) + '" x2="' + (X0 + S) + '" y2="' + f1(X0 + i * c) + '" stroke="#000" stroke-width="2.2"/>';
    }
    return s;
  }

  // 요소 모음 (테마). 각 층(layer)의 비트가 켜져 있으면 해당 요소를 그린다.
  var THEMES = {
    compositeEdges: { nbs:[8],draw:function(ms){var p=[[20,30,80,30],[20,70,80,70],[20,30,20,70],[80,30,80,70],[20,30,50,70],[80,30,50,70],[20,70,50,30],[80,70,50,30]];return bitsOf(ms[0],8).map(function(i){var e=p[i];return L(e[0],e[1],e[2],e[3],'square');}).join('');} },
    horizontal2: { nbs: [4,4], draw: function(ms){
      var s=L(12,50,88,50,'butt'),p=[[24,36],[76,36],[24,64],[76,64]];
      bitsOf(ms[0],4).forEach(function(i){s+=Rc(p[i][0]-10,p[i][1]-10,20,20,WHITE);});
      bitsOf(ms[1],4).forEach(function(i){s+=C(p[i][0],p[i][1],4.3,BLACK,0);});return s;
    } },
    gridEdges: { nbs: [12], draw: function (ms) {
      var s = '', edges = [];
      for (var y = 0; y < 3; y++) for (var x = 0; x < 2; x++) edges.push([22 + x * 28, 22 + y * 28, 50 + x * 28, 22 + y * 28]);
      for (var x2 = 0; x2 < 3; x2++) for (var y2 = 0; y2 < 2; y2++) edges.push([22 + x2 * 28, 22 + y2 * 28, 22 + x2 * 28, 50 + y2 * 28]);
      bitsOf(ms[0], 12).forEach(function (i) { var e = edges[i]; s += L(e[0], e[1], e[2], e[3], 'square'); }); return s;
    } },
    chainEdges: { nbs: [8], draw: function (ms) {
      var p = [[20,50,50,50],[50,50,50,20],[50,20,80,50],[50,20,20,50],[80,50,50,80],[50,80,50,50],[50,80,20,50],[50,50,80,50]];
      return bitsOf(ms[0], 8).map(function (i) { var e=p[i];return L(e[0],e[1],e[2],e[3],'square'); }).join('');
    } },
    ringsDots: { nbs: [4, 4], draw: function (ms) {
      var s=Rc(18,18,64,64,'none'), rings=[[50,30],[70,50],[50,70],[30,50]], dots=[[26,26],[74,26],[74,74],[26,74]];
      bitsOf(ms[0],4).forEach(function(i){s+=C(rings[i][0],rings[i][1],7,WHITE);});
      bitsOf(ms[1],4).forEach(function(i){s+=C(dots[i][0],dots[i][1],3.5,BLACK,0);});return s;
    } },
    shapes: { nbs: [8], draw: function (ms) {      // 세로 타원, 가로 타원, 상자, 고리, 점, 마름모, 플러스, 모서리 점 4개
      var P = ['<ellipse cx="50" cy="50" rx="11" ry="25" fill="none" stroke="#000" stroke-width="' + SW + '"/>',
        '<ellipse cx="50" cy="50" rx="25" ry="11" fill="none" stroke="#000" stroke-width="' + SW + '"/>',
        Rc(20, 20, 60, 60, 'none'), C(50, 50, 17, 'none'), C(50, 50, 4.8, BLACK, 0), Pg('50,24 76,50 50,76 24,50', 'none'),
        L(26, 50, 74, 50, 'butt') + L(50, 26, 50, 74, 'butt'),
        [[24, 24], [76, 24], [24, 76], [76, 76]].map(function (p) { return C(p[0], p[1], 4.2, BLACK, 0); }).join('')];
      return bitsOf(ms[0], 8).map(function (i) { return P[i]; }).join('');
    } },
    bars: { nbs: [6], draw: function (ms) {          // 가로선 3개, 세로선 3개
      var P = [L(22, 34, 78, 34, 'butt'), L(22, 50, 78, 50, 'butt'), L(22, 66, 78, 66, 'butt'), L(34, 22, 34, 78, 'butt'), L(50, 22, 50, 78, 'butt'), L(66, 22, 66, 78, 'butt')];
      return bitsOf(ms[0], 6).map(function (i) { return P[i]; }).join('');
    } },
    segments: { nbs: [8], draw: function (ms) {      // 상자 선분: 위, 아래, 왼, 오른, 세로 가운데, 가로 가운데, \, /
      var P = [L(24, 24, 76, 24, 'square'), L(24, 76, 76, 76, 'square'), L(24, 24, 24, 76, 'square'), L(76, 24, 76, 76, 'square'),
        L(50, 24, 50, 76, 'square'), L(24, 50, 76, 50, 'square'), L(24, 24, 76, 76, 'square'), L(76, 24, 24, 76, 'square')];
      return bitsOf(ms[0], 8).map(function (i) { return P[i]; }).join('');
    } },
    rays8: { nbs: [8], draw: function (ms) {         // 가운데 점에서 뻗는 8방향 살
      var s = '';
      bitsOf(ms[0], 8).forEach(function (i) {
        var a = i * 45 * Math.PI / 180;
        s += L(50, 50, 50 + 30 * Math.sin(a), 50 - 30 * Math.cos(a), 'butt');
      });
      return s + C(50, 50, 3.4, BLACK, 0);
    } },
    vline: { nbs: [8], draw: function (ms) {         // 세로 막대 + 네모 4칸 + 점 4칸
      var B = [[30, 40], [70, 40], [30, 62], [70, 62]], D = [[32, 22], [68, 22], [32, 80], [68, 80]];
      var s = L(50, 14, 50, 86, 'butt');
      bitsOf(ms[0], 8).forEach(function (i) { s += i < 4 ? Rc(B[i][0] - 7, B[i][1] - 7, 14, 14, WHITE) : C(D[i - 4][0], D[i - 4][1], 4.6, BLACK, 0); });
      return s;
    } },
    dial2: { nbs: [4, 4], draw: function (ms) {      // 원 + (층1) 대각선 살 4개 + (층2) 안쪽 점 4개
      var s = C(50, 50, 27), K = [[1, -1], [1, 1], [-1, 1], [-1, -1]], D = [[50, 36], [64, 50], [50, 64], [36, 50]];
      bitsOf(ms[1], 4).forEach(function (i) { s += C(D[i][0], D[i][1], 4, BLACK, 0); });
      bitsOf(ms[0], 4).forEach(function (i) { s += L(50, 50, 50 + K[i][0] * 27, 50 + K[i][1] * 27, 'butt'); });
      return s;
    } }
  };

  function maskData(m) { return { m: m, k: 'm' + m.join('.') }; }

  // 집합형 문제 공통: cells(9개 마스크 배열) → 문제 객체. cfg: {meta, render(d), hankel}
  function finishMask(rng, level, cfg, cells, name, specSig) {
    var data = cells.map(maskData), meta = cfg.meta;
    var sol = solveMask({ cells: data, meta: meta });
    if (!sol.ok) return null;
    var cor = data[8];
    if (!sol.match(cor)) return null;
    var vis = {}; data.slice(0, 8).forEach(function (x) { vis[x.k] = 1; });
    if (vis[cor.k]) return null;
    var rows = {}, cols = {};
    for (var i = 0; i < 3; i++) {
      rows[[data[i * 3].k, data[i * 3 + 1].k, data[i * 3 + 2].k].join('|')] = 1;
      cols[[data[i].k, data[3 + i].k, data[6 + i].k].join('|')] = 1;
    }
    if (Object.keys(rows).length < 3 || Object.keys(cols).length < 3) return null;
    if (!cfg.dup) { var all = {}; data.forEach(function (x) { all[x.k] = 1; }); if (Object.keys(all).length !== 9) return null; }

    var nbs = meta.layers.map(function (l) { return l.nb; }), full = meta.layers.map(function (l) { return l.full; });
    function mk(m) { for (var li = 0; li < m.length; li++) if (m[li] < (cfg.allowZero?0:1) || m[li] > full[li]) return null; if(cfg.valid&&!cfg.valid(m))return null;return maskData(m); }
    var toggles = [], alt = [], dbl = [], opt;
    if (meta.layers[0].isHankel) {
      var pcs = [3, 4, 6, 7, 2], dist = [];
      for (var g = 0; g < 80; g++) dist.push(mk([randMask(rng, 9, rng.pick(pcs))]));
      var nb = [mk([data[5].m[0]]), mk([data[7].m[0]])];
      opt = pickOptions(rng, cor, [grp(rng, nb, 1), grp(rng, dist.filter(function (x) { return x && popcount(x.m[0]) !== 5; }), 5)], 5);
    } else {
      for (var li = 0; li < nbs.length; li++) for (i = 0; i < nbs[li]; i++) { var mm = cor.m.slice(); mm[li] ^= 1 << i; toggles.push(mk(mm)); }
      (meta.layers[0].ops || []).forEach(function (k) {
        [[6, 7], [2, 5]].forEach(function (pr) {
          var mm = cor.m.map(function (_, li) { return OPS[k](data[pr[0]].m[li], data[pr[1]].m[li], full[li]); });
          alt.push(mk(mm));
        });
      });
      if (meta.layers[0].tf) {
        TF_SIMPLE.forEach(function (T) { alt.push(mk([T.f(cor.m[0])])); });
        [1, 3, 8, 6].forEach(function (s) { alt.push(mk([rotl9(cor.m[0], s)])); });
      }
      for (var q = 0; q < 70; q++) {
        var li2 = rng.int(nbs.length), a = rng.int(nbs[li2]), b = rng.int(nbs[li2]);
        if (a === b) continue;
        var m3 = cor.m.slice(); m3[li2] ^= (1 << a) ^ (1 << b); dbl.push(mk(m3));
      }
      var nbrs = [mk(data[7].m.slice()), mk(data[5].m.slice())];
      opt = pickOptions(rng, cor, [grp(rng, nbrs, level >= 3 ? 2 : 1), grp(rng, alt, level === 1 ? 1 : 2), grp(rng, toggles, 5), grp(rng, dbl, 5)], 5);
    }
    if (!opt) return null;
    return {
      family: name, cells: data, options: opt.options, answer: opt.answer, render: cfg.render, score: 0,
      spec: [name, specSig], meta: meta
    };
  }

  var PIXMETA = function (extra) {
    var m = { nb: 9, full: 511, ops: ['or', 'xor', 'and', 'd12', 'd21', 'xnor'], tf: true, shift: true, hankel: true };
    for (var k in extra) m[k] = extra[k];
    return m;
  };

  // 3×3 칸 안 검은 칸 하나의 위치 이동 (Q0)
  function genPixPos(rng, level) {
    var p0 = rng.int(9), dr, dc, tries = 0, ok;
    do {
      dr = rng.int(9); dc = rng.int(9); ok = true;
      var seen = {};
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) { var x = (p0 + dr * r + dc * c) % 9; if (seen[x]) ok = false; seen[x] = 1; }
    } while ((!ok || (dr === 0 && dc === 0)) && tries++ < 200);
    if (!ok) return null;
    var cells = [];
    for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) cells.push([1 << ((p0 + dr * r + dc * c) % 9)]);
    return finishMask(rng, level, { meta: { layers: [PIXMETA({})] }, render: function (d) { return renderPix(d.m[0]); } }, cells, 'pix-pos', [p0, dr, dc]);
  }
  // 대각선마다 칸 수가 하나씩 늘어나는 그림 (Q6)
  function genPixHankel(rng, level) {
    var S = [], seen = {};
    for (var i = 0; i < 5; i++) {
      var m;
      do { m = randMask(rng, 9, i + 1); } while (seen[m]);
      seen[m] = 1; S.push(m);
    }
    var cells = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cells.push([S[r + c]]);
    return finishMask(rng, level, { dup: true, meta: { layers: [PIXMETA({ isHankel: true })] }, render: function (d) { return renderPix(d.m[0]); } }, cells, 'pix-hankel', S);
  }
  // 변환(회전·반전·이동·색반전)이 칸마다 이어짐 (Q7 점 무늬 / Q30 검은 칸)
  function genPixTf(rng, level, hard, style) {
    var T = rng.pick(hard ? TF_HARD : TF_SIMPLE), rows = [], seen = {};
    for (var t = 0; rows.length < 3 && t < 200; t++) {
      var m = randMask(rng, 9, rng.range(2, 5)), m1 = T.f(m), m2 = T.f(m1);
      if (m === m1 || m1 === m2 || m === m2 || seen[m]) continue;
      seen[m] = 1; rows.push([m, m1, m2]);
    }
    if (rows.length < 3) return null;
    var tr = rng.chance(0.5), cells = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cells.push([tr ? rows[c][r] : rows[r][c]]);
    return finishMask(rng, level, { meta: { layers: [PIXMETA({})] }, render: function (d) { return renderPix(d.m[0], style); } }, cells, 'pix-tf', [T.name, rows, tr]);
  }
  // 두 칸의 논리 연산 (Q30)
  function genPixOp(rng, level, ops) {
    var op = rng.pick(ops), rows = [], seen = {};
    for (var t = 0; rows.length < 3 && t < 400; t++) {
      var lo = op === 'and' ? 4 : op === 'xnor' ? 3 : op === 'or' || op === 'xor' ? 2 : 3;
      var hi = op === 'and' ? 6 : op === 'xnor' ? 5 : op === 'or' || op === 'xor' ? 3 : 5;
      var a = randMask(rng, 9, rng.range(lo, hi)), b = randMask(rng, 9, rng.range(lo, hi)), res = OPS[op](a, b, 511), pc = popcount(res);
      if (pc < 1 || pc > 7 || res === a || res === b || a === b || seen[a + ',' + b]) continue;
      seen[a + ',' + b] = 1; rows.push([a, b, res]);
    }
    if (rows.length < 3) return null;
    var tr = rng.chance(0.5), cells = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cells.push([tr ? rows[c][r] : rows[r][c]]);
    return finishMask(rng, level, { meta: { layers: [PIXMETA({})] }, render: function (d) { return renderPix(d.m[0]); } }, cells, 'pix-op', [op, rows, tr]);
  }

  // 요소 겹침: arr = 'last'(3번째=연산) | 'mid'(가운데=합집합) | 'part'(세 칸이 요소를 나눠 가짐). layers 층마다 연산을 따로 가질 수 있음
  function permuteBits(m,p){var out=0;p.forEach(function(to,i){if(m&(1<<i))out|=1<<to;});return out;}
  function genOverlay(rng, level, theme, arr, opsPerLayer, postPerm) {
    var th = THEMES[theme], layers = [], cellsL = [];
    for (var li = 0; li < th.nbs.length; li++) {
      var nb = th.nbs[li], full = (1 << nb) - 1, op = opsPerLayer[li], rows = [], seen = {};
      var U = arr === 'part' ? randMask(rng, nb, rng.range(4, Math.min(5, nb))) : 0;
      for (var t = 0; rows.length < 3 && t < 500; t++) {
        var row;
        if (arr === 'part') {
          var els = bitsOf(U, nb), g1 = 0, g2 = 0, g3 = 0;
          rng.shuffle(els).forEach(function (e, idx) { if (idx % 3 === 0) g1 |= 1 << e; else if (idx % 3 === 1) g2 |= 1 << e; else g3 |= 1 << e; });
          if (!g1 || !g2 || !g3) continue;
          var perm = rng.shuffle([g1, g2, g3]); row = perm;
        } else if (arr === 'mid') {
          var a0 = randMask(rng, nb, rng.range(1, 2)), b0 = randMask(rng, nb, rng.range(1, 3));
          if (a0 & b0) continue;
          row = [a0, a0 | b0, b0];
        } else {
          var lo = op === 'and' ? 3 : op === 'or' && level === 1 ? 1 : 2, hi = op === 'and' ? Math.min(5, nb - 1) : op === 'or' && level === 1 ? 2 : op === 'or' || op === 'xor' ? 3 : 4;
          var a = randMask(rng, nb, rng.range(lo, hi)), b = randMask(rng, nb, rng.range(lo, hi)), res = OPS[op](a, b, full);
          if(postPerm)res=permuteBits(res,postPerm);
          if (res === 0 || res === a || res === b || a === b || popcount(res) > 5) continue;
          row = [a, b, res];
        }
        var key = row.join(',');
        if (seen[key]) continue;
        seen[key] = 1; rows.push(row);
      }
      if (rows.length < 3) return null;
      layers.push({ nb: nb, full: full, rows: rows, ops: ['or', 'xor', 'and', 'd12', 'd21'], mid: !postPerm, part: !postPerm, postPerm:postPerm });
    }
    var tr = level > 1 && rng.chance(0.5);
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) cellsL.push(layers.map(function (ly) { return tr ? ly.rows[c][r] : ly.rows[r][c]; }));
    return finishMask(rng, level, {
      meta: { layers: layers.map(function (ly) { return { nb: ly.nb, full: ly.full, ops: ly.ops, mid: ly.mid, part: ly.part, postPerm:ly.postPerm }; }) },
      render: function (d) { return th.draw(d.m); }
    }, cellsL, 'ov-' + theme + '-' + arr, [theme, arr, opsPerLayer, layers.map(function (ly) { return ly.rows; }), tr,postPerm]);
  }

  // Signed counts (Q28) and independent three-state positions (Q29).
  // Both use a vector sum, with modulo 3 only for the latter.
  function solveSum(d) {
    var mod=d.meta.mod, predictions={};
    function add(a,b){return a.map(function(x,i){var z=x+b[i];return mod ? (z%mod+mod)%mod : z;});}
    function eq(a,b){return a.join(',')===b.join(',');}
    [[0,1,2,3,4,5,6,7],[0,3,6,1,4,7,2,5]].forEach(function(ix){
      var c=d.cells; if(eq(add(c[ix[0]].v,c[ix[1]].v),c[ix[2]].v)&&eq(add(c[ix[3]].v,c[ix[4]].v),c[ix[5]].v)) predictions['s'+add(c[ix[6]].v,c[ix[7]].v).join('.')]=1;
    });
    var keys=Object.keys(predictions);return {ok:keys.length===1,match:function(o){return keys.length===1&&o.k===keys[0];}};
  }
  function genSum(rng, level, ternary) {
    var dim=ternary?4:2, mod=ternary?3:0;
    function random(){var a=[];for(var i=0;i<dim;i++)a.push(ternary?rng.int(3):rng.range(-2,2));return a;}
    function valid(a){var total=Math.abs(a[0])+Math.abs(a[1]);return ternary||a.every(function(x){return Math.abs(x)<=3;})&&total>0&&total<=5;}
    function mk(a){return {v:a,k:'s'+a.join('.')};}
    var cells=[],seen={};for(var r=0;r<3;r++){
      var row=null;for(var attempt=0;attempt<80;attempt++){
        var a=random(),b=random(),c=a.map(function(x,i){return mod?(x+b[i])%mod:x+b[i];});
        if(!valid(a)||!valid(b)||!valid(c))continue;
        var trial=[mk(a),mk(b),mk(c)],keys=trial.map(function(x){return x.k;});
        if(new Set(keys).size!==3||keys.some(function(k){return seen[k];}))continue;
        row=trial;keys.forEach(function(k){seen[k]=true;});break;
      }
      if(!row)return null;cells=cells.concat(row);
    }
    if(new Set(cells.map(function(c){return c.k;})).size!==9)return null;
    if(rng.chance(0.5))cells=[cells[0],cells[3],cells[6],cells[1],cells[4],cells[7],cells[2],cells[5],cells[8]];
    var meta={kind:'sum',mod:mod},sol=solveSum({cells:cells,meta:meta});if(!sol.ok||!sol.match(cells[8]))return null;
    var render=function(d){
      var s=L(50,12,50,88,'butt');
      if(ternary){[[33,28],[67,28],[33,72],[67,72]].forEach(function(p,i){if(d.v[i]===1)s+=C(p[0],p[1],4.5,BLACK,0);if(d.v[i]===2)s+=Rc(p[0]-8,p[1]-8,16,16,WHITE);});}
      else {[-1,1].forEach(function(side){var ys=80;[1,0].forEach(function(i){if(Math.sign(d.v[i])!==side)return;for(var n=0;n<Math.abs(d.v[i]);n++){s+=Rc((side<0?32:68)-6,ys-5,12,10,i?BLACK:WHITE);ys-=15;}});});}
      return s;
    };
    var candidates=cells.slice(0,8);for(var t=0;t<60;t++){var a2=random();if(valid(a2))candidates.push(mk(a2));}
    var opt=pickOptions(rng,cells[8],[grp(rng,candidates,5)],5);if(!opt||new Set(opt.options.map(render)).size!==6)return null;
    return {family:ternary?'ternary-positions':'signed-stacks',cells:cells,options:opt.options,answer:opt.answer,render:render,meta:meta,spec:[ternary,cells.map(function(c){return c.v;})]};
  }

  // Q32: flags fold along wrapped diagonals. A folded flag keeps its fill;
  // when flags overlap, hatching remains visible over an unfilled flag.
  function unpackFlags(m){return [m&3,(m>>2)&3,(m>>4)&3,(m>>6)&3];}
  function packFlags(a){return a.reduce(function(m,x,i){return m|(x<<(2*i));},0);}
  function foldFlag(m,preferred){var a=unpackFlags(m),from=a[preferred]?preferred:preferred^1,to=from^1;a[to]=Math.max(a[to],a[from]);a[from]=0;return packFlags(a);}
  function solveFold(m){
    var preds={};
    [-1,1].forEach(function(step){[false,true].forEach(function(reverse){[0,1].forEach(function(lo){[2,3].forEach(function(hi){
      var order=reverse?[lo,hi]:[hi,lo],ok=true,pred;
      for(var c=0;c<3;c++){
        var c1=(c+step+3)%3,c2=(c+2*step+6)%3,a=foldFlag(m[c],order[0]),b=foldFlag(a,order[1]);
        if(a!==m[3+c1]||(c2!==2&&b!==m[6+c2]))ok=false;if(c2===2)pred=b;
      }
      if(ok)preds[pred]=1;
    });});});});
    var keys=Object.keys(preds);return {ok:keys.length===1,pred:keys.length===1?+keys[0]:null};
  }
  function drawFlags(ms){
    var a=unpackFlags(ms[0]),p=['50,50 14,30 14,50','50,50 14,50 14,70','50,50 86,30 86,50','50,50 86,50 86,70'];
    var s=L(14,50,86,50,'butt');
    a.forEach(function(x,i){if(!x)return;s+=Pg(p[i],WHITE);if(x===2){var id='flag'+i;s+='<clipPath id="'+id+'"><polygon points="'+p[i]+'"/></clipPath><g clip-path="url(#'+id+')">';for(var k=0;k<100;k+=6)s+=L(k,20,k,80,'butt');s+='</g>'+Pg(p[i],'none');}});
    return Rot(-35,s);
  }
  function genFold(rng,level){
    var m=[],step=rng.pick([-1,1]),lo=rng.int(2),hi=2+rng.int(2),order=rng.chance(0.5)?[lo,hi]:[hi,lo];
    for(var c=0;c<3;c++){var a=[];for(var i=0;i<4;i++)a.push(rng.int(3));m[c]=packFlags(a);m[3+(c+step+3)%3]=foldFlag(m[c],order[0]);m[6+(c+2*step+6)%3]=foldFlag(m[3+(c+step+3)%3],order[1]);}
    return finishMask(rng,level,{meta:{layers:[{nb:8,full:255,fold:true}]},valid:function(ms){return unpackFlags(ms[0]).every(function(x){return x<3;});},render:function(d){return drawFlags(d.m);}},m.map(function(x){return [x];}),'folded-flags',[step,order,m]);
  }
  // Q34: one hidden shape per wrapped diagonal in each direction; each cell is their union.
  function solveDiagonalUnion(m,nb){
    var prediction=0;
    for(var bit=0;bit<nb;bit++){
      var possible={};
      for(var state=0;state<64;state++){
        var ok=true;for(var i=0;i<8;i++){var r=Math.floor(i/3),c=i%3,a=(r+c)%3,b=(r-c+3)%3;if((((state>>a)&1)|((state>>(3+b))&1))!==((m[i]>>bit)&1)){ok=false;break;}}
        if(ok)possible[((state>>1)&1)|((state>>3)&1)]=1;
      }
      var keys=Object.keys(possible);if(keys.length!==1)return {ok:false,pred:null};if(+keys[0])prediction|=1<<bit;
    }
    return {ok:true,pred:prediction};
  }
  function genDiagonalUnion(rng,level){
    var a=[],b=[],cells=[];for(var i=0;i<3;i++){a.push(randMask(rng,8,rng.range(1,3)));b.push(randMask(rng,8,rng.range(1,3)));}
    for(var r=0;r<3;r++)for(var c=0;c<3;c++)cells.push([a[(r+c)%3]|b[(r-c+3)%3]]);
    return finishMask(rng,level,{meta:{layers:[{nb:8,full:255,diagonalUnion:true}]},render:function(d){return THEMES.compositeEdges.draw(d.m);}},cells,'diagonal-union',[a,b]);
  }
  // Q33: two white dots move around a six-position ring; black dots hide them.
  // Order on the ring: LT, LM, LB, RB, RM, RT.
  function rotate6(m,n){n=(n%6+6)%6;return ((m<<n)|(m>>(6-n)))&63;}
  function solveOccluded(d){
    var black=d.cells.slice(0,8).map(function(c){return c.m[0];}),bp=predictClass(black);if(bp.length!==1)return {ok:false};
    var predicted={};
    for(var base=0;base<64;base++){if(popcount(base)!==2)continue;for(var dr=1;dr<6;dr++)for(var dc=0;dc<6;dc++){
      var ok=true;for(var i=0;i<8;i++){var r=Math.floor(i/3),c=i%3;if((rotate6(base,dr*r+dc*c)&~black[i]&63)!==d.cells[i].m[1]){ok=false;break;}}
      if(ok)predicted[rotate6(base,2*dr+2*dc)&~bp[0]&63]=1;
    }}
    var keys=Object.keys(predicted);return {ok:keys.length===1,match:function(o){return keys.length===1&&o.m[0]===bp[0]&&o.m[1]===+keys[0];}};
  }
  function genOccluded(rng,level){
    var rule=classRule(rng,'latin',rng.chance(0.5)),shapes=[];for(var j=0;j<3;j++)shapes.push(randMask(rng,6,rng.range(1,2)));
    var base=randMask(rng,6,2),dr=rng.pick([1,5]),dc=rng.pick([2,4]),cells=[];
    for(var r=0;r<3;r++)for(var c=0;c<3;c++){var black=shapes[valueAt(rule,r,c)],white=rotate6(base,dr*r+dc*c)&~black&63;cells.push([black,white]);}
    var positions=[[33,22],[33,50],[33,78],[67,78],[67,50],[67,22]];
    return finishMask(rng,level,{allowZero:true,meta:{kind:'occluded',layers:[{nb:6,full:63},{nb:6,full:63}]},valid:function(ms){return !(ms[0]&ms[1])&&popcount(ms[0])<=2&&popcount(ms[1])<=2;},render:function(d){var s=L(50,12,50,88,'butt');positions.forEach(function(p,i){if(d.m[0]&(1<<i))s+=C(p[0],p[1],6,BLACK);else if(d.m[1]&(1<<i))s+=C(p[0],p[1],6,WHITE);});return s;}},cells,'occluded-dots',[rule,shapes,base,dr,dc]);
  }

  /* ───────── 35칸 설계도: 검증한 규칙 계열로 새 문항 생성 ───────── */
  function A(fn) { return function (rng, lv) { var sc = fn(rng, lv); return sc && genAttr(rng, sc, lv); }; }
  var SLOTS = [
    /* 0  Q0  */ [genPixPos],
    /* 1  Q1  */ [A(function (r, l) { return sceneFrameSym(r, l, 'sym', 'orth'); })],
    /* 2  Q2  */ [A(function (r, l) { return sceneFrameSym(r, l, 'sym', 'mix'); }), A(function (r, l) { return sceneFrameSym(r, l, 'sym', 'orth'); })],
    /* 3  Q3  */ [A(function (r, l) { return sceneStick(r, l, 'hammer', 'orth'); })],
    /* 4  Q4  */ [A(function (r, l) { return sceneStick(r, l, 'arrow', 'orth'); })],
    /* 5  Q5  */ [A(scenePolyomino)],
    /* 6  Q6  */ [genPixHankel],
    /* 7  Q7  */ [A(sceneDotGroups)],
    /* 8  Q8  */ [A(sceneQuadrant)],
    /* 9  Q9  */ [A(sceneHalfArrow)],
    /* 10 Q10 */ [function (r, l) { return genOverlay(r, l, 'shapes', 'mid', ['or']); }],
    /* 11 Q11 */ [A(sceneDiagSquare)],
    /* 12 Q12 */ [A(function (r, l) { return sceneFrameSym(r, l, 'fill', 'latin'); })],
    /* 13 Q13 */ [A(function (r, l) { return sceneFrameSym(r, l, 'line', 'latin'); })],
    /* 14 Q14 */ [A(sceneChevron)],
    /* 15 Q15 */ [A(function (r, l) { return sceneUmbrella(r, l, 'latin'); })],
    /* 16 Q16 */ [A(sceneClock)],
    /* 17 Q17 */ [A(sceneLineCounts)],
    /* 18 Q18 */ [function (r, l) { return genOverlay(r, l, 'shapes', 'part', ['or']); }],
    /* 19 Q19 */ [function (r, l) { return genOverlay(r, l, 'segments', 'last', ['xor']); }],
    /* 20 Q20 */ [function (r, l) { return genOverlay(r, l, 'gridEdges', 'last', ['xor']); }],
    /* 21 Q21 */ [A(function (r, l) { return sceneAboveBelow(r, l, 'orth'); })],
    /* 22 Q22 */ [A(sceneTokens)],
    /* 23 Q23 */ [function (r, l) { return genOverlay(r, l, 'rays8', 'last', ['xor']); }],
    /* 24 Q24 */ [function (r, l) { return genOverlay(r, l, 'ringsDots', 'last', ['and', 'and']); }],
    /* 25 Q25 */ [function (r, l) { return genOverlay(r, l, 'dial2', 'last', ['xor', 'and']); }],
    /* 26 Q26 */ [A(scenePincer)],
    /* 27 Q27 */ [function (r, l) { return genOverlay(r, l, 'chainEdges', 'last', ['xor']); }],
    /* 28 Q28 */ [function (r, l) { return genSum(r, l, false); }],
    /* 29 Q29 */ [function (r, l) { return genSum(r, l, true); }],
    /* 30 Q30 */ [function (r, l) { return genPixOp(r, l, ['xor']); }],
    /* 31 Q31 */ [function (r, l) { return genOverlay(r, l, 'horizontal2', 'last', ['and','and'], [2,3,0,1]); }],
    /* 32 Q32 */ [genFold],
    /* 33 Q33 */ [genOccluded],
    /* 34 Q34 */ [genDiagonalUnion]
  ];
  var TOTAL = SLOTS.length;
  function levelOf(slot) { return slot < 9 ? 1 : slot < 23 ? 2 : 3; }
  var PLAN = [[1, 9], [2, 14], [3, 12]];

  /* ───────── 풀이 설명 (결과 화면의 '문제 다시 보기'에서 보여 줄 짧은 한국어 설명) ───────── */
  var ATTR_LABELS = {
    'frame-sym': [['바깥 도형'], ['안쪽 기호']],
    'frame-fill': [['도형'], ['색(채우기)']],
    'frame-line': [['도형'], ['가로지르는 선의 방향']],
    'stick-hammer': [['막대의 회전(시계 반대 방향)', '×45°'], ['머리의 위치']],
    'stick-arrow': [['화살표의 회전(시계 반대 방향)', '×45°'], ['화살촉의 위치']],
    'quadrant': [['네모의 위치(시계 방향으로 한 구역씩)', '구역'], ['점의 위치(시계 방향으로 한 구역씩)', '구역']],
    'above-below': [['선 위쪽 모양'], ['선 아래쪽 모양']],
    'polyomino': [['윗줄 블록 수', '개'], ['아랫줄 블록 수', '개']],
    'diag-square': [['삼각형 방향(시계 방향 회전)', '×90°'], ['삼각형 색']],
    'chevron': [['꺾쇠 방향(시계 방향 회전)', '×90°'], ['점 개수']],
    'umbrella': [['우산 방향(시계 방향 회전)', '×90°'], ['우산 속(흰색/빗금/검정)']],
    'clock': [['바늘 각도(시계 방향)', '×45°']],
    'pincer': [['집게 방향(시계 방향 회전)', '×90°'], ['벌어진 각']],
    'bowtie': [['나비넥타이 회전(시계 방향)', '×45°'], ['빗금이 있는 쪽']],
    'tokens': [['검은 원의 위치'], ['나머지 두 기호의 짝']],
    'polyline': [['꺾은선 회전(시계 방향)', '×90°'], ['꺾은선 모양']],
    'dot-groups': [['위쪽 점 묶음'], ['아래쪽 점 묶음']],
    'half-arrow': [['화살 방향(시계 방향 회전)', '×90°'], ['검은 쪽(왼쪽/오른쪽)']],
    'line-counts': [['가로선 수', '개'], ['세로선 수', '개']]
  };
  function stepText(a, b, unit) {
    function one(x) { return unit.charAt(0) === '×' ? '+' + (x * parseInt(unit.slice(1), 10)) + '°' : '+' + x + unit; }
    return a === b ? one(a) : '첫 칸에서 ' + one(a) + ', 다음 칸에서 ' + one(b);
  }
  function descClass(label, rule) {
    var rep = rule.map.filter(function (v, i, a) { return a.indexOf(v) === i; }).length < 3 ? ' (값이 반복되는 3칸 주기)' : '';
    if (rule.dc === 0) return label + ': 같은 줄에서는 모두 같고, 줄이 바뀔 때마다 달라집니다.' + rep;
    if (rule.dr === 0) return label + ': 같은 열에서는 모두 같고, 열이 바뀔 때마다 달라집니다.' + rep;
    return label + ': 세 가지가 한 줄에 한 번씩 나오고, 줄이 바뀔 때마다 한 칸씩 어긋나며 돌아갑니다.' + rep;
  }
  function descAdd(label, rule, unit, plain) {
    var n = rule.n, u = unit || '';
    if (plain) return label + ' = (행 값) + (열 값). 행 값은 위에서 아래로 ' + rule.R.join('·') + ', 열 값은 왼쪽에서 오른쪽으로 ' + rule.C.join('·') + '입니다.';
    var r = [(rule.R[1] - rule.R[0] + n) % n, (rule.R[2] - rule.R[1] + n) % n], c = [(rule.C[1] - rule.C[0] + n) % n, (rule.C[2] - rule.C[1] + n) % n];
    var rowZero = rule.R.every(function (x) { return x === 0; }), colZero = rule.C.every(function (x) { return x === 0; });
    if (colZero) return label + ': 같은 줄에서는 그대로이고, 아래 줄로 갈 때마다 ' + stepText(r[0], r[1], u) + '씩 바뀝니다.';
    if (rowZero) return label + ': 같은 열에서는 그대로이고, 오른쪽 칸으로 갈 때마다 ' + stepText(c[0], c[1], u) + '씩 바뀝니다.';
    return label + ': 오른쪽 칸으로 갈 때 ' + stepText(c[0], c[1], u) + ', 아래 줄로 갈 때 ' + stepText(r[0], r[1], u) + ' 만큼 더해집니다.';
  }
  var OP_TEXT = {
    or: '두 칸을 겹쳐 그린 것(합)', xor: '두 칸에서 서로 다른 부분만 남긴 것(겹친 부분은 지움)', and: '두 칸의 공통 부분만 남긴 것',
    d12: '첫 칸에서 둘째 칸과 겹치는 부분을 뺀 것', d21: '둘째 칸에서 첫 칸과 겹치는 부분을 뺀 것', xnor: '두 칸이 같은 자리는 검게, 다른 자리는 희게 한 것'
  };
  var TF_TEXT = {
    rot90: '시계 방향으로 90° 회전', rot180: '180° 회전', rot270: '시계 반대 방향으로 90° 회전', flipH: '좌우 반전', flipV: '상하 반전',
    trans: '대각선 기준 반전', shiftR: '오른쪽으로 한 칸 이동(끝은 반대편으로)', shiftL: '왼쪽으로 한 칸 이동(끝은 반대편으로)',
    shiftD: '아래로 한 칸 이동(끝은 위로)', shiftU: '위로 한 칸 이동(끝은 아래로)', invert: '흑백 반전'
  };
  function tfText(name) {
    var p = name.split('+');
    return p.map(function (x) { return TF_TEXT[x] || x; }).join('한 뒤 ');
  }
  var LAYER_NAMES = { dial2: ['살(선)', '점'], ringsDots: ['고리', '점'], horizontal2: ['네모', '점'] };
  function explainProblem(g) {
    var f = g.family, sp = g.spec, out = [];
    if (ATTR_LABELS[f]) {
      sp[1].forEach(function (rule, i) {
        var lb = ATTR_LABELS[f][i];
        out.push(rule.t === 'class' ? descClass(lb[0], rule) : descAdd(lb[0], rule, lb[1] || '', f === 'line-counts'));
      });
      out.push(sp[1].length > 1 ? '두 속성이 서로 따로 바뀌므로, 빈칸 자리의 값을 각각 구해 합치면 정답이 됩니다.' : '이 규칙으로 빈칸 자리의 값을 구하면 정답이 됩니다.');
    } else if (f === 'pix-pos') {
      out.push('검은 칸의 위치가 가로·세로로 일정한 간격만큼 이동합니다. 같은 이동 규칙을 빈칸 자리에 적용한 위치가 정답입니다.');
    } else if (f === 'pix-hankel') {
      out.push('왼쪽 아래에서 오른쪽 위로 이어지는 대각선은 모두 같은 그림입니다.');
      out.push('대각선이 하나 늘어날 때마다 검은 칸이 1개씩 늘어나므로, 빈칸은 검은 칸이 5개인 그림이고 보기 중 하나뿐입니다.');
    } else if (f === 'pix-tf') {
      out.push('칸이 하나 넘어갈 때마다 같은 변환이 한 번씩 적용됩니다: ' + tfText(sp[1][0]) + '.');
      out.push(sp[1][2] ? '세로(위→아래) 방향으로 변환이 이어집니다.' : '가로(왼쪽→오른쪽) 방향으로 변환이 이어집니다.');
    } else if (f === 'pix-op') {
      out.push((sp[1][2] ? '위 두 칸으로 아래 칸을' : '왼쪽 두 칸으로 오른쪽 칸을') + ' 만듭니다. 결과 칸 = ' + (OP_TEXT[sp[1][0]] || '') + '.');
      out.push('같은 규칙을 마지막 줄(열)에 적용하면 빈칸이 나옵니다.');
    } else if (f.indexOf('ov-') === 0) {
      var theme = sp[1][0], arr = sp[1][1], ops = sp[1][2], vertical = sp[1][4], post = sp[1][5];
      var names = LAYER_NAMES[theme];
      var dir = vertical ? '위 두 칸으로 아래 칸' : '왼쪽 두 칸으로 오른쪽 칸';
      if (arr === 'part') out.push('한 줄(또는 한 열)의 세 칸이 같은 요소들을 서로 겹치지 않게 나눠 가집니다. 빈칸은 그 줄에서 아직 나오지 않은 요소들입니다.');
      else if (arr === 'mid') out.push('가운데 칸은 양쪽 칸을 겹쳐 그린 것입니다. 따라서 빈칸은 가운데 칸에서 왼쪽 칸의 요소를 뺀 나머지입니다.');
      else if (names) ops.forEach(function (op, i) { out.push(names[i] + ' 층: ' + dir + '을 만들며, 결과 = ' + OP_TEXT[op] + '.' + (post && i === 0 ? ' (공통 부분을 구한 뒤 위아래를 뒤집습니다)' : '')); });
      else out.push(dir + '을 만들며, 결과 칸 = ' + OP_TEXT[ops[0]] + '.' + (vertical ? '' : ''));
      if (arr === 'last' && names) out.push('두 층을 따로 계산한 뒤 겹쳐 그린 것이 정답입니다.');
      else if (arr === 'last') out.push('같은 규칙을 마지막 줄(열)에 적용하면 빈칸이 나옵니다.');
    } else if (f === 'signed-stacks') {
      out.push('막대 오른쪽의 네모는 +, 왼쪽의 네모는 −로 세어 흰 네모와 검은 네모를 따로 계산합니다.');
      out.push('한 줄(또는 한 열)에서 앞 두 칸의 값을 더하면 세 번째 칸이 됩니다.');
    } else if (f === 'ternary-positions') {
      out.push('네 자리(왼쪽 위·오른쪽 위·왼쪽 아래·오른쪽 아래)마다 비어 있음/점/네모의 세 상태가 있습니다.');
      out.push('앞 두 칸의 상태를 자리마다 더해(3으로 나눈 나머지) 세 번째 칸을 만듭니다.');
    } else if (f === 'folded-flags') {
      out.push('삼각 깃발이 이어지는 대각선을 따라 반대쪽으로 접혀 옮겨 갑니다. 접힌 깃발은 색(흰색/빗금)을 유지하고, 겹치면 빗금이 보입니다.');
    } else if (f === 'occluded-dots') {
      out.push('검은 점은 대각선을 따라 같은 모양이 반복됩니다.');
      out.push('흰 점 두 개는 여섯 자리 고리를 따라 칸마다 일정하게 이동하며, 검은 점과 겹치는 자리는 가려집니다.');
    } else if (f === 'diagonal-union') {
      out.push('각 칸은 서로 반대 방향으로 이어지는 두 대각선의 요소를 합쳐 놓은 그림입니다.');
      out.push('빈칸에 해당하는 두 대각선의 요소를 합치면 정답이 됩니다.');
    } else out.push('보이는 8칸에서 규칙을 찾아 빈칸에 적용한 그림이 정답입니다.');
    return out;
  }

  function generateProblem(slot, seed) {
    var rng = makeRng(seed), level = levelOf(slot), pool = SLOTS[slot];
    for (var tries = 0; tries < 300; tries++) {
      var g = rng.pick(pool)(rng, level);
      if (!g) continue;
      var data = g.cells;
      return {
        type: 'matrix', slot: slot, family: g.family, level: level, answer: g.answer, score: slot, seed: seed,
        fp: slot + ':' + JSON.stringify(g.spec), explain: explainProblem(g),
        cells: data.slice(0, 8).map(g.render), options: g.options.map(g.render),
        _data: { cells: data, options: g.options, meta: g.meta }
      };
    }
    throw new Error('problem generation failed at slot ' + slot);
  }

  // 한 번의 시험: 35칸 설계도를 순서대로. 한 시험 안에 같은 문제 없음.
  function generateTest(seed) {
    var rng = makeRng(seed), seen = {}, out = [];
    for (var slot = 0; slot < TOTAL; slot++) {
      var p;
      for (var tries = 0; tries < 30; tries++) {
        p = generateProblem(slot, rng.int(2147483647));
        if (!seen[p.fp]) break;
      }
      seen[p.fp] = true;
      out.push(p);
    }
    return out;
  }

  function solve(p) { return p._data.meta.kind === 'attr' ? solveAttr(p._data) : p._data.meta.kind === 'sum' ? solveSum(p._data) : solveMask(p._data); }

  var api = { makeRng: makeRng, generateProblem: generateProblem, generateTest: generateTest, solve: solve, levelOf: levelOf, TOTAL: TOTAL, LEVELS: PLAN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IQGen = api;
})(typeof self !== 'undefined' ? self : this);
