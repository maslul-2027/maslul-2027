const { load } = require('./harness');
const assert = require('assert');
const X = load();
let pass = 0;
function t(name, fn) { fn(); pass++; console.log('PASS', name); }
t('analytics per-soldier index safely accepts prototype-like IDs', () => {
  const rows = ['__proto__', 'constructor', 'toString'].map((id, i) => ({ soldier_id: id, score: 70 + i }));
  const out = X.Analytics.perSoldier_(rows, 'score');
  assert.strictEqual(Object.getPrototypeOf(out), null);
  assert.deepStrictEqual(['__proto__', 'constructor', 'toString'].map(id => out[id]), [70, 71, 72]);
});
t('analytics monthly distinct-soldier count is not polluted by object prototype', () => {
  const ids = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];
  const rows = ids.map(id => ({ soldier_id: id, score: 80, test_date: '2026-10-10' }));
  const out = X.Analytics.monthly_(rows, 'score', 'test_date');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].soldiers, 5);
});
t('navigation aggregate safely groups prototype-like type IDs', () => {
  const rows = ['__proto__', 'constructor', 'toString'].map((id, i) => ({ navigation_type_id: id, final_score: 60 + i }));
  X.Db.insert('NavigationTypes', { id: '__proto__', name: 'A' });
  X.Db.insert('NavigationTypes', { id: 'constructor', name: 'B' });
  X.Db.insert('NavigationTypes', { id: 'toString', name: 'C' });
  const out = X.Navigation.aggregate_(rows);
  assert.strictEqual(out.by_type.length, 3);
  assert.strictEqual(Array.from(out.by_type, x => x.count).join(','), '1,1,1');
});
console.log('TOTAL pass=' + pass + ' fail=0');
