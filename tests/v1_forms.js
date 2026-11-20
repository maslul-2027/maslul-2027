// v1.0.0 soldier update form — Node only.
const { suite } = require('./tlib'); const { t, done, assert } = suite('v1_forms.js'); const { setup } = require('./fixture');
t('integration', 'link -> submit is only a REQUEST (soldier unchanged), admin approval applies via Soldiers.update with audit, single use, token stored only as hash', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const l = X.Forms.createLink(admin, c1, sol.a.id, 3);
  assert.ok(!JSON.stringify(X.Db.all('FormTokens')).includes(l.token) && X.Db.all('FormTokens')[0].token_hash === X.Util.sha256(l.token));
  assert.strictEqual(X.Forms.open(l.token).current.full_name, 'אלף'); const r = X.Forms.submit(l.token, { full_name: 'אלף חדש', pakal: '123' }); assert.strictEqual(r.received, true);
  assert.strictEqual(X.Db.get('Soldiers', sol.a.id).full_name, 'אלף', 'unchanged until approval'); assert.strictEqual(X.Forms.submit(l.token, { pakal: '9' }).duplicate_prevented, true, 'replay confirms prior receipt without creating another request'); assert.strictEqual(code(() => X.Forms.open(l.token)), 'FORBIDDEN');
  const q = X.Forms.list(admin, c1, 'pending'); assert.strictEqual(q.length, 1); assert.deepStrictEqual(q[0].changes.map(c => [c.field, c.from, c.to]), [['full_name', 'אלף', 'אלף חדש'], ['pakal', '', '123']]);
  X.Forms.review(admin, q[0].id, 'approve', ''); const s = X.Db.get('Soldiers', sol.a.id); assert.strictEqual(s.full_name, 'אלף חדש'); assert.strictEqual(s.pakal, '123'); assert.ok(X.Db.where('AuditLog', a => a.action === 'SOLDIER_EDIT').length === 1);
  assert.strictEqual(X.Forms.review(admin, q[0].id, 'approve', '').duplicate_prevented, true, 'replay of same decision is idempotent'); assert.strictEqual(X.Forms.list(admin, c1, 'approved').length, 1);
});
t('hardening', 'submission hardening: whitelist of fields, bad/expired/forged/short/typed tokens look identical, new link revokes old, expiry, archived course / cancelled soldier, no-op, race', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  ['personal_number', 'gender', 'department_id', 'commander_note', 'sociometric_third', 'id', 'course_id', 'pzm_value'].forEach(f => assert.strictEqual(code(() => X.Forms.submit(l.token, { [f]: '1' })), 'VALIDATION', f));
  [{}, [], null, 'x', { full_name: '' }, { full_name: ['a'] }, { enlistment_date: '2026-02-30' }, { full_name: 'אלף' }].forEach(p => assert.strictEqual(code(() => X.Forms.submit(l.token, p)), 'VALIDATION', JSON.stringify(p)));
  const msgs = [undefined, null, '', 'short', 'x'.repeat(48), 'x'.repeat(500), 12345, {}, [l.token], l.token + 'a'].map(tk => { try { X.Forms.submit(tk, { pakal: '1' }); } catch (e) { return e.code + e.message; } }); assert.strictEqual(new Set(msgs).size, 1, 'one uniform failure');
  const l2 = X.Forms.createLink(admin, c1, sol.a.id); assert.strictEqual(code(() => X.Forms.open(l.token)), 'FORBIDDEN', 'old link revoked'); X.Forms.open(l2.token);
  X.Db.update('FormTokens', X.Db.all('FormTokens')[1].id, { expires_at: '2000-01-01T00:00:00.000Z' }); assert.strictEqual(code(() => X.Forms.submit(l2.token, { pakal: '1' })), 'FORBIDDEN', 'expired');
  const l3 = X.Forms.createLink(admin, c1, sol.b.id); X.Soldiers.cancel(admin, sol.b.id, 'ב'); assert.strictEqual(code(() => X.Forms.submit(l3.token, { pakal: '1' })), 'FORBIDDEN', 'cancelled soldier');
  const l4 = X.Forms.createLink(admin, c1, sol.c.id); X.Courses.archive(admin, c1); assert.strictEqual(code(() => X.Forms.submit(l4.token, { pakal: '1' })), 'FORBIDDEN', 'archived course'); assert.strictEqual(X.Db.all('SoldierUpdateRequests').length, 0);
  assert.strictEqual(code(() => X.Forms.createLink(admin, c1, sol.d.id)), 'COURSE_ARCHIVED');
});
t('hardening', 'link/review permissions: admin only; days range; foreign soldier; stale approval conflicts do not corrupt; reject needs a note; two racing submits create one request', () => {
  const S = setup(); const { X, admin, c1, cC, S: sol, code } = S; assert.strictEqual(code(() => X.Forms.createLink(cC, c1, sol.a.id)), 'FORBIDDEN'); assert.strictEqual(code(() => X.Forms.list(cC, c1)), 'FORBIDDEN');
  [0, 31, 1.5, '3', -1].forEach(d => assert.strictEqual(code(() => X.Forms.createLink(admin, c1, sol.a.id, d)), 'VALIDATION', String(d))); assert.strictEqual(code(() => X.Forms.createLink(admin, c1, S.S.f.id)), 'VALIDATION'); assert.strictEqual(code(() => X.Forms.createLink(admin, c1, ['x'])), 'VALIDATION');
  const l = X.Forms.createLink(admin, c1, sol.a.id); X.Forms.submit(l.token, { pakal: '55' }); const id = X.Forms.list(admin, c1)[0].id;
  assert.strictEqual(code(() => X.Forms.review(cC, id, 'approve', '')), 'FORBIDDEN'); assert.strictEqual(code(() => X.Forms.review(admin, id, 'reject', '')), 'VALIDATION'); assert.strictEqual(code(() => X.Forms.review(admin, id, 'maybe', 'x')), 'VALIDATION'); assert.strictEqual(code(() => X.Forms.review(admin, { id: id }, 'approve', '')), 'NOT_FOUND');
  X.Forms.review(admin, id, 'reject', 'לא נכון'); assert.strictEqual(X.Db.get('Soldiers', sol.a.id).pakal, ''); assert.strictEqual(X.Forms.list(admin, c1, 'rejected').length, 1);
  const l2 = X.Forms.createLink(admin, c1, sol.b.id); X.Forms.submit(l2.token, { pakal: '1' }); assert.strictEqual(X.Forms.submit(l2.token, { pakal: '2' }).duplicate_prevented, true); assert.strictEqual(X.Forms.list(admin, c1, 'pending').length, 1);
  const id2 = X.Forms.list(admin, c1, 'pending')[0].id; X.Soldiers.cancel(admin, sol.b.id, 'ב'); assert.strictEqual(code(() => X.Forms.review(admin, id2, 'approve', '')), 'RECORD_CANCELLED'); assert.strictEqual(X.Forms.list(admin, c1, 'pending').length, 1, 'stays pending, nothing applied');
});

