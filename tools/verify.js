/* 문제 생성기 검증:  node tools/verify.js [표본수]
 * - 난이도 구간별 "서로 다른 문제" 수 (보기 순서/위치와 무관한 내용 지문 기준)
 * - 한 시험(30문항) 안에서 중복 문제 없음, 난이도 순서, 정답 1개, 보기 6개가 서로 다르게 보이는지
 * - 숫자 수열: 단순 규칙(등차/등비/계차/피보나치 등)이 정답과 다른 값을 예측하지 않는지
 */
var G = require('../js/generator.js');

var SAMPLES = parseInt(process.argv[2], 10) || 6000;
var TYPES = ['matrix', 'figseq', 'series', 'numgrid'];
var failures = [];
function fail(msg) { if (failures.length < 30) failures.push(msg); }

function checkProblem(p) {
  if (p.options.length !== 6) fail('보기 수 != 6 : ' + p.fp);
  var uniq = {};
  p.options.forEach(function (o) { uniq[typeof o === 'number' ? 'n' + o : o] = 1; });
  if (Object.keys(uniq).length !== 6) fail('보기가 서로 같음: ' + p.fp);
  if (!(p.answer >= 0 && p.answer < 6)) fail('정답 인덱스 이상: ' + p.fp);
  var s = JSON.stringify(p);
  if (/NaN|undefined|Infinity/.test(s)) fail('NaN/undefined 포함: ' + p.fp);
  if (p.type === 'series') {
    var preds = G.predictNext(p.shown);
    var ans = p.options[p.answer];
    if (preds.some(function (v) { return v !== ans; })) fail('단순 규칙이 다른 답 예측: ' + p.fp);
  }
  if (p.type === 'matrix' || p.type === 'figseq') {
    var correct = p._data.cells[p.type === 'matrix' ? 8 : 5];
    var key = function (t) { return JSON.stringify(t); };
    var same = p._data.options.filter(function (t) { return key(t) === key(correct); });
    if (same.length !== 1) fail('정답 보기 개수 != 1: ' + p.fp);
  }
}

var perLevel = { 1: {}, 2: {}, 3: {} }, perCombo = {};
var t0 = Date.now();
for (var level = 1; level <= 3; level++) {
  TYPES.forEach(function (type) {
    var rng = G.makeRng(level * 1000 + TYPES.indexOf(type));
    for (var i = 0; i < SAMPLES; i++) {
      var p = G.generateProblem(type, level, rng.int(2147483647));
      checkProblem(p);
      perLevel[level][p.fp] = 1;
      var k = type + ' / 난이도' + level;
      (perCombo[k] = perCombo[k] || {})[p.fp] = 1;
    }
  });
}

console.log('표본: 유형×난이도 조합당 ' + SAMPLES + '개 (' + (Date.now() - t0) + 'ms)\n');
console.log('[유형×난이도별 서로 다른 문제 수 (표본에서 확인된 하한)]');
Object.keys(perCombo).forEach(function (k) { console.log('  ' + k + ' : ' + Object.keys(perCombo[k]).length); });
console.log('\n[난이도 구간별 서로 다른 문제 수]');
var minTier = Infinity;
[1, 2, 3].forEach(function (l) {
  var n = Object.keys(perLevel[l]).length;
  minTier = Math.min(minTier, n);
  console.log('  난이도' + l + ' : ' + n + (n >= 1000 ? '  OK(>=1000)' : '  <<< 1000 미만'));
});
if (minTier < 1000) fail('난이도 구간 중 1000 미만 존재');

// 시험 단위 검사
var TESTS = Math.max(500, Math.floor(SAMPLES / 2)), dupTests = 0, orderBad = 0, shapeBad = 0;
var seenAcross = {}, total = 0, repeated = 0;
for (var s = 1; s <= TESTS; s++) {
  var test = G.generateTest(s * 7919);
  if (test.length !== 30) shapeBad++;
  var counts = { 1: 0, 2: 0, 3: 0 }, fps = {}, prev = 0;
  test.forEach(function (p) {
    counts[p.level]++;
    if (fps[p.fp]) dupTests++;
    fps[p.fp] = 1;
    if (p.level < prev) orderBad++;
    prev = p.level;
    checkProblem(p);
    total++; if (seenAcross[p.fp]) repeated++; seenAcross[p.fp] = 1;
  });
  if (counts[1] !== 10 || counts[2] !== 12 || counts[3] !== 8) shapeBad++;
}
console.log('\n[시험 ' + TESTS + '회 생성]');
console.log('  한 시험 안 중복 문제: ' + dupTests + ' / 난이도 순서 위반: ' + orderBad + ' / 구성(10-12-8) 위반: ' + shapeBad);
console.log('  서로 다른 시험끼리 겹친 문제 비율: ' + (repeated / total * 100).toFixed(2) + '% (' + repeated + '/' + total + ')');
if (dupTests || orderBad || shapeBad) fail('시험 구성 검사 실패');

if (failures.length) { console.log('\nFAIL (' + failures.length + '건 이상)'); failures.forEach(function (f) { console.log('  - ' + f); }); process.exit(1); }
console.log('\nPASS');
