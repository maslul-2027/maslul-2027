/**
 * EmergencyContact — ONE primary emergency contact per soldier (איש קשר לחירום) — product-dev6.2.
 * It is sensitive THIRD-PARTY personal data, so:
 *  - Storage: the EXISTING private-store table SoldierPersonalDetails (field_key / field_value rows) — no schema change, no migration. Never the main store.
 *  - Authorisation: the EXISTING admin-only actions private.read / private.write. APPROVED owner decision D1 (docs/DECISIONS_RECORD_uxqa1.md): admin only — a commander gets nothing, and no commander permission, action or exposure may be added here without a new owner approval.
 *  - Never returned by any list, card, dashboard, report, export, assistant or snapshot. Only emergency.get (admin) returns it, and every read/write is audited WITHOUT values
 *    (Audit.sanitize_ records only field names for private tables).
 *  - Self-service (FormPage): a submission is a PENDING request (SoldierUpdateRequests); its values wait in the private store under field_key 'pending:<requestId>:<key>' and are
 *    applied (or wiped) on review. The main-store request row holds only a marker, never the contact details.
 */
const EmergencyContact = {
  KEYS: ['emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone'],
  SHORT: { emergency_contact_name: 'name', emergency_contact_relation: 'relation', emergency_contact_phone: 'phone' },
  CLASS: 'third_party_sensitive',
  LABELS: { name: 'שם מלא של איש הקשר', relation: 'קרבה לחייל', phone: 'טלפון' },

  /** Pure validation + normalisation. data: {name, relation, phone}. All three are required together (one contact = three fields). */
  clean_(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new AppError('VALIDATION', 'פרטי איש הקשר לא תקינים.');
    ['name', 'relation', 'phone'].forEach(function (k) { Soldiers.scalar_(d[k], k); });
    const name = Util.str(d.name).replace(/\s+/g, ' '), relation = Util.str(d.relation).replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 100) throw new AppError('VALIDATION', 'שם איש הקשר חובה (2–100 תווים).');
    if (relation.length < 2 || relation.length > 50) throw new AppError('VALIDATION', 'קרבה לחייל חובה (2–50 תווים).');
    const phone = EmergencyContact.normalizePhone_(d.phone); if (!phone) throw new AppError('VALIDATION', 'מספר טלפון לא תקין (7–15 ספרות, אפשר קידומת +).');
    return { name: name, relation: relation, phone: phone };
  },
  /** Keeps digits and one leading '+'; removes spaces, dashes, dots and parentheses. Returns '' if not 7–15 digits. */
  normalizePhone_(v) {
    const s = Util.str(v); if (!s || /[^\d+\s\-().]/.test(s)) return '';
    const plus = /^\s*\+/.test(s), digits = s.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return '';
    return (plus ? '+' : '') + digits;
  },
  /** Display only (the stored value is the normalised one): Israeli 10-digit numbers as 050-123-4567; everything else unchanged. */
  display(phone) {
    const p = Util.str(phone); const m = /^(0\d{1,2})(\d{3})(\d{4})$/.exec(p);
    return p.length === 10 && m ? m[1] + '-' + m[2] + '-' + m[3] : p;
  },

  soldier_(ctx, courseId, soldierId) { return Private.soldier_(ctx, courseId, soldierId, false); },
  rows_(courseId, soldierId, prefix) {
    return Db.where('SoldierPersonalDetails', function (r) { return r.course_id === courseId && r.soldier_id === soldierId && String(r.field_key).indexOf(prefix) === 0; });
  },
  /** @return {name,relation,phone,updated_at}|null — admin only; audited without values. */
  get(ctx, courseId, soldierId) {
    Private.guard_(ctx, 'private.read', courseId); const s = EmergencyContact.soldier_(ctx, courseId, soldierId);
    const out = { present: false, name: '', relation: '', phone: '', phone_display: '', updated_at: '' };
    EmergencyContact.rows_(courseId, s.id, 'emergency_contact_').forEach(function (r) {
      const k = EmergencyContact.SHORT[r.field_key]; if (!k) return; out[k] = String(r.field_value === undefined || r.field_value === null ? '' : r.field_value); if (String(r.updated_at) > out.updated_at) out.updated_at = String(r.updated_at);
    });
    out.present = !!(out.name && out.relation && out.phone); out.phone_display = EmergencyContact.display(out.phone);
    Audit.log(ctx, { courseId: courseId, action: 'EMERGENCY_CONTACT_VIEW', table: 'SoldierPersonalDetails', recordId: s.id, after: { viewed: true } });
    return out;
  },
  /** Upsert of the three rows under the lock. Idempotent: identical values => no write, no audit change row. */
  set(ctx, courseId, soldierId, data) {
    Private.guard_(ctx, 'private.write', courseId); const pre = EmergencyContact.soldier_(ctx, courseId, soldierId);
    if (pre.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE);
    const c = EmergencyContact.clean_(data);
    return Locks.run(function () {
      Private.guard_(ctx, 'private.write', courseId); const s = EmergencyContact.soldier_(ctx, courseId, pre.id);
      const changed = EmergencyContact.apply_(ctx, courseId, s.id, c);
      if (changed) Audit.log(ctx, { courseId: courseId, action: 'EMERGENCY_CONTACT_SET', table: 'SoldierPersonalDetails', recordId: s.id, after: { name: 1, relation: 1, phone: 1 } });
      return { saved: true, changed: changed };
    });
  },
  /** Writes the three canonical rows (insert or update). @return {boolean} whether anything changed. Caller holds the lock. */
  apply_(ctx, courseId, soldierId, c) {
    const now = Util.nowIso(), existing = {}; EmergencyContact.rows_(courseId, soldierId, 'emergency_contact_').forEach(function (r) { existing[r.field_key] = r; });
    let changed = false;
    EmergencyContact.KEYS.forEach(function (key) {
      const val = c[EmergencyContact.SHORT[key]], ex = existing[key];
      if (ex) { if (String(ex.field_value) !== val) { Db.update('SoldierPersonalDetails', ex.id, { field_value: val, updated_at: now, updated_by: ctx.email }); changed = true; } }
      else { Db.insert('SoldierPersonalDetails', { id: Util.uuid(), course_id: courseId, soldier_id: soldierId, field_key: key, field_value: val, sensitivity_class: EmergencyContact.CLASS, updated_at: now, updated_by: ctx.email }); changed = true; }
    });
    return changed;
  },

  // ---------------- self-service (pending) ----------------
  /** Called by Forms.submit inside its lock. Stores the cleaned values as pending rows tied to the request id. */
  stagePending_(courseId, soldierId, requestId, c) {
    const now = Util.nowIso();
    try {
      EmergencyContact.KEYS.forEach(function (key) {
        Db.insert('SoldierPersonalDetails', { id: Util.uuid(), course_id: courseId, soldier_id: soldierId, field_key: 'pending:' + requestId + ':' + key, field_value: c[EmergencyContact.SHORT[key]], sensitivity_class: EmergencyContact.CLASS, updated_at: now, updated_by: 'form:' + soldierId });
      });
    } catch (e) {
      // A partial private write must not leave third-party data orphaned. Best-effort cleanup is
      // retried once; unresolved rows retain a pending: prefix and are detectable by audit tooling.
      try { EmergencyContact.discardPending_(courseId, soldierId, requestId); }
      catch (cleanupError) { throw new AppError('PENDING_CLEANUP_FAILED', 'לא ניתן היה להשלים את שמירת פרטי איש הקשר. יש לפנות למנהל המערכת.'); }
      throw e;
    }
  },
  discardPending_(courseId, soldierId, requestId) {
    const rows = EmergencyContact.rows_(courseId, soldierId, 'pending:' + requestId + ':');
    const now = Util.nowIso();
    rows.forEach(function (r) { Db.update('SoldierPersonalDetails', r.id, { field_key: 'discarded:' + requestId, field_value: '', updated_at: now, updated_by: 'system:cleanup' }); });
    // Verify that no pending value remains after cleanup; never silently accept a partial wipe.
    if (EmergencyContact.rows_(courseId, soldierId, 'pending:' + requestId + ':').length) throw new AppError('PENDING_CLEANUP_FAILED', 'נדרש בירור של פרטי איש קשר שלא נשמרו.');
    return rows.length;
  },
  pending_(courseId, soldierId, requestId) {
    const out = { name: '', relation: '', phone: '' };
    EmergencyContact.rows_(courseId, soldierId, 'pending:' + requestId + ':').forEach(function (r) { const k = EmergencyContact.SHORT[String(r.field_key).split(':')[2]]; if (k) out[k] = String(r.field_value || ''); });
    return out;
  },
  /**
   * A request carrying the emergency marker must have exactly one non-empty row per approved
   * field. A retry may find some pending rows already moved to resolved:<requestId> after a prior
   * attempt applied the complete canonical contact and then failed during cleanup. In that case
   * accept only if the canonical set is complete and every remaining pending value matches it.
   */
  assertPendingComplete_(courseId, soldierId, requestId) {
    const counts = { name: 0, relation: 0, phone: 0 }, values = { name: '', relation: '', phone: '' };
    const pendingRows = EmergencyContact.rows_(courseId, soldierId, 'pending:' + requestId + ':');
    pendingRows.forEach(function (r) {
      const key = EmergencyContact.SHORT[String(r.field_key).split(':')[2]];
      if (!key) return;
      counts[key]++;
      values[key] = String(r.field_value === undefined || r.field_value === null ? '' : r.field_value);
    });
    const completePending = EmergencyContact.KEYS.every(function (key) { const short = EmergencyContact.SHORT[key]; return counts[short] === 1 && !!values[short]; });
    if (completePending) return { values: values, alreadyApplied: false };

    const resolvedRows = EmergencyContact.rows_(courseId, soldierId, 'resolved:' + requestId);
    if (resolvedRows.length) {
      const canonicalRows = EmergencyContact.rows_(courseId, soldierId, 'emergency_contact_');
      const canonicalCounts = { name: 0, relation: 0, phone: 0 }, canonical = { name: '', relation: '', phone: '' };
      canonicalRows.forEach(function (r) {
        const key = EmergencyContact.SHORT[r.field_key];
        if (!key) return;
        canonicalCounts[key]++;
        canonical[key] = String(r.field_value === undefined || r.field_value === null ? '' : r.field_value);
      });
      const canonicalComplete = EmergencyContact.KEYS.every(function (key) { const short = EmergencyContact.SHORT[key]; return canonicalCounts[short] === 1 && !!canonical[short]; });
      const remainingMatch = pendingRows.every(function (r) {
        const key = EmergencyContact.SHORT[String(r.field_key).split(':')[2]];
        return !!key && counts[key] === 1 && String(r.field_value === undefined || r.field_value === null ? '' : r.field_value) === canonical[key];
      });
      if (canonicalComplete && remainingMatch) return { values: canonical, alreadyApplied: true };
    }
    throw new AppError('EMERGENCY_CONTACT_INCOMPLETE', 'פרטי איש הקשר בבקשה אינם שלמים או אינם חד-משמעיים. הבקשה נשארה ממתינה; יש לבדוק אותה או לדחות אותה כדי לנקות את המידע הזמני.');
  },
  /** On review: approve => canonical rows updated once; both outcomes wipe the pending values (never left behind). Caller holds the lock. */
  resolvePending_(ctx, courseId, soldierId, requestId, approve) {
    const state = approve ? EmergencyContact.assertPendingComplete_(courseId, soldierId, requestId) : null;
    const p = approve ? state.values : EmergencyContact.pending_(courseId, soldierId, requestId);
    const now = Util.nowIso(); let changed = false;
    if (approve && !state.alreadyApplied) changed = EmergencyContact.apply_(ctx, courseId, soldierId, p);
    EmergencyContact.rows_(courseId, soldierId, 'pending:' + requestId + ':').forEach(function (r) { Db.update('SoldierPersonalDetails', r.id, { field_key: 'resolved:' + requestId, field_value: '', updated_at: now, updated_by: ctx.email }); });
    return changed;
  }