t('hardening', 'partial private-contact staging failure is cleaned and leaves no orphaned third-party values or request', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  const original = X.Db.insert; let n = 0;
  X.Db.insert = (table, row) => { if (table === 'SoldierPersonalDetails' && String(row.field_key).indexOf('pending:') === 0 && ++n === 2) throw new Error('injected second private-row failure'); return original(table, row); };
  try { assert.throws(() => X.Forms.submit(l.token, { emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' }), /injected second private-row failure/); }
  finally { X.Db.insert = original; }
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:') === 0).length, 0, 'no pending PII rows remain');
  assert.strictEqual(X.Db.all('SoldierUpdateRequests').length, 0, 'no request row committed');
  assert.strictEqual(X.Forms.open(l.token).fields.length, 3, 'token remains usable for a clean retry');
});

t('hardening', 'request-row insert failure clears all staged private contact values', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  const original = X.Db.insert;
  X.Db.insert = (table, row) => { if (table === 'SoldierUpdateRequests') throw new Error('injected request insert failure'); return original(table, row); };
  try { assert.throws(() => X.Forms.submit(l.token, { emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' }), /injected request insert failure/); }
  finally { X.Db.insert = original; }
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:') === 0).length, 0, 'staged values are cleared');
  assert.strictEqual(X.Db.all('SoldierUpdateRequests').length, 0);
});

t('hardening', 'token-consumption failure after request commit is idempotent: retry returns success without duplicate request or private rows', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  const original = X.Db.update; let fail = true;
  X.Db.update = (table, id, patch) => { if (fail && table === 'FormTokens' && patch.used_at) { fail = false; throw new Error('injected token consume failure'); } return original(table, id, patch); };
  let first; try { first = X.Forms.submit(l.token, { emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' }); }
  finally { X.Db.update = original; }
  assert.strictEqual(first.received, true); assert.strictEqual(first.token_status, 'reconciliation_required');
  const second = X.Forms.submit(l.token, { emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' });
  assert.strictEqual(second.received, true); assert.strictEqual(second.duplicate_prevented, true);
  assert.strictEqual(X.Db.all('SoldierUpdateRequests').length, 1, 'exactly one request');
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:') === 0).length, 3, 'exactly one contact set');
  assert.ok(X.Db.all('FormTokens')[0].used_at, 'retry consumes token');
});


t('hardening', 'request insert that lands before throwing is detected by read-back; staged PII is preserved and retry is idempotent', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  const original = X.Db.insert; let injected = false;
  X.Db.insert = (table, row) => { const out = original(table, row); if (!injected && table === 'SoldierUpdateRequests') { injected = true; throw new Error('injected after-land failure'); } return out; };
  let first; try { first = X.Forms.submit(l.token, { emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' }); }
  finally { X.Db.insert = original; }
  assert.strictEqual(first.received, true); assert.strictEqual(X.Db.all('SoldierUpdateRequests').length, 1);
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:') === 0).length, 3);
  const retry = X.Forms.submit(l.token, { emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' });
  assert.strictEqual(retry.duplicate_prevented, true); assert.strictEqual(X.Db.all('SoldierUpdateRequests').length, 1);
});

t('hardening', 'audit outage after committed form request returns received with warning; retry confirms receipt even after token consumption', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  const original = X.Audit.log;
  X.Audit.log = (ctx, entry) => { if (entry && entry.action === 'FORM_SUBMIT') throw new Error('injected audit outage'); return original(ctx, entry); };
  let first; try { first = X.Forms.submit(l.token, { pakal: '55' }); } finally { X.Audit.log = original; }
  assert.strictEqual(first.received, true); assert.strictEqual(first.audit_status, 'failed'); assert.strictEqual(first.warning_code, 'FORM_AUDIT_WRITE_FAILED');
  const retry = X.Forms.submit(l.token, { pakal: '55' });
  assert.strictEqual(retry.received, true); assert.strictEqual(retry.duplicate_prevented, true);
  assert.strictEqual(X.Db.all('SoldierUpdateRequests').length, 1);
});


t('hardening', 'review is retry-safe when soldier update commits but request-status write fails', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  X.Forms.submit(l.token, { pakal: 'retry-safe' }); const req = X.Forms.list(admin, c1, 'pending')[0];
  const original = X.Db.update; let fail = true;
  X.Db.update = (table, id, patch) => { if (fail && table === 'SoldierUpdateRequests' && patch.status === 'approved') { fail = false; throw new Error('injected status update failure'); } return original(table, id, patch); };
  try { assert.throws(() => X.Forms.review(admin, req.id, 'approve', 'בדיקת ניסיון חוזר'), /injected status update failure/); }
  finally { X.Db.update = original; }
  assert.strictEqual(X.Db.get('Soldiers', sol.a.id).pakal, 'retry-safe', 'soldier change committed on first attempt');
  const retry = X.Forms.review(admin, req.id, 'approve', 'בדיקת ניסיון חוזר');
  assert.strictEqual(retry.status, 'approved'); assert.strictEqual(X.Db.get('SoldierUpdateRequests', req.id).status, 'approved');
  assert.strictEqual(X.Db.get('Soldiers', sol.a.id).pakal, 'retry-safe', 'no duplicate mutation');
});

t('hardening', 'review Audit outage after decision commit returns final status with warning; replay is harmless', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  X.Forms.submit(l.token, { pakal: 'audit-review' }); const req = X.Forms.list(admin, c1, 'pending')[0];
  const original = X.Audit.log;
  X.Audit.log = (ctx, entry) => { if (entry && entry.action === 'FORM_APPROVE') throw new Error('injected review audit outage'); return original(ctx, entry); };
  let result; try { result = X.Forms.review(admin, req.id, 'approve', 'בדיקת ביקורת'); } finally { X.Audit.log = original; }
  assert.strictEqual(result.status, 'approved'); assert.strictEqual(result.audit_status, 'failed'); assert.strictEqual(result.warning_code, 'FORM_REVIEW_AUDIT_WRITE_FAILED');
  assert.strictEqual(X.Forms.review(admin, req.id, 'approve', 'בדיקת ביקורת').duplicate_prevented, true);
  assert.strictEqual(X.Db.get('Soldiers', sol.a.id).pakal, 'audit-review');
});

t('hardening', 'link creation Audit outage returns the committed one-time token with a warning instead of stranding the soldier', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S;
  const original = X.Audit.log;
  X.Audit.log = (ctx, entry) => { if (entry && entry.action === 'FORM_LINK_CREATE') throw new Error('injected link audit outage'); return original(ctx, entry); };
  let link; try { link = X.Forms.createLink(admin, c1, sol.a.id); } finally { X.Audit.log = original; }
  assert.ok(link.token); assert.strictEqual(link.audit_status, 'failed'); assert.strictEqual(link.warning_code, 'FORM_LINK_AUDIT_WRITE_FAILED');
  assert.strictEqual(X.Forms.open(link.token).fields.length, 3, 'returned token is the committed active credential');
  assert.strictEqual(X.Db.all('FormTokens').length, 1);
});

t('hardening', 'new-link insert failure preserves the previous active link', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const first = X.Forms.createLink(admin, c1, sol.a.id);
  const original = X.Db.insert;
  X.Db.insert = (table, row) => { if (table === 'FormTokens') throw new Error('injected token insert failure'); return original(table, row); };
  try { assert.throws(() => X.Forms.createLink(admin, c1, sol.a.id), /injected token insert failure/); }
  finally { X.Db.insert = original; }
  X.Forms.open(first.token); assert.strictEqual(X.Db.all('FormTokens').length, 1); assert.strictEqual(code(() => X.Forms.open('x'.repeat(48))), 'FORBIDDEN');
});

t('hardening', 'link replacement reconciles a revoke write that lands before throwing', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const first = X.Forms.createLink(admin, c1, sol.a.id);
  const original = X.Db.update; let injected = false;
  X.Db.update = (table, id, patch) => { const out = original(table, id, patch); if (!injected && table === 'FormTokens' && String(patch.used_at || '').indexOf('revoked:') === 0) { injected = true; throw new Error('injected after-land revoke failure'); } return out; };
  let second; try { second = X.Forms.createLink(admin, c1, sol.a.id); } finally { X.Db.update = original; }
  assert.ok(injected); assert.ok(second.token); assert.strictEqual(code(() => X.Forms.open(first.token)), 'FORBIDDEN'); X.Forms.open(second.token);
});

t('hardening', 'link replacement invalidates the new token when old-link revocation cannot be confirmed', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const first = X.Forms.createLink(admin, c1, sol.a.id);
  const original = X.Db.update; let firstFailure = true;
  X.Db.update = (table, id, patch) => {
    if (table === 'FormTokens' && String(patch.used_at || '').indexOf('revoked:') === 0 && firstFailure) { firstFailure = false; throw new Error('injected revoke failure'); }
    return original(table, id, patch);
  };
  try { assert.strictEqual(code(() => X.Forms.createLink(admin, c1, sol.a.id)), 'FORM_LINK_REVOKE_FAILED'); }
  finally { X.Db.update = original; }
  X.Forms.open(first.token); assert.strictEqual(X.Db.where('FormTokens', r => r.soldier_id === sol.a.id && !r.used_at).length, 1, 'only the prior link remains active');
});

t('hardening', 'token insert that lands but cannot be read back is invalidated before returning a failure', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S; const first = X.Forms.createLink(admin, c1, sol.a.id);
  const originalInsert = X.Db.insert, originalGet = X.Db.get; let readFailure = false;
  X.Db.insert = (table, row) => { const out = originalInsert(table, row); if (table === 'FormTokens') throw new Error('injected insert-after-land'); return out; };
  X.Db.get = (table, id) => { if (table === 'FormTokens' && !readFailure) { readFailure = true; throw new Error('injected read-back outage'); } return originalGet(table, id); };
  try { assert.strictEqual(code(() => X.Forms.createLink(admin, c1, sol.a.id)), 'FORM_LINK_CREATE_UNCERTAIN'); }
  finally { X.Db.insert = originalInsert; X.Db.get = originalGet; }
  X.Forms.open(first.token);
  assert.strictEqual(X.Db.where('FormTokens', r => r.soldier_id === sol.a.id && !r.used_at).length, 1, 'only the previous token remains active');
});


t('hardening', 'partial pending-contact staging that lands then throws is fully discarded and leaves no orphan PII', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  const original = X.Db.insert; let n = 0;
  X.Db.insert = (table, row) => {
    const out = original(table, row);
    if (table === 'SoldierPersonalDetails' && String(row.field_key).indexOf('pending:') === 0 && ++n === 2) throw new Error('injected pending insert after commit');
    return out;
  };
  try { assert.throws(() => X.Forms.submit(l.token, { emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' }), /injected pending insert after commit/); }
  finally { X.Db.insert = original; }
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:') === 0).length, 0, 'no orphan pending rows');
  assert.strictEqual(X.Db.all('SoldierUpdateRequests').length, 0, 'no request without its complete contact');
});

t('hardening', 'approval retry completes all canonical emergency-contact fields after an after-commit partial write failure', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  X.Forms.submit(l.token, { emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' });
  const req = X.Forms.list(admin, c1, 'pending')[0];
  const original = X.Db.insert; let n = 0;
  X.Db.insert = (table, row) => {
    const out = original(table, row);
    if (table === 'SoldierPersonalDetails' && String(row.field_key).indexOf('emergency_contact_') === 0 && ++n === 2) throw new Error('injected canonical insert after commit');
    return out;
  };
  try { assert.throws(() => X.Forms.review(admin, req.id, 'approve', 'בדיקת התאוששות'), /injected canonical insert after commit/); }
  finally { X.Db.insert = original; }
  assert.strictEqual(X.Db.get('SoldierUpdateRequests', req.id).status, 'pending', 'request remains pending for retry');
  const retry = X.Forms.review(admin, req.id, 'approve', 'בדיקת התאוששות');
  assert.strictEqual(retry.status, 'approved');
  const canonical = X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.a.id && String(r.field_key).indexOf('emergency_contact_') === 0);
  assert.strictEqual(canonical.length, 3); assert.ok(canonical.every(r => !!r.field_value));
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:') === 0).length, 0);
});

t('hardening', 'approval retry after partial pending-row cleanup preserves the already-applied complete contact', () => {
  const S = setup(); const { X, admin, c1, S: sol } = S; const l = X.Forms.createLink(admin, c1, sol.a.id);
  X.Forms.submit(l.token, { emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' });
  const req = X.Forms.list(admin, c1, 'pending')[0];
  const original = X.Db.update; let n = 0;
  X.Db.update = (table, id, patch) => {
    const out = original(table, id, patch);
    if (table === 'SoldierPersonalDetails' && String(patch.field_key || '').indexOf('resolved:') === 0 && ++n === 2) throw new Error('injected pending cleanup after commit');
    return out;
  };
  try { assert.throws(() => X.Forms.review(admin, req.id, 'approve', 'בדיקת ניקוי'), /injected pending cleanup after commit/); }
  finally { X.Db.update = original; }
  assert.strictEqual(X.Db.get('SoldierUpdateRequests', req.id).status, 'pending');
  const retry = X.Forms.review(admin, req.id, 'approve', 'בדיקת ניקוי');
  assert.strictEqual(retry.status, 'approved');
  const canonical = X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.a.id && String(r.field_key).indexOf('emergency_contact_') === 0);
  assert.strictEqual(canonical.length, 3); assert.ok(canonical.every(r => !!r.field_value));
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:') === 0).length, 0);
});


t('hardening', 'approval refuses incomplete or duplicate pending emergency-contact rows before applying any other request fields', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S;
  const link = X.Forms.createLink(admin, c1, sol.a.id);
  X.Forms.submit(link.token, { pakal: '77', emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' });
  const req = X.Forms.list(admin, c1, 'pending')[0];
  const pending = X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.a.id && String(r.field_key).indexOf('pending:' + req.id + ':') === 0);
  assert.strictEqual(pending.length, 3);
  X.Db.update('SoldierPersonalDetails', pending[1].id, { field_value: '' });
  assert.strictEqual(code(() => X.Forms.review(admin, req.id, 'approve', 'בדיקת שלמות')), 'EMERGENCY_CONTACT_INCOMPLETE');
  assert.strictEqual(X.Db.get('SoldierUpdateRequests', req.id).status, 'pending');
  assert.strictEqual(X.Db.get('Soldiers', sol.a.id).pakal, '', 'ordinary fields must not be partially applied');
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:' + req.id + ':') === 0).length, 3, 'pending data remains for admin decision');
  // A duplicate row is also ambiguous and must not be silently accepted.
  X.Db.insert('SoldierPersonalDetails', Object.assign({}, pending[0], { id: X.Util.uuid(), field_value: 'Conflicting duplicate' }));
  assert.strictEqual(code(() => X.Forms.review(admin, req.id, 'approve', 'בדיקת כפילות')), 'EMERGENCY_CONTACT_INCOMPLETE');
  assert.strictEqual(X.Db.get('SoldierUpdateRequests', req.id).status, 'pending');
  assert.strictEqual(X.Forms.review(admin, req.id, 'reject', 'פרטי איש קשר לא שלמים').status, 'rejected');
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:' + req.id + ':') === 0).length, 0, 'reject clears all staged rows');
});



t('hardening', 'orphan pending-contact reconciliation is admin-only, previews metadata only, and clears only groups without a request row', () => {
  const S = setup(); const { X, admin, c1, cT, S: sol, as } = S;
  const valid = X.Forms.createLink(admin, c1, sol.a.id);
  X.Forms.submit(valid.token, { emergency_contact_name: 'VALID-PRIVATE-NAME', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' });
  const orphanId = X.Util.uuid();
  ['emergency_contact_name', 'emergency_contact_phone'].forEach((key, i) => X.Db.insert('SoldierPersonalDetails', { id: X.Util.uuid(), course_id: c1, soldier_id: sol.b.id, field_key: 'pending:' + orphanId + ':' + key, field_value: 'ORPHAN-SECRET-' + i, sensitivity_class: 'third_party_sensitive', updated_at: X.Util.nowIso(), updated_by: 'form:' + sol.b.id }));
  const preview = as(admin, 'emergency.orphans', { courseId: c1 }); assert.strictEqual(preview.ok, true); assert.strictEqual(preview.data.preview, true); assert.strictEqual(preview.data.orphan_groups, 1); assert.strictEqual(preview.data.orphan_rows, 2);
  assert.ok(!JSON.stringify(preview.data).includes('ORPHAN-SECRET')); assert.ok(!JSON.stringify(preview.data).includes('VALID-PRIVATE-NAME'));
  assert.strictEqual(as(cT, 'emergency.orphans', { courseId: c1, apply: true }).ok, false, 'commander is denied');
  const result = as(admin, 'emergency.orphans', { courseId: c1, apply: true }); assert.strictEqual(result.ok, true); assert.strictEqual(result.data.cleared_groups, 1); assert.strictEqual(result.data.cleared_rows, 2);
  const rows = X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.b.id && String(r.field_key).indexOf('pending:' + orphanId + ':') === 0);
  assert.strictEqual(rows.length, 0);
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.a.id && String(r.field_key).indexOf('pending:') === 0).length, 3, 'valid pending request preserved');
  assert.ok(!JSON.stringify(X.Db.all('SoldierPersonalDetails')).includes('ORPHAN-SECRET'));
  const auditRows = X.Db.where('AuditLog', r => /^EMERGENCY_ORPHAN_RECONCILE/.test(r.action)); assert.ok(auditRows.length >= 2); assert.ok(!JSON.stringify(auditRows).includes('ORPHAN-SECRET'), 'audit carries no contact values');
});

t('hardening', 'orphan scan reports linked-but-inconsistent requests and never cleans them automatically', () => {
  const S = setup(); const { X, admin, c1, S: sol, as } = S;
  // Existing request with no emergency marker, but a leftover pending private row.
  const plainLink = X.Forms.createLink(admin, c1, sol.a.id);
  X.Forms.submit(plainLink.token, { pakal: 'plain-request' });
  const plainRequest = X.Db.all('SoldierUpdateRequests')[0];
  X.Db.insert('SoldierPersonalDetails', { id: X.Util.uuid(), course_id: c1, soldier_id: sol.a.id, field_key: 'pending:' + plainRequest.id + ':emergency_contact_name', field_value: 'DO-NOT-RETURN-SECRET', sensitivity_class: 'third_party_sensitive', updated_at: X.Util.nowIso(), updated_by: 'form:' + sol.a.id });

  // Existing pending request with marker, but one of the three required fields is missing.
  const partialLink = X.Forms.createLink(admin, c1, sol.b.id);
  X.Forms.submit(partialLink.token, { emergency_contact_name: 'שם פרטי', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' });
  const emergencyRequest = X.Db.where('SoldierUpdateRequests', r => r.soldier_id === sol.b.id)[0];
  const relation = X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.b.id && String(r.field_key).indexOf('pending:' + emergencyRequest.id + ':') === 0 && String(r.field_key).indexOf('relation') !== -1)[0];
  X.Db.update('SoldierPersonalDetails', relation.id, { field_value: '' });

  const preview = as(admin, 'emergency.orphans', { courseId: c1 });
  assert.strictEqual(preview.ok, true);
  assert.strictEqual(preview.data.orphan_groups, 0);
  assert.strictEqual(preview.data.review_required_groups, 2);
  assert.strictEqual(preview.data.review_required.length, 2);
  assert.ok(!JSON.stringify(preview.data).includes('DO-NOT-RETURN-SECRET'));
  const apply = as(admin, 'emergency.orphans', { courseId: c1, apply: true });
  assert.strictEqual(apply.ok, true);
  assert.strictEqual(apply.data.cleared_groups, undefined, 'no unlinked orphan candidate should be cleared');
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.a.id && String(r.field_key).indexOf('pending:' + plainRequest.id + ':') === 0).length, 1);
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.b.id && String(r.field_key).indexOf('pending:' + emergencyRequest.id + ':') === 0).length, 3);
});

t('hardening', 'orphan reconciliation treats duplicate request IDs as ambiguous regardless of row order', () => {
  const S = setup(); const { X, admin, c1, S: sol, as } = S;
  const link = X.Forms.createLink(admin, c1, sol.a.id);
  X.Forms.submit(link.token, { pakal: 'duplicate-id-control' });
  const request = X.Db.all('SoldierUpdateRequests')[0];
  const orphanRows = ['emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone'];
  orphanRows.forEach((field, i) => X.Db.insert('SoldierPersonalDetails', { id: X.Util.uuid(), course_id: c1, soldier_id: sol.a.id,
    field_key: 'pending:' + request.id + ':' + field, field_value: 'DUPLICATE-ID-SECRET-' + i,
    sensitivity_class: 'third_party_sensitive', updated_at: X.Util.nowIso(), updated_by: 'form:' + sol.a.id }));
  // Same ID and scope, but a conflicting request row. A single-value map would silently let
  // the last row win and could classify the staged PII differently based on sheet ordering.
  X.Db.insert('SoldierUpdateRequests', Object.assign({}, request, { status: 'rejected', payload_json: '{}', review_note: 'synthetic duplicate id' }));
  const preview = as(admin, 'emergency.orphans', { courseId: c1 });
  assert.strictEqual(preview.ok, true);
  assert.strictEqual(preview.data.orphan_groups, 0);
  assert.strictEqual(preview.data.ambiguous_groups, 1);
  assert.ok(!JSON.stringify(preview.data).includes('DUPLICATE-ID-SECRET'));
  const apply = as(admin, 'emergency.orphans', { courseId: c1, apply: true });
  assert.strictEqual(apply.ok, true);
  assert.strictEqual(apply.data.cleared_rows, undefined);
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.a.id && String(r.field_key).indexOf('pending:' + request.id + ':') === 0).length, 3);
});

t('hardening', 'orphan reconciliation safely handles prototype-like imported request IDs without crashing or misclassifying', () => {
  const S = setup(); const { X, admin, c1, S: sol, as } = S;
  const ids = ['__proto__', 'constructor', 'toString'];
  ids.forEach((id, index) => {
    X.Db.insert('SoldierUpdateRequests', { id, course_id: c1, soldier_id: sol.a.id, status: 'rejected', payload_json: '{}', review_note: 'synthetic prototype-like ID' });
    ['emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone'].forEach((field, j) => {
      X.Db.insert('SoldierPersonalDetails', { id: X.Util.uuid(), course_id: c1, soldier_id: sol.a.id,
        field_key: 'pending:' + id + ':' + field, field_value: 'PROTOTYPE-ID-SECRET-' + index + '-' + j,
        sensitivity_class: 'third_party_sensitive', updated_at: X.Util.nowIso(), updated_by: 'form:' + sol.a.id });
    });
  });
  const preview = as(admin, 'emergency.orphans', { courseId: c1 });
  assert.strictEqual(preview.ok, true, 'untrusted imported IDs must not crash the scan');
  assert.strictEqual(preview.data.orphan_groups, 0);
  assert.strictEqual(preview.data.review_required_groups, 3);
  assert.ok(!JSON.stringify(preview.data).includes('PROTOTYPE-ID-SECRET'), 'report is metadata-only');
  const apply = as(admin, 'emergency.orphans', { courseId: c1, apply: true });
  assert.strictEqual(apply.ok, true);
  assert.strictEqual(apply.data.cleared_rows, undefined, 'ambiguous linked rows are never auto-cleared');
  ids.forEach(id => assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.a.id && String(r.field_key).indexOf('pending:' + id + ':') === 0).length, 3));
});

t('hardening', 'orphan reconciliation keeps request/soldier tuples distinct when IDs contain the grouping delimiter', () => {
  const S = setup(); const { X, admin, c1, as } = S;
  const pairs = [['a|b', 'c'], ['a', 'b|c']];
  pairs.forEach(([requestId, soldierId], pairIndex) => {
    ['emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone'].forEach((field, j) => {
      X.Db.insert('SoldierPersonalDetails', { id: X.Util.uuid(), course_id: c1, soldier_id: soldierId,
        field_key: 'pending:' + requestId + ':' + field, field_value: 'TUPLE-SECRET-' + pairIndex + '-' + j,
        sensitivity_class: 'third_party_sensitive', updated_at: X.Util.nowIso(), updated_by: 'form:' + soldierId });
    });
  });
  const preview = as(admin, 'emergency.orphans', { courseId: c1 });
  assert.strictEqual(preview.ok, true);
  assert.strictEqual(preview.data.orphan_groups, 2, 'distinct tuples must not collapse into one group');
  assert.strictEqual(preview.data.orphan_rows, 6);
  assert.strictEqual(preview.data.groups.length, 2);
  assert.ok(!JSON.stringify(preview.data).includes('TUPLE-SECRET'));
  const apply = as(admin, 'emergency.orphans', { courseId: c1, apply: true });
  assert.strictEqual(apply.ok, true);
  assert.strictEqual(apply.data.cleared_rows, 6);
});

t('hardening', 'orphan reconciliation retry completes a partially failed cleanup without deleting valid pending requests', () => {
  const S = setup(); const { X, admin, c1, S: sol, as } = S; const id = X.Util.uuid();
  ['emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone'].forEach((key, i) => X.Db.insert('SoldierPersonalDetails', { id: X.Util.uuid(), course_id: c1, soldier_id: sol.c.id, field_key: 'pending:' + id + ':' + key, field_value: 'PRIVATE-' + i, sensitivity_class: 'third_party_sensitive', updated_at: X.Util.nowIso(), updated_by: 'form:' + sol.c.id }));
  const original = X.Db.update; let n = 0;
  X.Db.update = (table, rowId, patch) => { if (table === 'SoldierPersonalDetails' && String(patch.field_key || '').indexOf('orphan_discarded:') === 0 && ++n === 2) throw new Error('injected cleanup outage'); return original(table, rowId, patch); };
  try { const failed = as(admin, 'emergency.orphans', { courseId: c1, apply: true }); assert.strictEqual(failed.ok, false); assert.strictEqual(failed.code, 'PENDING_RECONCILIATION_PARTIAL'); }
  finally { X.Db.update = original; }
  const retry = as(admin, 'emergency.orphans', { courseId: c1, apply: true }); assert.strictEqual(retry.ok, true); assert.strictEqual(retry.data.orphan_groups, 1); assert.strictEqual(retry.data.cleared_rows, 2);
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.c.id && String(r.field_key).indexOf('pending:' + id + ':') === 0).length, 0);
});


