/**
 * Soldier detail updates via a personal one-time link + company-commander approval — v1.0.0.
 * - Admin issues a link for ONE soldier (random token; only its SHA-256 hash is stored; shown once; expires; single use; a new link revokes the old one).
 * - Submission needs NO login (the token is the credential) => it is exposed through formSubmit() only; the web app deployment that allows anonymous access is a DEPLOYMENT DECISION (open, see DECISIONS_NEEDED).
 * - A submission is only a REQUEST: nothing changes in the soldier record until the admin approves; approval applies the change through Soldiers.update (audit with reason, concurrency).
 * - Allowed fields are a fixed whitelist (FORM_FIELDS) — never personal number, gender, department/team, scores or notes. Every failure of a bad token looks the same.
 */
const Forms = {
  FORM_FIELDS: ['full_name', 'pakal', 'enlistment_date'],
  /**
   * R3 — the ONE general fill-in link of the (external) Google Form where soldiers enter their personal details. READ-ONLY.
   * The link is NOT invented and NOT stored by this app: it comes from the Script Property PERSONAL_FORM_URL (set by the owner in the Apps Script project settings; never in code).
   * Only a respondent (fill-in) link is ever returned: https://docs.google.com/forms/d/e/<id>/viewform[?query] or https://forms.gle/<id>. Edit / manage links, other hosts, http, credentials, spaces => treated as invalid and NOT echoed.
   * Allowed for the admin and for commanders who have an active assignment in the course. Changes nothing; no audit row (a read).
   */
  PERSONAL_FORM_PROP: 'PERSONAL_FORM_URL',
  _urlProvider: function () { return typeof PropertiesService === 'undefined' ? '' : PropertiesService.getScriptProperties().getProperty(Forms.PERSONAL_FORM_PROP); },
  fillUrl_(raw) {
    const u = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!u) return '';
    if (/[\s<>"'\\]/.test(u) || u.length > 400) return null;
    const m = /^https:\/\/(docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]{10,}\/viewform(\?[A-Za-z0-9_.~%&=+-]*)?|forms\.gle\/[A-Za-z0-9_-]{4,})$/.exec(u);
    return m ? u : null;
  },
  generalLink(ctx, courseId) {
    Records.guardCourse_(ctx, 'soldier.read', courseId);
    if (ctx.role !== ROLES.ADMIN && !Assignments.mine(ctx, courseId).has_assignment) throw new AppError('FORBIDDEN', 'אין הרשאה.');   // a commander without any assignment in the course has no soldiers to work with
    const raw = Forms._urlProvider(), url = Forms.fillUrl_(raw);
    if (url === '') return { configured: false, reason: 'not_set', message: 'קישור הטופס לא הוגדר במערכת. יש לבקש מבעל המערכת להגדיר את מאפיין הסקריפט PERSONAL_FORM_URL בקישור המילוי של הטופס.' };
    if (url === null) return { configured: false, reason: 'invalid', message: 'הקישור שהוגדר אינו קישור מילוי תקין של Google Forms (למשל קישור עריכה או כתובת אחרת) ולכן אינו מוצג.' };
    return { configured: true, url: url };
  },
  DEFAULT_DAYS: 7, MAX_DAYS: 30,
  BAD: 'הקישור אינו תקף או שפג תוקפו.',

  createLink(ctx, courseId, soldierId, days) {
    Records.guardCourse_(ctx, 'form.manage', courseId); Soldiers.scalar_(soldierId, 'soldier_id');
    const d = days === undefined || days === null ? Forms.DEFAULT_DAYS : days; if (!Number.isInteger(d) || d < 1 || d > Forms.MAX_DAYS) throw new AppError('VALIDATION', 'תוקף הקישור: 1–' + Forms.MAX_DAYS + ' ימים.');
    const s = Db.get('Soldiers', Util.str(soldierId)); if (!s || s.course_id !== courseId || s.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'form.manage', courseId); const now = Util.nowIso();
      const previous = Db.where('FormTokens', function (t) { return t.soldier_id === s.id && !t.used_at && t.expires_at > now; });
      const token = Util.randomToken(), exp = new Date(Date.now() + d * 86400000).toISOString();
      const row = { id: Util.uuid(), course_id: courseId, soldier_id: s.id, token_hash: Util.sha256(token), expires_at: exp, used_at: '', created_by: ctx.email, created_at: now };

      // Commit the new credential before revoking the previous one. If insertion fails, the
      // soldier's existing link remains usable. If revocation is interrupted, reconcile from
      // durable rows and invalidate the new credential unless every previous link is revoked.
      try { Db.insert('FormTokens', row); }
      catch (insertError) {
        let landed = null, readFailed = false;
        try { landed = Db.get('FormTokens', row.id); } catch (readError) { readFailed = true; }
        if (!landed && readFailed) {
          // A write may have landed while the read-back failed. Since the plaintext token has
          // not been returned, try to revoke this uncertain credential and verify that action.
          try { Db.update('FormTokens', row.id, { used_at: 'revoked:' + now }); } catch (e) { /* verify below */ }
          let state = null; try { state = Db.get('FormTokens', row.id); } catch (e) { /* unresolved */ }
          if (!state || !state.used_at) throw new AppError('FORM_LINK_RECONCILIATION_REQUIRED', 'לא ניתן לאמת את הנפקת הקישור. יש לפנות למנהל המערכת לפני ניסיון נוסף.');
          throw new AppError('FORM_LINK_CREATE_UNCERTAIN', 'הנפקת הקישור בוטלה לאחר שלא ניתן היה לאמת את השמירה. ניתן לנסות שוב.');
        }
        if (!landed) throw insertError;
      }
      for (let i = 0; i < previous.length; i++) {
        try { Db.update('FormTokens', previous[i].id, { used_at: 'revoked:' + now }); }
        catch (e) { break; } // durable read-back below decides whether revocation actually landed
      }
      let stillActive;
      try {
        stillActive = Db.where('FormTokens', function (t) {
          return t.soldier_id === s.id && t.id !== row.id && !t.used_at && t.expires_at > now;
        });
      } catch (readError) {
        // If state cannot be read, fail closed by trying to invalidate the new credential.
        try { Db.update('FormTokens', row.id, { used_at: 'revoked:' + now }); } catch (e) { /* read-back below */ }
        let uncertain;
        try { uncertain = Db.get('FormTokens', row.id); } catch (e) { uncertain = null; }
        if (!uncertain || !uncertain.used_at) throw new AppError('FORM_LINK_RECONCILIATION_REQUIRED', 'לא ניתן לאמת את מצב הקישורים. יש לפנות למנהל המערכת לפני הנפקת קישור נוסף.');
        throw new AppError('FORM_LINK_REVOKE_FAILED', 'לא ניתן היה לאמת את ביטול הקישור הקודם. הקישור החדש בוטל; יש לבדוק את המערכת לפני ניסיון נוסף.');
      }
      if (stillActive.length) {
        // Do not leave two simultaneously valid links when revocation cannot be confirmed.
        try { Db.update('FormTokens', row.id, { used_at: 'revoked:' + now }); } catch (e) { /* verify below */ }
        const newState = Db.get('FormTokens', row.id);
        const oldState = Db.where('FormTokens', function (t) {
          return t.soldier_id === s.id && t.id !== row.id && !t.used_at && t.expires_at > now;
        });
        if (!newState || !newState.used_at) {
          throw new AppError('FORM_LINK_RECONCILIATION_REQUIRED', 'לא ניתן לאמת החלפה בטוחה של הקישור. יש לפנות למנהל המערכת לפני הנפקת קישור נוסף.');
        }
        throw new AppError('FORM_LINK_REVOKE_FAILED', 'הקישור הקודם לא בוטל באופן מלא. ניתן להמשיך להשתמש בקישור הקודם; יש לנסות שוב לאחר בדיקת המערכת.');
      }

      let auditRecorded = true;
      try { Audit.log(ctx, { courseId: courseId, action: 'FORM_LINK_CREATE', table: 'FormTokens', recordId: row.id, after: { soldier_id: s.id, expires_at: exp } }); }
      catch (e) { auditRecorded = false; }
      return { token: token, expires_at: exp, soldier_id: s.id, fields: Forms.FORM_FIELDS,
        audit_status: auditRecorded ? 'recorded' : 'failed', warning_code: auditRecorded ? '' : 'FORM_LINK_AUDIT_WRITE_FAILED' };
    });
  },

  /** Anonymous entry (no ctx). Returns what the form needs to display (soldier's first name field values, not the full record). */
  open(token) {
    const t = Forms.find_(token); if (!t) throw new AppError('FORBIDDEN', Forms.BAD);
    const s = Db.get('Soldiers', t.soldier_id); return { fields: Forms.FORM_FIELDS, emergency_fields: EmergencyContact.KEYS, current: { full_name: s.full_name, pakal: s.pakal, enlistment_date: Util.cellToIsoDate(s.enlistment_date) } };   // emergency contact: field names only, NEVER current values (the form may not read it back)
  },
  tokenRecord_(token) {
    if (typeof token !== 'string' || token.length < 24 || token.length > 128) return null;
    const h = Util.sha256(token);
    return Db.where('FormTokens', function (x) { return x.token_hash === h; })[0] || null;
  },
  find_(token) {
    const t = Forms.tokenRecord_(token);
    if (!t || t.used_at || t.expires_at <= Util.nowIso()) return null;
    const s = Db.get('Soldiers', t.soldier_id), c = Db.get('Courses', t.course_id);
    if (!s || s.record_status !== RECORD_STATUS.ACTIVE || !c || c.status === COURSE_STATUS.ARCHIVED) return null;
    return t;
  },
  submit(token, payload) {
    const tokenRecord = Forms.tokenRecord_(token); if (!tokenRecord) throw new AppError('FORBIDDEN', Forms.BAD);
    const alreadyCommitted = Db.where('SoldierUpdateRequests', function (r) { return r.token_id === tokenRecord.id; })[0];
    if (!alreadyCommitted && !Forms.find_(token)) throw new AppError('FORBIDDEN', Forms.BAD);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AppError('VALIDATION', 'נתונים לא תקינים.');
    const allowed = Forms.FORM_FIELDS.concat(EmergencyContact.KEYS);
    Object.keys(payload).forEach(function (k) { if (allowed.indexOf(k) === -1) throw new AppError('VALIDATION', 'שדה לא מותר בטופס.'); });
    const soldierPart = {}; Forms.FORM_FIELDS.forEach(function (k) { if (payload[k] !== undefined) soldierPart[k] = payload[k]; });
    const anyEm = EmergencyContact.KEYS.some(function (k) { return payload[k] !== undefined; });
    let em = null;
    if (anyEm) {                                           // one contact = three fields, all together (product-dev6.2)
      const raw = {}; EmergencyContact.KEYS.forEach(function (k) { raw[EmergencyContact.SHORT[k]] = payload[k] === undefined ? '' : payload[k]; });
      em = EmergencyContact.clean_(raw);
    }
    const f = Object.keys(soldierPart).length ? Soldiers.clean_(soldierPart, false) : {}; if (!Object.keys(f).length && !em) throw new AppError('VALIDATION', 'לא הוזנו שינויים.');
    return Locks.run(function () {
      const tokenRow = Forms.tokenRecord_(token); if (!tokenRow) throw new AppError('FORBIDDEN', Forms.BAD);
      // Idempotency is checked even for a consumed token: if the prior response was lost after
      // commit, the same bearer token safely confirms receipt instead of looking invalid.
      const prior = Db.where('SoldierUpdateRequests', function (r) { return r.token_id === tokenRow.id; })[0];
      if (prior) {
        try { if (!tokenRow.used_at) Db.update('FormTokens', tokenRow.id, { used_at: prior.requested_at || Util.nowIso() }); } catch (e) { /* durable request remains idempotent */ }
        return { received: true, duplicate_prevented: true };
      }
      const t = Forms.find_(token); if (!t) throw new AppError('FORBIDDEN', Forms.BAD);                       // single use even under a race
      const s = Db.get('Soldiers', t.soldier_id); let after = {};
      if (Object.keys(f).length) { const d = Soldiers.diff_(s, f); if (!d.changed && !em) throw new AppError('VALIDATION', 'הערכים זהים לנתונים הקיימים.'); after = d.changed ? d.after : {}; }
      const now = Util.nowIso(), rid = Util.uuid(), body = Object.assign({}, after); if (em) body._emergency = 'pending';    // marker only: the contact details themselves never enter the main store
      const row = { id: rid, course_id: t.course_id, soldier_id: s.id, personal_number: s.personal_number, request_kind: 'details', payload_json: JSON.stringify(body), status: 'pending', requested_at: now, reviewed_by: '', reviewed_at: '', review_note: '', token_id: t.id };
      if (em) EmergencyContact.stagePending_(t.course_id, s.id, rid, em);
      try { Db.insert('SoldierUpdateRequests', row); }
      catch (e) {
        // Some storage failures can occur after a row was actually written. Read back by the
        // generated id before deciding whether staged private values may be discarded.
        const landed = Db.get('SoldierUpdateRequests', rid);
        if (!landed) {
          if (em) EmergencyContact.discardPending_(t.course_id, s.id, rid);
          throw e;
        }
      }
      // The request row is the durable idempotency record. If token consumption fails, the next
      // retry finds that row above and cannot duplicate the submission.
      let tokenConsumed = true;
      try { Db.update('FormTokens', t.id, { used_at: now }); } catch (e) { tokenConsumed = false; }
      let auditRecorded = true;
      try { Audit.log({ email: 'form:' + s.id }, { courseId: t.course_id, action: 'FORM_SUBMIT', table: 'SoldierUpdateRequests', recordId: row.id, after: { fields: Object.keys(after).concat(em ? ['emergency_contact'] : []) } }); }
      catch (e) { auditRecorded = false; }
      return { received: true, token_status: tokenConsumed ? 'consumed' : 'reconciliation_required', audit_status: auditRecorded ? 'recorded' : 'failed', warning_code: auditRecorded ? '' : 'FORM_AUDIT_WRITE_FAILED' };
    });
  },
  list(ctx, courseId, status) {
    Records.guardCourse_(ctx, 'form.manage', courseId); Soldiers.scalar_(status, 'status'); const sol = Mods.soldierMap_(courseId); let emShown = 0;
    const out = Db.where('SoldierUpdateRequests', function (r) { return r.course_id === courseId && (!status || r.status === Util.str(status)); }).map(function (r) {
      const s = sol[r.soldier_id], p = Util.parseJson(r.payload_json, {});
      const row = { id: r.id, soldier_id: r.soldier_id, soldier_name: s ? s.full_name : '', status: r.status, requested_at: r.requested_at, reviewed_by: r.reviewed_by, review_note: r.review_note,
        changes: Object.keys(p).filter(function (k) { return k !== '_emergency'; }).map(function (k) { return { field: k, from: s ? (k === 'enlistment_date' ? Util.cellToIsoDate(s[k]) : s[k]) : '', to: p[k] }; }) };
      if (p._emergency && r.status === 'pending') {          // admin only (form.manage + private.read are both admin-only): the pending contact is shown so it can be approved
        Private.guard_(ctx, 'private.read', courseId); const e = EmergencyContact.pending_(courseId, r.soldier_id, r.id); emShown++;
        row.emergency_contact = { pending: true, name: e.name, relation: e.relation, phone_display: EmergencyContact.display(e.phone) };
      } else if (p._emergency) row.emergency_contact = { pending: false };
      return row;
    }).sort(function (a, b) { return a.requested_at < b.requested_at ? 1 : -1; });
    if (emShown) Audit.log(ctx, { courseId: courseId, action: 'EMERGENCY_CONTACT_VIEW', table: 'SoldierPersonalDetails', recordId: 'pending-requests', after: { viewed: emShown } });
    return out;
  },
  review(ctx, requestId, decision, note) {
    const pre = Db.get('SoldierUpdateRequests', Util.str(typeof requestId === 'string' ? requestId : '')); if (!pre || !Policy.inScope(ctx, pre.course_id)) throw new AppError('NOT_FOUND', 'הבקשה לא נמצאה.');
    Records.guardCourse_(ctx, 'form.manage', pre.course_id); if (decision !== 'approve' && decision !== 'reject') throw new AppError('VALIDATION', 'החלטה לא תקינה.'); note = Mods.reason_(note, decision === 'reject');
    return Locks.run(function () {
      const cur = Db.get('SoldierUpdateRequests', pre.id); Records.guardCourse_(ctx, 'form.manage', cur.course_id);
      const finalStatus = decision === 'approve' ? 'approved' : 'rejected';
      if (cur.status === 'approved' || cur.status === 'rejected') {
        if (cur.status === finalStatus) return { id: cur.id, status: cur.status, duplicate_prevented: true };
        throw new AppError('VALIDATION', 'הבקשה כבר טופלה בהחלטה אחרת.');
      }
      if (cur.status !== 'pending') throw new AppError('VALIDATION', 'הבקשה אינה זמינה לטיפול.');
      const body = Util.parseJson(cur.payload_json, {}), hasEm = body._emergency !== undefined; delete body._emergency;
      // Validate the complete private contact staging set before applying ANY part of the request.
      // Otherwise a damaged/missing pending row could silently approve the ordinary fields while
      // dropping the emergency contact, leaving the request in a misleading terminal state.
      if (decision === 'approve' && hasEm) {
        Private.guard_(ctx, 'private.write', cur.course_id);
        EmergencyContact.assertPendingComplete_(cur.course_id, cur.soldier_id, cur.id);
      }
      if (decision === 'approve' && Object.keys(body).length) {
        const soldier = Db.get('Soldiers', cur.soldier_id);
        // A previous attempt may have committed the soldier row and then failed later. Only
        // apply fields that are still different; this makes approval safely retryable.
        const delta = Soldiers.diff_(soldier, body);
        if (delta.changed) Soldiers.update(ctx, soldier.id, delta.after, soldier.updated_at, 'עדכון בטופס חייל, אושר ע״י מנהל' + (note ? ': ' + note : ''));
      }
      if (hasEm) { Private.guard_(ctx, decision === 'approve' ? 'private.write' : 'private.read', cur.course_id); EmergencyContact.resolvePending_(ctx, cur.course_id, cur.soldier_id, cur.id, decision === 'approve'); }
      try { Db.update('SoldierUpdateRequests', cur.id, { status: finalStatus, reviewed_by: ctx.email, reviewed_at: Util.nowIso(), review_note: note }); }
      catch (e) {
        const landed = Db.get('SoldierUpdateRequests', cur.id);
        if (!landed || landed.status !== finalStatus) throw e;
      }
      let auditRecorded = true;
      try { Audit.log(ctx, { courseId: cur.course_id, action: 'FORM_' + decision.toUpperCase(), table: 'SoldierUpdateRequests', recordId: cur.id, reason: note }); }
      catch (e) { auditRecorded = false; }
      return { id: cur.id, status: finalStatus, audit_status: auditRecorded ? 'recorded' : 'failed', warning_code: auditRecorded ? '' : 'FORM_REVIEW_AUDIT_WRITE_FAILED' };
    });
  }
};