,
  /**
   * ADMIN-only recovery for orphaned self-service contact staging rows.
   * Preview is read-only. Apply only clears groups whose request id has NO request row anywhere;
   * ambiguous/mismatched groups are deliberately skipped. No contact values are returned.
   */
  reconcileOrphans(ctx, courseId, apply) {
    Private.guard_(ctx, 'private.write', courseId);
    if (apply !== true && apply !== false && apply !== undefined) throw new AppError('VALIDATION', 'מצב התאוששות לא תקין.');
    const execute = function () {
      Private.guard_(ctx, 'private.write', courseId);
      const allPending = Db.where('SoldierPersonalDetails', function (r) {
        return r.course_id === courseId && /^pending:[^:]+:(emergency_contact_name|emergency_contact_relation|emergency_contact_phone)$/.test(String(r.field_key || ''));
      });
      const requests = Db.all('SoldierUpdateRequests');
      // IDs should be unique, but a damaged/imported sheet can contain duplicates. Never let
      // iteration order choose which request controls cleanup eligibility for a private row.
      // Request IDs come from persisted rows. Use a null-prototype dictionary so imported or
      // damaged IDs such as "__proto__", "constructor" or "toString" cannot collide with
      // Object.prototype and break classification or cleanup safety.
      const byId = Object.create(null);
      requests.forEach(function (r) {
        const id = String(r.id || '');
        if (!id) return;
        if (!byId[id]) byId[id] = [];
        byId[id].push(r);
      });
      const groups = {};
      allPending.forEach(function (r) {
        const m = /^pending:([^:]+):(emergency_contact_name|emergency_contact_relation|emergency_contact_phone)$/.exec(String(r.field_key || ''));
        if (!m) return;
        // Encode the tuple rather than joining with a delimiter: persisted IDs may themselves contain '|'.
        const key = JSON.stringify([m[1], String(r.soldier_id || '')]);
        if (!groups[key]) groups[key] = { request_id: m[1], soldier_id: r.soldier_id, rows: [] };
        groups[key].rows.push(r);
      });
      const candidates = [], ambiguous = [], linkedInconsistent = [];
      Object.keys(groups).forEach(function (key) {
        const g = groups[key], matches = byId[g.request_id] || [];
        if (!matches.length) { candidates.push(g); return; }
        // Any duplicate request ID is ambiguous, even if duplicate rows currently agree.
        // Cleanup must not depend on which duplicate happens to be returned last by Sheets.
        if (matches.length !== 1) { ambiguous.push(g); return; }
        const request = matches[0];
        if (request.course_id !== courseId || request.soldier_id !== g.soldier_id) { ambiguous.push(g); return; }
        // A matching request row is not automatically proof that these staged values are valid.
        // Only a pending request carrying the emergency marker and exactly one non-empty row
        // for each of the three approved keys is considered a healthy linked group.
        const body = Util.parseJson(request.payload_json, {});
        const expected = ['emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone'];
        const counts = {};
        let malformed = false;
        g.rows.forEach(function (r) {
          const keyName = String(r.field_key || '').split(':')[2];
          if (expected.indexOf(keyName) === -1) malformed = true;
          counts[keyName] = (counts[keyName] || 0) + 1;
          if (r.field_value === undefined || r.field_value === null || String(r.field_value).trim() === '') malformed = true;
        });
        const complete = expected.every(function (field) { return counts[field] === 1; }) && g.rows.length === expected.length;
        if (request.status !== 'pending' || !body || body._emergency !== 'pending' || !complete || malformed) linkedInconsistent.push(g);
      });
      const report = { preview: apply !== true, orphan_groups: candidates.length, orphan_rows: candidates.reduce(function (n, g) { return n + g.rows.length; }, 0), ambiguous_groups: ambiguous.length,
        review_required_groups: linkedInconsistent.length,
        groups: candidates.map(function (g) { return { request_id: g.request_id, soldier_id: g.soldier_id, row_count: g.rows.length }; }),
        review_required: linkedInconsistent.map(function (g) { return { request_id: g.request_id, soldier_id: g.soldier_id, row_count: g.rows.length }; }) };
      if (apply !== true || !candidates.length) return report;
      // Record the intent before touching third-party data. If a later row update fails,
      // the audit trail still shows that an ADMIN initiated reconciliation (counts only).
      Audit.log(ctx, { courseId: courseId, action: 'EMERGENCY_ORPHAN_RECONCILE_START', table: 'SoldierPersonalDetails', recordId: 'orphan-pending', after: { groups: candidates.length, rows: report.orphan_rows } });
      let cleared = 0;
      try {
        candidates.forEach(function (g) {
          g.rows.forEach(function (r) {
            Db.update('SoldierPersonalDetails', r.id, { field_key: 'orphan_discarded:' + g.request_id + ':' + r.id, field_value: '', updated_at: Util.nowIso(), updated_by: ctx.email });
            cleared++;
          });
          const remaining = Db.where('SoldierPersonalDetails', function (r) {
            return r.course_id === courseId && r.soldier_id === g.soldier_id && String(r.field_key || '').indexOf('pending:' + g.request_id + ':') === 0;
          });
          if (remaining.length) throw new AppError('PENDING_RECONCILIATION_PARTIAL', 'ניקוי פרטי איש קשר לא הושלם. ניתן להריץ בדיקה חוזרת.');
        });
      } catch (cleanupError) {
        if (cleanupError && cleanupError.code === 'PENDING_RECONCILIATION_PARTIAL') throw cleanupError;
        throw new AppError('PENDING_RECONCILIATION_PARTIAL', 'ניקוי פרטי איש קשר נקטע. יש להריץ בדיקה חוזרת.');
      }
      let auditRecorded = true;
      try { Audit.log(ctx, { courseId: courseId, action: 'EMERGENCY_ORPHAN_RECONCILE', table: 'SoldierPersonalDetails', recordId: 'orphan-pending', after: { groups: candidates.length, rows: cleared } }); }
      catch (e) { auditRecorded = false; }
      report.preview = false; report.cleared_groups = candidates.length; report.cleared_rows = cleared;
      report.audit_status = auditRecorded ? 'recorded' : 'failed';
      report.warning_code = auditRecorded ? '' : 'EMERGENCY_ORPHAN_AUDIT_WRITE_FAILED';
      return report;
    };
    return apply === true ? Locks.run(execute) : execute();
  }
};
