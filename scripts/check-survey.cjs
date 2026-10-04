// In-memory integration checks; never writes responses to the real database.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: '', innerHTML: '', textContent: '', hidden: false,
    style: { setProperty() {} }, classList: { add() {}, remove() {} },
    addEventListener() {}, querySelectorAll() { return []; },
    setCustomValidity(message) { this.validationMessage = message; }, reportValidity() { return true; },
    scrollIntoView() {}, reset() {},
    querySelector(selector) { return selector.includes(':checked') ? { value: '4' } : null; }
  });
  return elements.get(id);
}
element('group-by').value = 'all';
element('composition-by').value = 'year';
let snapshotListener;
let saved;
const context = vm.createContext({
  console, document: { getElementById: element, querySelector() { return null; } },
  window: { PEOPLELENS_FIREBASE_CONFIG: { apiKey: 'test', projectId: 'test' }, setTimeout() {} },
  initializeApp() { return {}; }, getFirestore() { return {}; }, collection(_, name) { return name; },
  serverTimestamp() { return 'server-time'; },
  onSnapshot(_, options, listener) { snapshotListener = listener; },
  async addDoc(_, record) { saved = record; }
});
const source = fs.readFileSync('app.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
vm.runInContext(source, context);
function update(rows) {
  snapshotListener({ metadata: { fromCache: false }, docs: rows.map((row, i) => ({ id: String(i), data: () => row })) });
}
const rows = [
  { school: 'A대학교', year: '1학년', major: '인문·사회', answers: Array(12).fill(1) },
  { school: 'B대학교', year: '2학년', major: '자연·공학', answers: Array(12).fill(5) },
  { school: 'B대학교', year: '2학년', major: '자연·공학', answers: Array(12).fill(3) }
];
update([]);
assert.match(element('results-chart').innerHTML, /첫 응답/);
update(rows);
assert.equal(element('response-count').textContent, '3');
assert.match(element('composition-chart').innerHTML, /33\.3%/);
assert.match(element('composition-chart').innerHTML, /66\.7%/);
assert.match(element('results-chart').innerHTML, /3\.00/);
for (const dimension of ['school', 'year', 'major']) {
  element('group-by').value = dimension;
  element('group-filter').value = '';
  vm.runInContext('renderResults()', context);
  assert.match(element('results-chart').innerHTML, /1\.00/);
  assert.match(element('results-chart').innerHTML, /4\.00/);
}
element('group-filter').value = '자연·공학';
vm.runInContext('renderChart()', context);
assert.match(element('results-chart').innerHTML, /자연·공학/);
assert.match(element('results-chart').innerHTML, /n=2/);
element('school').value = '  테스트대학교  ';
element('year').value = '3학년';
element('major').value = '기타';
element('major-other').value = ' 의학 ';
(async () => {
  await vm.runInContext('submitResponse({ preventDefault() {} })', context);
  assert.equal(saved.school, '테스트대학교');
  assert.equal(saved.major, '의학');
  assert.equal(saved.answers.length, 12);
  assert.ok(saved.answers.every((value) => value === 4));
  assert.equal(element('personal-result').hidden, false);
  assert.match(element('personal-result').innerHTML, /4\.00/);
  update([...rows, saved]);
  assert.equal(element('response-count').textContent, '4');
  assert.match(element('composition-chart').innerHTML, /25\.0%/);
  assert.match(element('personal-result').innerHTML, /3\.25/);
  console.log('PASS: empty results, live averages, three group comparisons, ratios, other major, submission and personal comparison.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
