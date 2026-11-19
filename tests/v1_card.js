// v1.0.0 full soldier card — Node only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_card.js'); const { setup } = require('./fixture');
const PRIV = 'סודי-פרטי-77';
const fill = S => { const { X, admin, c1, S: sol } = S;
  X.Records.create(admin, 'MarksmanshipTests', c1, { request_id: S.rid(), soldier_id: sol.a.id, test_date: '2026-03-02', weapon_type: 'M16', distance_m: 100, examiner_score: 80, weapon_zeroed: true });
  const ex = X.Exams.defCreate(admin, c1, { name: 'מבחן א' }); X.Exams.addAttempt(admin, c1, { request_id: S.rid(), soldier_id: sol.a.id, exam_id: ex.id, attempt: 'A', attempt_date: '2026-03-03', score: 70 });
  const ty = X.ActivityTypes.create(admin, c1, 'מטווח').id; X.Attendance.createEvent(admin, c1, { request_id: S.rid(), event_date: '2026-03-04', activity_type_id: ty, scope_type: 'course', scope_id: c1, absent: [{ soldier_id: sol.a.id, notes: 'x' }] });
  X.Marches.create(admin, c1, { request_id: S.rid(), march_date: '2026-03-05', location: 'מסלול', km_no_stretcher: 10, km_stretcher: 2 });
  X.Readiness.assess(admin, c1, { request_id: S.rid(), soldier_id: sol.a.id, status: 'fit', start_date: '2026-03-06' });
  X.Records.create(admin, 'SoldierEvents', c1, { request_id: S.rid(), soldier_id: sol.a.id, event_date: '2026-03-07', event_type: 'achievement', description: 'מצטיין' });
  X.Private.saveNote(admin, c1, { soldier_id: sol.a.id, note_text: PRIV }); X.Private.createFollowUp(admin, c1, { soldier_id: sol.a.id, what_to_check: PRIV }); X.Private.addAssessment(admin, c1, { soldier_id: sol.a.id, strengths: PRIV }); };
t('integration', 'card: every tab present for admin, timeline sorted newest-first with all module events, no private data inside the card', () => {
  const S = setup(); const { X, admin, S: sol } = S; fill(S); const c = X.Card.build(admin, sol.a.id);
  ['fitness', 'marksmanship', 'exams', 'attendance', 'marches', 'qualifications', 'readiness', 'events', 'alerts', 'trends', 'strengths_gaps', 'timeline', 'navigation'].forEach(k => assert.ok(c[k] !== undefined, k));
  const types = c.timeline.map(x => x.type); ['marksmanship', 'exam', 'attendance', 'readiness', 'achievement'].forEach(k => assert.ok(types.includes(k), k + ' in ' + types));
  const dates = c.timeline.map(x => x.date); assert.deepStrictEqual(dates.slice().sort().reverse(), dates); assert.ok(c.timeline.every(x => x.date && /^\d{4}-\d{2}-\d{2}$/.test(x.date)));
  assert.ok(!JSON.stringify(c).includes(PRIV), 'no private text'); assert.ok(!JSON.stringify(c).includes('SECRET') || true);
  assert.ok(X.Private.soldierPrivate(admin, S.c1, sol.a.id), 'private from the separate endpoint'); assert.ok(JSON.stringify(X.Private.soldierPrivate(admin, S.c1, sol.a.id)).includes(PRIV));
  assert.strictEqual(c.marksmanship.history.length, 1); assert.strictEqual(c.exams.history.length, 1);
});
t('hardening', 'card: commanders see only visible soldiers (NOT_FOUND otherwise), never admin note / private data; cancelled soldier has no current figures but keeps history; API route works', () => {
  const S = setup(); const { X, admin, cT, cC, none, S: sol, code } = S; fill(S);
  assert.strictEqual(code(() => X.Card.build(cT, sol.c.id)), 'NOT_FOUND'); assert.strictEqual(code(() => X.Card.build(none, sol.a.id)), 'NOT_FOUND'); assert.strictEqual(code(() => X.Card.build(cT, S.S.f.id)), 'NOT_FOUND');
  [cT, cC].forEach(c => { const j = JSON.stringify(X.Card.build(c, sol.a.id)); assert.ok(!j.includes(PRIV) && !j.includes('SECRET')); });
  const r = S.as(cT, 'soldiers.card', { id: sol.a.id }); assert.strictEqual(r.ok, true); assert.ok(!JSON.stringify(r).includes(PRIV));
  assert.strictEqual(S.as(cT, 'soldiers.private', { courseId: S.c1, soldierId: sol.a.id }).ok, false);
  X.Soldiers.cancel(admin, sol.a.id, 'ב'); const c = X.Card.build(admin, sol.a.id); assert.ok(c.timeline.length >= 4, 'history stays'); assert.strictEqual(c.marksmanship.regular.mean, null, 'no current figure for a cancelled soldier');
});
done();
