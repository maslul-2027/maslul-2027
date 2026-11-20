// v1.0.0 private area + shared notes + assessments — Node only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_private.js'); const { setup } = require('./fixture');
const SECRET = 'סודי-מ״פ-1';
t('hardening', 'private area is admin-only: EVERY private read/write is FORBIDDEN for every commander scope (never an empty result), card payload has no private key', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const n = X.Private.saveNote(admin, c1, { soldier_id: sol.a.id, note_text: SECRET }); const f = X.Private.createFollowUp(admin, c1, { soldier_id: sol.a.id, what_to_check: SECRET }); X.Private.toggleFavorite(admin, c1, sol.a.id);
  [S.none, S.cT, S.cD, S.cC].forEach(c => {
    const calls = [() => X.Private.listNotes(c, c1, sol.a.id), () => X.Private.listNotes(c, c1, sol.a.id, true), () => X.Private.saveNote(c, c1, { soldier_id: sol.a.id, note_text: 'x' }), () => X.Private.listFollowUps(c, c1, {}), () => X.Private.createFollowUp(c, c1, { soldier_id: sol.a.id, what_to_check: 'x' }), () => X.Private.updateFollowUp(c, f.id, { status: 'done' }), () => X.Private.toggleFavorite(c, c1, sol.a.id), () => X.Private.listFavorites(c, c1), () => X.Private.soldierPrivate(c, c1, sol.a.id)];
    calls.forEach((fn, i) => assert.strictEqual(code(fn), 'FORBIDDEN', c.email + ' call ' + i));
    try { assert.ok(!JSON.stringify(X.Soldiers.card(c, sol.a.id)).includes(SECRET)); } catch (e) { assert.strictEqual(e.code, 'NOT_FOUND'); } assert.ok(!JSON.stringify(X.Soldiers.list(c, c1, {})).includes(SECRET));
  });
  assert.ok(!JSON.stringify(X.Soldiers.card(admin, sol.a.id)).includes('private_note'), 'private data comes from Private.soldierPrivate only (separate call/tab)');
  const r = S.as(S.cC, 'private.notes', { courseId: c1 }); assert.strictEqual(r.ok, false);
});
t('integration', 'private notes: revisions, latest shown, history kept; unchanged text rejected; foreign-course group NOT_FOUND; audit has field names only', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const n1 = X.Private.saveNote(admin, c1, { soldier_id: sol.a.id, note_text: SECRET }); const n2 = X.Private.saveNote(admin, c1, { soldier_id: sol.a.id, note_group_id: n1.note_group_id, note_text: SECRET + ' v2' });
  assert.strictEqual(n2.revision, 2); const L = X.Private.listNotes(admin, c1, sol.a.id); assert.strictEqual(L.length, 1); assert.strictEqual(L[0].note_text, SECRET + ' v2'); assert.strictEqual(X.Private.listNotes(admin, c1, sol.a.id, true).length, 2);
  assert.strictEqual(code(() => X.Private.saveNote(admin, c1, { soldier_id: sol.a.id, note_group_id: n1.note_group_id, note_text: SECRET + ' v2' })), 'VALIDATION'); assert.strictEqual(code(() => X.Private.saveNote(admin, c1, { soldier_id: sol.b.id, note_group_id: n1.note_group_id, note_text: 'x' })), 'NOT_FOUND');
  [{ note_text: '' }, { note_text: 5 }, { note_text: ['x'] }, { note_text: 'x'.repeat(2001) }, { soldier_id: S.S.f.id, note_text: 'x' }].forEach(o => assert.strictEqual(code(() => X.Private.saveNote(admin, c1, Object.assign({ soldier_id: sol.a.id }, o))), o.soldier_id ? 'NOT_FOUND' : 'VALIDATION', JSON.stringify(o).slice(0, 40)));
  const au = X.Db.all('AuditLog').filter(a => a.table_name === 'PrivateNotes'); assert.ok(au.length === 2 && au.every(a => !JSON.stringify(a).includes(SECRET) && a.after_json.includes('_private')));
  X.Soldiers.cancel(admin, sol.a.id, 'ב'); assert.strictEqual(X.Private.listNotes(admin, c1, sol.a.id).length, 1, 'history of a cancelled soldier stays readable by admin'); assert.strictEqual(X.Private.saveNote(admin, c1, { soldier_id: sol.a.id, note_text: 'עדיין אפשר' }).revision, 1, 'admin may still annotate');
});
t('integration', 'follow-ups: create/update, due changes + status changes kept in history, done/cancelled stay, due list for the alert engine, cancelled soldier cannot get a new one', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const f = X.Private.createFollowUp(admin, c1, { soldier_id: sol.a.id, what_to_check: 'לבדוק כושר', due_date: '2026-03-10' });
  assert.deepStrictEqual(X.Private.dueFollowUps_(c1, '2026-03-09').length, 0); assert.strictEqual(X.Private.dueFollowUps_(c1, '2026-03-10').length, 1);
  X.Private.updateFollowUp(admin, f.id, { due_date: '2026-03-20' }); X.Private.updateFollowUp(admin, f.id, { status: 'done' }); const L = X.Private.listFollowUps(admin, c1, {})[0]; assert.strictEqual(L.history.length, 3); assert.strictEqual(L.status, 'done'); assert.strictEqual(X.Private.dueFollowUps_(c1, '2026-04-01').length, 0);
  X.Private.updateFollowUp(admin, f.id, { status: 'open' }); assert.strictEqual(X.Private.dueFollowUps_(c1, '2026-04-01').length, 1, 'reopened');
  ['status:x', 'foo:1', 'due_date:2026-13-01'].forEach(p => { const [k, v] = p.split(':'); assert.strictEqual(code(() => X.Private.updateFollowUp(admin, f.id, { [k]: v })), 'VALIDATION', p); }); assert.strictEqual(code(() => X.Private.updateFollowUp(admin, f.id, { status: 'open' })), 'VALIDATION', 'no change'); assert.strictEqual(code(() => X.Private.updateFollowUp(admin, { id: f.id }, { status: 'done' })), 'NOT_FOUND');
  assert.strictEqual(code(() => X.Private.createFollowUp(admin, c1, { soldier_id: sol.a.id, what_to_check: '' })), 'VALIDATION'); X.Soldiers.cancel(admin, sol.b.id, 'ב'); assert.strictEqual(code(() => X.Private.createFollowUp(admin, c1, { soldier_id: sol.b.id, what_to_check: 'x' })), 'VALIDATION');
  X.Courses.archive(admin, c1); assert.strictEqual(code(() => X.Private.updateFollowUp(admin, f.id, { status: 'done' })), 'COURSE_ARCHIVED'); assert.strictEqual(X.Private.listFollowUps(admin, c1, {}).length, 1);
});
t('integration', 'favorites are personal to the admin user, toggle on/off without physical deletion, cancelled soldiers flagged', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; assert.strictEqual(X.Private.toggleFavorite(admin, c1, sol.a.id).favorite, true); assert.strictEqual(X.Private.listFavorites(admin, c1).length, 1);
  const other = { email: 'admin2@x.com', role: 'admin', courseScope: '*' }; assert.strictEqual(X.Private.listFavorites(other, c1).length, 0, 'per user'); assert.strictEqual(X.Private.toggleFavorite(admin, c1, sol.a.id).favorite, false); assert.strictEqual(X.Private.listFavorites(admin, c1).length, 0); assert.strictEqual(X.Db.all('Favorites').length, 1, 'row kept');
  X.Private.toggleFavorite(admin, c1, sol.b.id); X.Soldiers.cancel(admin, sol.b.id, 'ב'); assert.strictEqual(X.Private.listFavorites(admin, c1)[0].cancelled, true);
});
t('hardening', 'assessments: commander adds for a visible soldier only, reads only his own, admin reads all, append-only corrections, no content in audit, validation', () => {
  const S = setup(); const { X, admin, c1, cT, cC, S: sol, code } = S; const add = (c, so, o) => X.Private.addAssessment(c, c1, Object.assign({ soldier_id: so.id, strengths: 'מוביל' }, o || {}));
  const a1 = add(cT, sol.a, { improvement_areas: SECRET }); add(cC, sol.a, { strengths: 'חזק בניווט' });
  assert.strictEqual(code(() => add(cT, sol.b)), 'VALIDATION', 'outside the assignment'); assert.strictEqual(code(() => add(S.none, sol.a)), 'VALIDATION');
  assert.deepStrictEqual(X.Private.listAssessments(cT, c1, sol.a.id).map(x => x.author), ['team@x.com']); assert.strictEqual(X.Private.listAssessments(admin, c1, sol.a.id).length, 2); assert.strictEqual(X.Private.listAssessments(S.none, c1, '').length, 0);
  const a2 = add(cT, sol.a, { strengths: 'מוביל מאוד', corrects_id: a1.id }); const L = X.Private.listAssessments(cT, c1, sol.a.id); assert.strictEqual(L.length, 2); assert.strictEqual(L.find(x => x.id === a1.id).superseded, true); assert.strictEqual(X.Db.all('CommanderAssessments').length, 3, 'append-only');
  assert.strictEqual(code(() => add(cC, sol.a, { corrects_id: a1.id })), 'NOT_FOUND', 'cannot correct someone else\'s assessment'); assert.strictEqual(code(() => add(cT, sol.a, { corrects_id: 'nope' })), 'NOT_FOUND');
  [{ strengths: '', improvement_areas: '' }, { strengths: ['x'] }, { strengths: 'x'.repeat(1001) }, { assessment_date: '2026-02-30' }, { domain: 'x'.repeat(61) }].forEach(o => assert.strictEqual(code(() => add(cT, sol.a, o)), 'VALIDATION', JSON.stringify(o).slice(0, 30)));
  assert.ok(!JSON.stringify(X.Db.all('AuditLog').filter(a => a.table_name === 'CommanderAssessments')).includes(SECRET)); X.Soldiers.setActive(admin, sol.a.id, false, X.Db.get('Soldiers', sol.a.id).updated_at, 'שחרור'); assert.strictEqual(X.Private.listAssessments(cT, c1, sol.a.id).length, 0, 'inactive soldier hidden from commander');
});
t('integration', 'shared result notes: visible with the result, mentions validated against course users, author/admin cancel, commander cannot see notes of results he cannot see', () => {
  const S = setup(); const { X, admin, c1, cT, cC, S: sol, code } = S; const nt = X.Navigation.typeCreate(admin, c1, 'ניווט א');
  const r = X.Records.create(admin, 'NavigationTests', c1, { request_id: S.rid(), soldier_id: sol.a.id, test_date: '2026-03-01', navigation_type_id: nt.id, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 }); const rb = X.Records.create(admin, 'NavigationTests', c1, { request_id: S.rid(), soldier_id: sol.b.id, test_date: '2026-03-01', navigation_type_id: nt.id, distance_km: 3, plan_score: 4, debrief_score: 5, points_completed: 2, points_total: 3 });
  const n = X.SharedNotes.add(cT, 'NavigationTests', r.record.id, 'שווה מעקב', ['course@x.com']); assert.strictEqual(X.SharedNotes.list(cC, 'NavigationTests', r.record.id).length, 1);
  assert.strictEqual(code(() => X.SharedNotes.add(cT, 'NavigationTests', rb.record.id, 'x')), 'NOT_FOUND'); assert.strictEqual(code(() => X.SharedNotes.list(cT, 'NavigationTests', rb.record.id)), 'NOT_FOUND');
  assert.strictEqual(code(() => X.SharedNotes.add(cT, 'NavigationTests', r.record.id, 'x', ['ghost@x.com'])), 'VALIDATION'); assert.strictEqual(code(() => X.SharedNotes.add(cT, 'NavigationTests', r.record.id, 'x', 'course@x.com')), 'VALIDATION'); assert.strictEqual(code(() => X.SharedNotes.add(cT, 'NavigationTests', r.record.id, '')), 'VALIDATION'); assert.strictEqual(code(() => X.SharedNotes.add(cT, 'NavigationTests', r.record.id, 7)), 'VALIDATION');
  assert.strictEqual(code(() => X.SharedNotes.cancel(S.cD, n.id)), 'FORBIDDEN', 'not the author'); X.SharedNotes.cancel(cT, n.id); assert.strictEqual(X.SharedNotes.list(cC, 'NavigationTests', r.record.id).length, 0); assert.strictEqual(X.SharedNotes.list(admin, 'NavigationTests', r.record.id)[0].cancelled, true); assert.strictEqual(code(() => X.SharedNotes.cancel(admin, n.id)), 'VALIDATION');
});
done();