t('hardening', 'orphan reconciliation retry handles a cleanup write that commits then loses its response; intent remains audited', () => {
  const S = setup(); const { X, admin, c1, S: sol, as } = S; const id = X.Util.uuid();
  ['emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone'].forEach((key, i) => X.Db.insert('SoldierPersonalDetails', { id: X.Util.uuid(), course_id: c1, soldier_id: sol.d.id, field_key: 'pending:' + id + ':' + key, field_value: 'LOST-RESPONSE-PRIVATE-' + i, sensitivity_class: 'third_party_sensitive', updated_at: X.Util.nowIso(), updated_by: 'form:' + sol.d.id }));
  const original = X.Db.update; let n = 0;
  X.Db.update = (table, rowId, patch) => { const result = original(table, rowId, patch); if (table === 'SoldierPersonalDetails' && String(patch.field_key || '').indexOf('orphan_discarded:') === 0 && ++n === 2) throw new Error('injected lost cleanup response'); return result; };
  try { const failed = as(admin, 'emergency.orphans', { courseId: c1, apply: true }); assert.strictEqual(failed.ok, false); assert.strictEqual(failed.code, 'PENDING_RECONCILIATION_PARTIAL'); }
  finally { X.Db.update = original; }
  assert.ok(X.Db.where('AuditLog', r => r.action === 'EMERGENCY_ORPHAN_RECONCILE_START').length >= 1, 'intent recorded before partial mutation');
  const retry = as(admin, 'emergency.orphans', { courseId: c1, apply: true }); assert.strictEqual(retry.ok, true); assert.strictEqual(retry.data.orphan_rows, 1); assert.strictEqual(retry.data.cleared_rows, 1);
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.d.id && String(r.field_key).indexOf('pending:' + id + ':') === 0).length, 0);
  assert.ok(!JSON.stringify(X.Db.all('SoldierPersonalDetails')).includes('LOST-RESPONSE-PRIVATE'));
});

