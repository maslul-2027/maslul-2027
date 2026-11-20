/**
 * OCR — drafts only, per-item admin approval — v1.0.0. Infrastructure: the provider is an Adapter; NO provider is chosen yet (open decision), so in a real deployment a job ends as 'no_provider'.
 * Extracted rows live ONLY in OCRExtractedRows (status draft). They never count in any figure. A row becomes a real record only when the admin approves THAT row (Records.create, same validation).
 * Uncertain identity (no exact personal number) leaves soldier_id empty with candidates: the admin must pick a soldier. Uncertain fields must be explicitly confirmed.
 */
const Ocr = {
  TARGETS: { navigation: 'NavigationTests', marksmanship: 'MarksmanshipTests', fitness: 'FitnessTests', exams: 'TheoreticalExamAttempts' },
  start(ctx, courseId, p) {
    p = p || {}; Records.guardCourse_(ctx, 'ocr.review', courseId); Soldiers.scalar_(p.document_id, 'document_id'); Soldiers.scalar_(p.target, 'target');
    if (!Object.prototype.hasOwnProperty.call(Ocr.TARGETS, p.target)) throw new AppError('VALIDATION', 'יעד OCR לא מוכר.');
    const d = Documents.load_(ctx, p.document_id); if (d.course_id !== courseId) throw new AppError('NOT_FOUND', 'המסמך לא נמצא.'); if (['application/pdf', 'image/png', 'image/jpeg'].indexOf(d.mime_type) === -1) throw new AppError('VALIDATION', 'OCR נתמך ב-PDF/תמונה בלבד.');
    const avail = Adapters.ocrAvailable(); let extracted = [];
    if (avail) { const f = Adapters.readFile(d.drive_file_id); extracted = Adapters.ocrExtract(f.b64, d.mime_type, p.target); if (!Array.isArray(extracted) || extracted.length > 500) throw new AppError('VALIDATION', 'פלט OCR לא תקין.'); }
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'ocr.review', courseId); const now = Util.nowIso(), job = { id: Util.uuid(), course_id: courseId, document_id: d.id, target: p.target, uploaded_by: ctx.email, uploaded_at: now, status: avail ? 'review' : 'no_provider', reviewed_by: '', reviewed_at: '', provider: avail ? 'configured' : '' };
      Db.insert('OCRJobs', job);
      extracted.forEach(function (x) {
        x = x && typeof x === 'object' ? x : {}; const num = Util.str(x.personal_number), nm = Util.str(x.name), sols = Db.where('Soldiers', function (s) { return s.course_id === courseId && s.record_status === RECORD_STATUS.ACTIVE; });
        let sid = '', cands = []; const byNum = num ? sols.filter(function (s) { return String(s.personal_number) === num; }) : [];
        if (byNum.length === 1) sid = byNum[0].id; else { cands = (nm ? sols.filter(function (s) { return String(s.full_name).trim() === nm; }) : []).map(function (s) { return { id: s.id, name: s.full_name, personal_number: s.personal_number }; }); }
        Db.insert('OCRExtractedRows', { id: Util.uuid(), course_id: courseId, job_id: job.id, soldier_id: sid, candidates_json: JSON.stringify(cands), extraction_json: JSON.stringify(x.fields && typeof x.fields === 'object' && !Array.isArray(x.fields) ? x.fields : {}), uncertain_fields: JSON.stringify(Array.isArray(x.uncertain) ? x.uncertain.map(String) : []), status: 'draft', reviewed_by: '', reviewed_at: '', committed_record_id: '', review_note: '' });
      });
      Audit.log(ctx, { courseId: courseId, action: 'OCR_START', table: 'OCRJobs', recordId: job.id, after: { target: p.target, rows: extracted.length, status: job.status } });
      return { id: job.id, status: job.status, rows: extracted.length, message: avail ? '' : 'ספק OCR לא הוגדר — אין חילוץ אוטומטי. ניתן להזין ידנית.' };
    });
  },
  finish_(ctx, jobId) { if (!Db.where('OCRExtractedRows', function (x) { return x.job_id === jobId && x.status === 'draft'; }).length) Db.update('OCRJobs', jobId, { status: 'done', reviewed_by: ctx.email, reviewed_at: Util.nowIso() }); },
  rows(ctx, jobId) {
    const j = Db.get('OCRJobs', Util.str(typeof jobId === 'string' ? jobId : '')); if (!j || !Policy.inScope(ctx, j.course_id)) throw new AppError('NOT_FOUND', 'משימת OCR לא נמצאה.'); Records.guardCourse_(ctx, 'ocr.review', j.course_id); const sol = Mods.soldierMap_(j.course_id);
    return { job: { id: j.id, status: j.status, target: j.target }, rows: Db.where('OCRExtractedRows', function (r) { return r.job_id === j.id; }).map(function (r) { return { id: r.id, status: r.status, soldier_id: r.soldier_id, soldier_name: sol[r.soldier_id] ? sol[r.soldier_id].full_name : '', identity_certain: !!r.soldier_id, candidates: Util.parseJson(r.candidates_json, []), fields: Util.parseJson(r.extraction_json, {}), uncertain_fields: Util.parseJson(r.uncertain_fields, []), committed_record_id: r.committed_record_id }; }) };
  },
  row_(ctx, id) { const r = Db.get('OCRExtractedRows', Util.str(typeof id === 'string' ? id : '')); if (!r || !Policy.inScope(ctx, r.course_id)) throw new AppError('NOT_FOUND', 'שורת OCR לא נמצאה.'); Records.guardCourse_(ctx, 'ocr.review', r.course_id); return r; },
  editRow(ctx, rowId, p) {
    p = p || {}; const pre = Ocr.row_(ctx, rowId); Soldiers.scalar_(p.soldier_id, 'soldier_id'); if (p.fields !== undefined && (!p.fields || typeof p.fields !== 'object' || Array.isArray(p.fields))) throw new AppError('VALIDATION', 'שדות לא תקינים.');
    return Locks.run(function () {
      const cur = Ocr.row_(ctx, pre.id); if (cur.status !== 'draft') throw new AppError('VALIDATION', 'השורה כבר טופלה.'); const patch = {};
      if (!Util.isBlank(p.soldier_id)) { const s = Db.get('Soldiers', Util.str(p.soldier_id)); if (!s || s.course_id !== cur.course_id || s.record_status !== RECORD_STATUS.ACTIVE) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE); patch.soldier_id = s.id; }
      if (p.fields) { const f = Util.parseJson(cur.extraction_json, {}), unc = Util.parseJson(cur.uncertain_fields, []); Object.keys(p.fields).forEach(function (k) { const v = p.fields[k]; if (v !== null && typeof v === 'object') throw new AppError('VALIDATION', 'ערך לא תקין.'); f[k] = v; }); patch.extraction_json = JSON.stringify(f); patch.uncertain_fields = JSON.stringify(unc.filter(function (u) { return !(u in p.fields); })); }
      if (!Object.keys(patch).length) throw new AppError('VALIDATION', 'לא צוינו שינויים.'); Db.update('OCRExtractedRows', cur.id, patch); Audit.log(ctx, { courseId: cur.course_id, action: 'OCR_EDIT', table: 'OCRExtractedRows', recordId: cur.id, after: { fields: Object.keys(p.fields || {}) } }); return { id: cur.id };
    });
  },
  /** Approve ONE row -> real record. Needs a chosen soldier; uncertain fields need confirm_uncertain=true. */
  approveRow(ctx, rowId, confirmUncertain) {
    const pre = Ocr.row_(ctx, rowId);
    return Locks.run(function () {
      const r = Ocr.row_(ctx, pre.id), job = Db.get('OCRJobs', r.job_id); if (r.status !== 'draft') throw new AppError('VALIDATION', 'השורה כבר טופלה.'); if (!r.soldier_id) throw new AppError('VALIDATION', 'זהות החייל לא וודאית — יש לבחור חייל לפני אישור.');
      const unc = Util.parseJson(r.uncertain_fields, []); if (unc.length && confirmUncertain !== true) throw new AppError('VALIDATION', 'יש שדות לא ברורים (' + unc.join(', ') + ') — נדרש אישור מפורש או תיקון.');
      const data = Object.assign({}, Util.parseJson(r.extraction_json, {}), { soldier_id: r.soldier_id, request_id: 'ocr:' + r.id }), table = Ocr.TARGETS[job.target];
      const res = job.target === 'exams' ? Exams.addAttempt(ctx, r.course_id, data) : Records.create(ctx, table, r.course_id, data);
      Db.update('OCRExtractedRows', r.id, { status: 'approved', reviewed_by: ctx.email, reviewed_at: Util.nowIso(), committed_record_id: res.record.id });
      Ocr.finish_(ctx, job.id);
      Audit.log(ctx, { courseId: r.course_id, action: 'OCR_APPROVE', table: 'OCRExtractedRows', recordId: r.id, after: { record_id: res.record.id, table: table } }); return { id: r.id, record_id: res.record.id };
    });
  },
  rejectRow(ctx, rowId, note) {
    const pre = Ocr.row_(ctx, rowId); note = Mods.reason_(note, true);
    return Locks.run(function () { const r = Ocr.row_(ctx, pre.id); if (r.status !== 'draft') throw new AppError('VALIDATION', 'השורה כבר טופלה.'); Db.update('OCRExtractedRows', r.id, { status: 'rejected', reviewed_by: ctx.email, reviewed_at: Util.nowIso(), review_note: note }); Ocr.finish_(ctx, r.job_id); Audit.log(ctx, { courseId: r.course_id, action: 'OCR_REJECT', table: 'OCRExtractedRows', recordId: r.id, reason: note }); return { id: r.id }; });
  }
};
