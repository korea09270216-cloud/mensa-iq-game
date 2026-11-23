/* 멘사 스타일 IQ 테스트 — 화면/타이머/채점 (재미용, 공식 IQ 검사 아님) */
(function () {
  'use strict';

  var G = window.MensaGen;
  var TOTAL_Q = G.TOTAL;            // 30문항
  var TOTAL_SEC = 20 * 60;          // 제한시간 20분 (멘사코리아 입회 테스트도 20분 안팎)
  var ADVANCE_MS = 220;             // 보기를 누르면 이 시간 뒤에 다음 문제로
  var KEY = 'mensa-iq-game:v2';
  var WEIGHT = { 1: 1, 2: 1.5, 3: 2 };
  var MAX_SCORE = G.LEVELS.reduce(function (s, l) { return s + WEIGHT[l[0]] * l[1]; }, 0);   // 10×1 + 12×1.5 + 8×2 = 44

  var app = document.getElementById('app');
  var topBar = document.getElementById('top');
  var countEl = document.getElementById('count');
  var timeText = document.getElementById('timeText');

  var state = null, test = null, screen = 'cover', ticker = null, locked = false;

  /* ───────── 저장 ───────── */
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가여도 진행은 가능 */ } }
  function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* noop */ } }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtTime(sec) { sec = Math.max(0, Math.ceil(sec)); var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function remaining() { return (state.endsAt - Date.now()) / 1000; }

  /* ───────── 타이머: 상단에 항상 표시 ───────── */
  function startTicker() { stopTicker(); ticker = setInterval(tick, 500); tick(); }
  function stopTicker() { if (ticker) clearInterval(ticker); ticker = null; }
  function tick() {
    if (!state || state.done) return;
    var left = remaining();
    timeText.textContent = fmtTime(left);
    if (left <= 0) finish();
  }

  /* ───────── 보드 / 도형 ───────── */
  function cellHtml(inner) { return '<div class="cell"><svg viewBox="0 0 100 100" aria-hidden="true">' + inner + '</svg></div>'; }
  var QCELL = '<div class="cell q"><svg viewBox="0 0 100 100" aria-hidden="true"><text x="50" y="67" text-anchor="middle" font-size="54" font-weight="300" fill="#3b5bdb" font-family="system-ui,sans-serif">?</text></svg></div>';
  function boardHtml(cells) {
    return '<div class="board" role="img" aria-label="3×3 도형 배열, 오른쪽 아래 칸이 비어 있음">' +
      cells.map(cellHtml).join('') + QCELL + '</div>';
  }

  /* ───────── 표지 ───────── */
  function showCover() {
    screen = 'cover';
    stopTicker();
    topBar.hidden = true;
    var resumable = state && !state.done && remaining() > 0;
    var hasResult = state && state.done;
    var demo = G.generateProblem('matrix', 2, 20241123);
    app.innerHTML =
      '<section class="cover">' +
      '<div class="hero">' + boardHtml(demo.cells) + '</div>' +
      '<h1>멘사 스타일 IQ 테스트</h1>' +
      '<div class="chips"><span>3×3 도형 추론</span><span>' + TOTAL_Q + '문항</span><span>' + (TOTAL_SEC / 60) + '분</span><span>점점 어려워짐</span></div>' +
      (resumable
        ? '<button class="btn" id="resume">이어서 풀기 · ' + esc(state.name) + ' · ' + fmtTime(remaining()) + ' 남음</button>' +
          '<button class="btn ghost" id="fresh">처음부터 새로 시작</button>'
        : '') +
      '<form id="form" autocomplete="off"' + (resumable ? ' hidden' : '') + '>' +
      '<label for="name">이름</label><input id="name" maxlength="12" placeholder="이름 또는 닉네임" required>' +
      '<label for="age">나이</label><input id="age" type="number" inputmode="numeric" min="5" max="120" placeholder="나이" required>' +
      '<p class="err" id="err" role="alert"></p>' +
      '<button class="btn" type="submit">테스트 시작</button>' +
      (hasResult ? '<button class="btn ghost" type="button" id="last">지난 결과 보기</button>' : '') +
      '</form>' +
      '<ul class="tips">' +
      '<li>8개의 도형 속 규칙을 찾아 빈칸(?)에 들어갈 도형을 고르세요.</li>' +
      '<li>보기를 누르면 바로 다음 문제로 넘어가요. 이전 문제로 돌아가 답을 바꿀 수도 있어요.</li>' +
      '<li>키보드: 1~6 보기 선택 · ←/→ 이동</li>' +
      '</ul>' +
      '<p class="notice">재미용 테스트입니다. 멘사(Mensa)와 무관하며 공식 IQ 검사가 아니에요.</p>' +
      '</section>';

    var form = document.getElementById('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('name').value.trim();
      var age = parseInt(document.getElementById('age').value, 10);
      var err = document.getElementById('err');
      if (!name) { err.textContent = '이름을 입력해 주세요.'; return; }
      if (!(age >= 5 && age <= 120)) { err.textContent = '나이는 5~120 사이로 입력해 주세요.'; return; }
      startTest(name, age);
    });
    if (resumable) {
      document.getElementById('resume').addEventListener('click', openTest);
      document.getElementById('fresh').addEventListener('click', function () {
        document.getElementById('resume').hidden = true;
        document.getElementById('fresh').hidden = true;
        form.hidden = false;
        document.getElementById('name').focus();
      });
    }
    if (hasResult) document.getElementById('last').addEventListener('click', showResult);
  }

  function newSeed() {
    var q = new URLSearchParams(location.search).get('seed');
    if (q && /^\d+$/.test(q)) return parseInt(q, 10) % 2147483647;
    var a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a[0] % 2147483647;
  }

  function startTest(name, age) {
    state = {
      name: name, age: age, seed: newSeed(), endsAt: Date.now() + TOTAL_SEC * 1000,
      answers: Array.apply(null, Array(TOTAL_Q)).map(function () { return -1; }), cur: 0, done: false
    };
    save();
    openTest();
  }

  function openTest() {
    test = G.generateTest(state.seed);
    topBar.hidden = false;
    startTicker();
    showQuestion();
  }

  /* ───────── 문제 화면 ───────── */
  function optionsHtml(p, sel) {
    return '<div class="opts" role="radiogroup" aria-label="보기">' + p.options.map(function (o, i) {
      return '<button type="button" class="opt' + (i === sel ? ' sel' : '') + '" role="radio" aria-checked="' + (i === sel) +
        '" data-i="' + i + '" aria-label="보기 ' + (i + 1) + '"><span class="num">' + (i + 1) + '</span>' +
        '<svg viewBox="0 0 100 100" aria-hidden="true">' + o + '</svg></button>';
    }).join('') + '</div>';
  }

  function showQuestion() {
    screen = 'test';
    locked = false;
    var i = state.cur, p = test[i], sel = state.answers[i], last = i === TOTAL_Q - 1;
    countEl.textContent = (i + 1) + ' / ' + TOTAL_Q;
    app.innerHTML =
      '<div class="seg" aria-label="문항 이동">' + state.answers.map(function (a, k) {
        return '<button type="button" data-k="' + k + '" aria-label="' + (k + 1) + '번 문항" class="' + (k === i ? 'cur' : a >= 0 ? 'done' : '') + '"></button>';
      }).join('') + '</div>' +
      '<p class="hint">규칙을 찾아 빈칸(?)에 들어갈 도형을 고르세요</p>' +
      '<div class="stage">' + boardHtml(p.cells) + optionsHtml(p, sel) + '</div>' +
      '<div class="actions">' +
      '<button type="button" id="prev"' + (i === 0 ? ' disabled' : '') + '>← 이전</button>' +
      (last ? '<button type="button" id="submit" class="primary">제출하기</button>'
            : '<button type="button" id="skip">건너뛰기 →</button>') +
      '</div>';

    app.querySelectorAll('.opt').forEach(function (b) {
      b.addEventListener('click', function () { choose(parseInt(b.getAttribute('data-i'), 10)); });
    });
    app.querySelectorAll('.seg button').forEach(function (b) {
      b.addEventListener('click', function () { go(parseInt(b.getAttribute('data-k'), 10)); });
    });
    document.getElementById('prev').addEventListener('click', function () { go(i - 1); });
    if (last) document.getElementById('submit').addEventListener('click', submit);
    else document.getElementById('skip').addEventListener('click', function () { go(i + 1); });
    window.scrollTo(0, 0);
  }

  // 보기를 누르면 답을 저장하고 바로 다음 문제로 (마지막 문제는 제출 버튼으로)
  function choose(idx) {
    if (locked) return;
    var i = state.cur;
    state.answers[i] = idx;
    save();
    app.querySelectorAll('.opt').forEach(function (b, k) {
      b.classList.toggle('sel', k === idx);
      b.setAttribute('aria-checked', k === idx);
    });
    if (i < TOTAL_Q - 1) {
      locked = true;
      setTimeout(function () { if (screen === 'test' && state.cur === i) go(i + 1); else locked = false; }, ADVANCE_MS);
    }
  }

  function go(k) {
    if (k < 0 || k >= TOTAL_Q || screen !== 'test') return;
    state.cur = k; save(); showQuestion();
  }

  function submit() {
    var left = state.answers.filter(function (a) { return a < 0; }).length;
    if (left > 0 && !window.confirm(left + '문제를 아직 풀지 않았어요. 그래도 제출할까요?')) return;
    finish();
  }

  /* ───────── 채점 → IQ (재미용 환산) ───────── */
  // 정답 비율(난이도 가중) → IQ. 단조 증가. 6지선다 찍기 평균(약 17%) ≈ 70, 만점 = 150
  var CURVE = [[0, 55], [0.167, 70], [0.35, 85], [0.5, 100], [0.65, 115], [0.8, 130], [0.92, 143], [1, 150]];
  function toIQ(p) {
    for (var i = 1; i < CURVE.length; i++) {
      if (p <= CURVE[i][0]) {
        var a = CURVE[i - 1], b = CURVE[i];
        return Math.round(a[1] + (b[1] - a[1]) * (p - a[0]) / (b[0] - a[0]));
      }
    }
    return 150;
  }
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function topPercent(iq) { return (1 - 0.5 * (1 + erf((iq - 100) / 15 / Math.SQRT2))) * 100; }
  function fmtPct(v) { return v >= 10 ? Math.round(v) : v >= 1 ? +v.toFixed(1) : Math.max(0.01, +v.toFixed(2)); }

  var TIERS = [
    { max: 80, emoji: '🐒', name: '원숭이', msg: '{n}님은 원숭이와 동급입니다. 바나나를 앞에 두면 누구보다 빠르게 움직일 거예요.' },
    { max: 95, emoji: '🐶', name: '강아지', msg: '{n}님은 강아지 등급입니다. 눈치와 센스는 이미 만렙이에요.' },
    { max: 110, emoji: '🦜', name: '앵무새', msg: '{n}님은 앵무새 등급입니다. 평균적으로 똑똑하고, 말도 잘 따라 해요.' },
    { max: 120, emoji: '🦍', name: '침팬지', msg: '{n}님은 침팬지 등급입니다. 도구도 쓸 줄 아는 꽤 영리한 두뇌예요.' },
    { max: 130, emoji: '🐬', name: '돌고래', msg: '{n}님은 돌고래 등급입니다. 상위권 두뇌, 멘사 문턱이 눈앞이에요.' },
    { max: 140, emoji: '🐙', name: '문어', msg: '{n}님은 문어 등급입니다. 다리가 여덟 개라도 모자랄 만큼 머리가 빨리 돌아가요.' },
    { max: 145, emoji: '🕵️', name: '셜록 홈즈', msg: '{n}님은 셜록 홈즈 등급입니다. 사소한 단서로 규칙을 꿰뚫어 보네요.' },
    { max: 999, emoji: '🧑‍🔬', name: '아인슈타인', msg: '{n}님은 아인슈타인 등급입니다. 지구에서 이 정도면 거의 외계 지능이에요.' }
  ];
  function tierOf(iq) { for (var i = 0; i < TIERS.length; i++) if (iq < TIERS[i].max) return TIERS[i]; return TIERS[TIERS.length - 1]; }

  function finish() {
    if (state.done) return;
    stopTicker();
    var score = 0, correct = 0, by = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
    test.forEach(function (p, i) {
      by[p.level][1]++;
      if (state.answers[i] === p.answer) { correct++; score += WEIGHT[p.level]; by[p.level][0]++; }
    });
    var iq = toIQ(score / MAX_SCORE);
    var usedSec = Math.min(TOTAL_SEC, Math.round((Math.min(Date.now(), state.endsAt) - (state.endsAt - TOTAL_SEC * 1000)) / 1000));
    state.done = true;
    state.result = { iq: iq, correct: correct, by: by, usedSec: usedSec };
    save();
    showResult();
  }

  /* ───────── 결과 ───────── */
  function showResult() {
    screen = 'result';
    stopTicker();
    topBar.hidden = true;
    var r = state.result, iq = r.iq, tier = tierOf(iq);
    var top = fmtPct(topPercent(iq)), bottom = +(100 - top).toFixed(2);
    app.innerHTML =
      '<section class="result">' +
      '<div class="who">' + esc(state.name) + ' (' + state.age + '세)</div>' +
      '<div class="label">당신의 IQ</div>' +
      '<div class="iq">' + iq + '</div>' +
      '<div class="pcts"><div><b>상위 ' + top + '%</b><small>IQ 수준</small></div><div><b>하위 ' + bottom + '%</b><small>나보다 낮은 사람 비율</small></div></div>' +
      '<div class="gauge" aria-hidden="true"><i style="width:' + bottom + '%"></i><em style="left:' + bottom + '%"></em></div>' +
      '<div class="gauge-l"><span>하위</span><span>상위</span></div>' +
      '<div class="animal"><div class="emoji">' + tier.emoji + '</div><h2>' + tier.name + ' 등급</h2><p>' + esc(tier.msg.replace('{n}', state.name)) + '</p></div>' +
      '<div class="stats"><span>정답 ' + r.correct + ' / ' + TOTAL_Q + '</span>' +
      '<span>쉬움 ' + r.by[1][0] + '/' + r.by[1][1] + '</span><span>보통 ' + r.by[2][0] + '/' + r.by[2][1] + '</span><span>어려움 ' + r.by[3][0] + '/' + r.by[3][1] + '</span>' +
      '<span>소요 ' + fmtTime(r.usedSec) + '</span></div>' +
      '<button class="btn" id="again">다시 도전하기</button>' +
      '<p class="notice">재미용 결과입니다. 멘사(Mensa)와 무관하며 공식 IQ 검사가 아니에요.</p>' +
      '</section>';
    document.getElementById('again').addEventListener('click', function () { clearSave(); state = null; showCover(); });
    window.scrollTo(0, 0);
  }

  /* ───────── 키보드 ───────── */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (screen !== 'test' || !state || state.done) return;
    var k = e.key;
    if (k >= '1' && k <= '6') { choose(parseInt(k, 10) - 1); e.preventDefault(); }
    else if (k === 'ArrowLeft') go(state.cur - 1);
    else if (k === 'ArrowRight') go(state.cur + 1);
  });

  /* ───────── 시작 ───────── */
  state = load();
  if (state && state.seed && !state.done && remaining() <= 0) {
    test = G.generateTest(state.seed);
    finish();
  } else if (state && !state.seed) {
    state = null;
    showCover();
  } else {
    showCover();
  }
})();