t('hardening', 'orphan reconciliation skips ambiguous request-id collisions and reports audit failure without restoring cleared PII', () => {
  const S = setup(); const { X, admin, c1, S: sol, as } = S; const link = X.Forms.createLink(admin, c1, sol.d.id); X.Forms.submit(link.token, { pakal: 'collision' });
  const req = X.Db.all('SoldierUpdateRequests')[0]; const otherSoldier = sol.b.id;
  X.Db.insert('SoldierPersonalDetails', { id: X.Util.uuid(), course_id: c1, soldier_id: otherSoldier, field_key: 'pending:' + req.id + ':emergency_contact_name', field_value: 'AMBIGUOUS-SECRET', sensitivity_class: 'third_party_sensitive', updated_at: X.Util.nowIso(), updated_by: 'form:' + otherSoldier });
  const preview = as(admin, 'emergency.orphans', { courseId: c1 }); assert.strictEqual(preview.data.orphan_groups, 0); assert.strictEqual(preview.data.ambiguous_groups, 1);
  const orphanId = X.Util.uuid(); X.Db.insert('SoldierPersonalDetails', { id: X.Util.uuid(), course_id: c1, soldier_id: sol.c.id, field_key: 'pending:' + orphanId + ':emergency_contact_name', field_value: 'AUDIT-SECRET', sensitivity_class: 'third_party_sensitive', updated_at: X.Util.nowIso(), updated_by: 'form:' + sol.c.id });
  const originalAudit = X.Audit.log; X.Audit.log = (ctx, entry) => { if (entry && entry.action === 'EMERGENCY_ORPHAN_RECONCILE') throw new Error('injected audit outage'); return originalAudit(ctx, entry); };
  let result; try { result = as(admin, 'emergency.orphans', { courseId: c1, apply: true }); } finally { X.Audit.log = originalAudit; }
  assert.strictEqual(result.ok, true); assert.strictEqual(result.data.audit_status, 'failed'); assert.strictEqual(result.data.warning_code, 'EMERGENCY_ORPHAN_AUDIT_WRITE_FAILED');
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.c.id && String(r.field_key).indexOf('pending:' + orphanId + ':') === 0).length, 0);
  assert.ok(!JSON.stringify(result.data).includes('AUDIT-SECRET'));
});


