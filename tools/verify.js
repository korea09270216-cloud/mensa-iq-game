/* 문제 생성기 검증:  node tools/verify.js [표본수]
 * - 난이도 구간별 "서로 다른 문제" 수 (보기 순서/위치와 무관한 내용 지문 기준)
 * - 풀이기(solveGrid)가 보이는 8칸만으로 정답을 하나로 추론하고, 그 값이 정답 보기와 일치하는지
 * - 보기 6개가 서로 다르게 보이는지(SVG 문자열 비교), 정답 보기는 정확히 1개
 * - 한 시험(30문항) 안 중복 없음, 구성 10-12-8, 난이도 순서
 */
var G = require('../js/generator.js');

var SAMPLES = parseInt(process.argv[2], 10) || 4000;
var NAMES = ['outer', 'inner', 'fill', 'size', 'pattern', 'dot'];
var failures = [];
function fail(msg) { if (failures.length < 30) failures.push(msg); }

function checkProblem(p) {
  if (p.options.length !== 6) fail('보기 수 != 6 : ' + p.fp);
  if (p.cells.length !== 8) fail('보이는 칸 != 8 : ' + p.fp);
  if (new Set(p.options).size !== 6) fail('보기가 서로 같게 렌더링됨: ' + p.fp);
  if (!(p.answer >= 0 && p.answer < 6)) fail('정답 인덱스 이상: ' + p.fp);
  if (/NaN|undefined|Infinity/.test(JSON.stringify(p))) fail('NaN/undefined 포함: ' + p.fp);

  var cells = p._data.cells, opts = p._data.options, correct = cells[8];
  var sol = G.solveGrid(cells);
  if (!sol.ok) fail('풀이기가 정답을 하나로 못 정함: ' + p.fp);
  var predicted = Object.assign({}, sol.pred);
  var matches = opts.filter(function (t) {
    return NAMES.every(function (nm) { return t[nm] === predicted[nm]; }) && t.marks === predicted.marks;
  });
  if (matches.length !== 1) fail('풀이기 예측과 일치하는 보기 수 != 1 (' + matches.length + '): ' + p.fp);
  if (G.tupleKey(opts[p.answer]) !== G.tupleKey(correct)) fail('정답 인덱스가 정답 도형과 불일치: ' + p.fp);
}

var perLevel = { 1: {}, 2: {}, 3: {} }, perScene = {};
var t0 = Date.now();
for (var level = 1; level <= 3; level++) {
  var rng = G.makeRng(level * 1000);
  for (var i = 0; i < SAMPLES; i++) {
    var p = G.generateProblem('matrix', level, rng.int(2147483647));
    checkProblem(p);
    perLevel[level][p.fp] = 1;
    var k = '난이도' + level + ' / ' + p._data.scene;
    (perScene[k] = perScene[k] || {})[p.fp] = 1;
  }
}

console.log('표본: 난이도당 ' + SAMPLES + '개 (' + (Date.now() - t0) + 'ms)\n');
console.log('[난이도 × 장면별 서로 다른 문제 수 (표본에서 확인된 하한)]');
Object.keys(perScene).sort().forEach(function (k) { console.log('  ' + k + ' : ' + Object.keys(perScene[k]).length); });
console.log('\n[난이도 구간별 서로 다른 문제 수]');
var minTier = Infinity;
[1, 2, 3].forEach(function (l) {
  var n = Object.keys(perLevel[l]).length;
  minTier = Math.min(minTier, n);
  console.log('  난이도' + l + ' : ' + n + (n >= 1000 ? '  OK(>=1000)' : '  <<< 1000 미만'));
});
if (minTier < 1000) fail('난이도 구간 중 1000 미만 존재');

var TESTS = Math.max(300, Math.floor(SAMPLES / 4)), dupTests = 0, orderBad = 0, shapeBad = 0;
var seenAcross = {}, total = 0, repeated = 0;
for (var s = 1; s <= TESTS; s++) {
  var test = G.generateTest(s * 7919);
  if (test.length !== 30) shapeBad++;
  var counts = { 1: 0, 2: 0, 3: 0 }, fps = {}, prev = 0;
  test.forEach(function (q) {
    counts[q.level]++;
    if (fps[q.fp]) dupTests++;
    fps[q.fp] = 1;
    if (q.level < prev) orderBad++;
    prev = q.level;
    checkProblem(q);
    total++; if (seenAcross[q.fp]) repeated++; seenAcross[q.fp] = 1;
  });
  if (counts[1] !== 10 || counts[2] !== 12 || counts[3] !== 8) shapeBad++;
}
console.log('\n[시험 ' + TESTS + '회 생성]');
console.log('  한 시험 안 중복 문제: ' + dupTests + ' / 난이도 순서 위반: ' + orderBad + ' / 구성(10-12-8) 위반: ' + shapeBad);
console.log('  서로 다른 시험끼리 겹친 문제 비율: ' + (repeated / total * 100).toFixed(2) + '% (' + repeated + '/' + total + ')');
if (dupTests || orderBad || shapeBad) fail('시험 구성 검사 실패');

if (failures.length) { console.log('\nFAIL (' + failures.length + '건 이상)'); failures.forEach(function (f) { console.log('  - ' + f); }); process.exit(1); }
console.log('\nPASS');
