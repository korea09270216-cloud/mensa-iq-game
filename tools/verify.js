/* 문제 생성기 검증:  node tools/verify.js [칸당 표본수]
 * - 35칸 설계도(실제 테스트 Q0~Q34 순서) 각 칸마다 표본을 만들어:
 *   · 풀이기(solve)가 보이는 8칸만으로 정답을 하나로 추론하고, 그 값과 일치하는 보기가 정확히 1개(= 정답 보기)인지
 *   · 보기 6개가 서로 다르게 렌더링되는지, 이미 보이는 칸과 같은 그림이 정답이 아닌지, 줄/열이 반복되지 않는지
 * - 칸별/난이도 구간별 "서로 다른 문제" 수, 한 시험 안 중복 없음, 구성 9-14-12
 */
var G = require('../js/generator.js');

var SAMPLES = parseInt(process.argv[2], 10) || 400;
var failures = [];
function fail(msg) { if (failures.length < 30) failures.push(msg); }

function checkProblem(p) {
  if (p.options.length !== 6) fail('보기 수 != 6 : ' + p.fp);
  if (p.cells.length !== 8) fail('보이는 칸 != 8 : ' + p.fp);
  if (new Set(p.options).size !== 6) fail('보기가 서로 같게 렌더링됨: ' + p.fp);
  if (!(p.answer >= 0 && p.answer < 6)) fail('정답 인덱스 이상: ' + p.fp);
  if (/NaN|undefined|Infinity/.test(JSON.stringify(p.cells) + JSON.stringify(p.options))) fail('NaN/undefined 포함: ' + p.fp);

  var d = p._data, sol = G.solve(p);
  if (!sol.ok) { fail('풀이기가 정답을 하나로 못 정함: ' + p.fp); return; }
  var matches = d.options.filter(sol.match);
  if (matches.length !== 1) fail('풀이기 예측과 일치하는 보기 수 != 1 (' + matches.length + '): ' + p.fp);
  if (!sol.match(d.options[p.answer])) fail('정답 인덱스가 풀이기 결과와 불일치: ' + p.fp);
  if (!sol.match(d.cells[8])) fail('빈칸의 실제 값과 풀이기 결과 불일치: ' + p.fp);
  var vis = d.cells.slice(0, 8).filter(function (c) { return c.k === d.cells[8].k; }).length;
  if (vis) fail('정답이 이미 보이는 칸과 같음: ' + p.fp);
}

var perSlot = [], perLevel = { 1: {}, 2: {}, 3: {} }, t0 = Date.now();
for (var slot = 0; slot < G.TOTAL; slot++) {
  var rng = G.makeRng(slot * 7777 + 1), set = {}, fams = {};
  for (var i = 0; i < SAMPLES; i++) {
    var p = G.generateProblem(slot, rng.int(2147483647));
    checkProblem(p);
    set[p.fp] = 1; perLevel[p.level][p.fp] = 1; fams[p.family] = 1;
  }
  perSlot.push({ slot: slot, distinct: Object.keys(set).length, fams: Object.keys(fams).join(', ') });
}
console.log('표본: 칸당 ' + SAMPLES + '개 (' + (Date.now() - t0) + 'ms)\n');
console.log('[칸(=실제 Q번호)별 서로 다른 문제 수 / 사용된 규칙 계열]');
perSlot.forEach(function (x) { console.log('  Q' + (x.slot < 10 ? ' ' : '') + x.slot + ' : ' + x.distinct + '  (' + x.fams + ')'); });
console.log('\n[난이도 구간별 서로 다른 문제 수]');
var minTier = Infinity;
[1, 2, 3].forEach(function (l) {
  var n = Object.keys(perLevel[l]).length;
  minTier = Math.min(minTier, n);
  console.log('  난이도' + l + ' : ' + n + (n >= 1000 ? '  OK(>=1000)' : '  <<< 1000 미만'));
});
if (minTier < 1000) fail('난이도 구간 중 1000 미만 존재');
perSlot.forEach(function (x) { if (x.distinct < 30) fail('Q' + x.slot + ' 변형이 너무 적음: ' + x.distinct); });

var TESTS = Math.max(200, Math.floor(SAMPLES / 2)), dupTests = 0, shapeBad = 0;
var seenAcross = {}, total = 0, repeated = 0;
for (var s = 1; s <= TESTS; s++) {
  var test = G.generateTest(s * 7919);
  if (test.length !== G.TOTAL) shapeBad++;
  var counts = { 1: 0, 2: 0, 3: 0 }, fps = {};
  test.forEach(function (q, idx) {
    counts[q.level]++;
    if (fps[q.fp]) dupTests++;
    fps[q.fp] = 1;
    if (q.slot !== idx) shapeBad++;
    checkProblem(q);
    total++; if (seenAcross[q.fp]) repeated++; seenAcross[q.fp] = 1;
  });
  G.LEVELS.forEach(function (l) { if (counts[l[0]] !== l[1]) shapeBad++; });
}
console.log('\n[시험 ' + TESTS + '회 생성 (' + G.TOTAL + '문항)]');
console.log('  한 시험 안 중복 문제: ' + dupTests + ' / 구성·순서 위반: ' + shapeBad);
console.log('  서로 다른 시험끼리 겹친 문제 비율: ' + (repeated / total * 100).toFixed(2) + '% (' + repeated + '/' + total + ')');
if (dupTests || shapeBad) fail('시험 구성 검사 실패');

if (failures.length) { console.log('\nFAIL (' + failures.length + '건 이상)'); failures.forEach(function (f) { console.log('  - ' + f); }); process.exit(1); }
console.log('\nPASS');