t('hardening', 'approval refuses incomplete or duplicate pending emergency-contact rows before applying any other request fields', () => {
  const S = setup(); const { X, admin, c1, S: sol, code } = S;
  const link = X.Forms.createLink(admin, c1, sol.a.id);
  X.Forms.submit(link.token, { pakal: '77', emergency_contact_name: 'איש קשר', emergency_contact_relation: 'הורה', emergency_contact_phone: '0501234567' });
  const req = X.Forms.list(admin, c1, 'pending')[0];
  const pending = X.Db.where('SoldierPersonalDetails', r => r.soldier_id === sol.a.id && String(r.field_key).indexOf('pending:' + req.id + ':') === 0);
  assert.strictEqual(pending.length, 3);
  X.Db.update('SoldierPersonalDetails', pending[1].id, { field_value: '' });
  assert.strictEqual(code(() => X.Forms.review(admin, req.id, 'approve', 'בדיקת שלמות')), 'EMERGENCY_CONTACT_INCOMPLETE');
  assert.strictEqual(X.Db.get('SoldierUpdateRequests', req.id).status, 'pending');
  assert.strictEqual(X.Db.get('Soldiers', sol.a.id).pakal, '', 'ordinary fields must not be partially applied');
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:' + req.id + ':') === 0).length, 3, 'pending data remains for admin decision');
  // A duplicate row is also ambiguous and must not be silently accepted.
  X.Db.insert('SoldierPersonalDetails', Object.assign({}, pending[0], { id: X.Util.uuid(), field_value: 'Conflicting duplicate' }));
  assert.strictEqual(code(() => X.Forms.review(admin, req.id, 'approve', 'בדיקת כפילות')), 'EMERGENCY_CONTACT_INCOMPLETE');
  assert.strictEqual(X.Db.get('SoldierUpdateRequests', req.id).status, 'pending');
  assert.strictEqual(X.Forms.review(admin, req.id, 'reject', 'פרטי איש קשר לא שלמים').status, 'rejected');
  assert.strictEqual(X.Db.where('SoldierPersonalDetails', r => String(r.field_key).indexOf('pending:' + req.id + ':') === 0).length, 0, 'reject clears all staged rows');
});

done();
