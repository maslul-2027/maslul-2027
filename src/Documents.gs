/**
 * Documents archive — v1.0.0. Files live in PRIVATE Drive folders (owner = deploying admin, no sharing, no links ever returned).
 * Access is enforced HERE, server-side, on every read: admin = any document of courses in scope; commander = only his own uploads of soldiers he can see;
 * everyone else gets metadata only (type/uploader/date). The Drive file id is never sent to the browser.
 * Linking a document to a result/record is a REQUEST that the admin approves. No deletion: "cancel" keeps the row and moves the Drive file out of use only on admin decision (never automatic).
 */
const Documents = {
  MAX_BYTES: 8 * 1024 * 1024,
  TYPES: { pdf: { mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] }, png: { mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] }, jpg: { mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] }, jpeg: { mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
    docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', magic: [0x50, 0x4b, 3, 4] }, xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', magic: [0x50, 0x4b, 3, 4] } },
  LINK_TABLES: ['NavigationTests', 'FitnessTests', 'MarksmanshipTests', 'TheoreticalExamAttempts', 'ReadinessRecords', 'SoldierEvents', 'QualificationAssignments'],

  cleanName_(n) {
    if (typeof n !== 'string') throw new AppError('VALIDATION', 'שם קובץ לא תקין.');
    const v = n.replace(/[\\/\x00-\x1f<>:"|?*]/g, '_').replace(/^\.+/, '').trim(); if (!v || v.length > 120) throw new AppError('VALIDATION', 'שם קובץ חובה (עד 120 תווים).');
    const m = /\.([A-Za-z0-9]{2,5})$/.exec(v); if (!m || !Documents.TYPES[m[1].toLowerCase()]) throw new AppError('VALIDATION', 'סוג קובץ לא נתמך (pdf, png, jpg, docx, xlsx).');
    return { name: v, ext: m[1].toLowerCase() };
  },
  view_(ctx, d, sol) {
    const own = ctx.role === ROLES.ADMIN || String(d.uploaded_by).toLowerCase() === ctx.email;
    const o = { id: d.id, soldier_id: d.soldier_id, soldier_name: sol && sol[d.soldier_id] ? sol[d.soldier_id].full_name : '', document_type: d.document_type, uploaded_by: d.uploaded_by, uploaded_at: d.uploaded_at, can_open: own, linked: !!d.linked_record_id && d.approval_status === 'approved', link_status: d.approval_status || '' };
    if (own) { o.file_name = d.file_name; o.mime_type = d.mime_type; o.size_bytes = Number(d.size_bytes); o.linked_table = d.linked_table; o.linked_record_id = d.linked_record_id; }
    return o;
  },

  upload(ctx, courseId, p) {
    p = p || {}; Records.guardCourse_(ctx, 'document.upload', courseId); ['soldier_id', 'document_type', 'file_name', 'mime_type'].forEach(function (k) { Soldiers.scalar_(p[k], k); });
    let sid = Util.str(p.soldier_id); if (!sid && ctx.role !== ROLES.ADMIN) throw new AppError('VALIDATION', 'יש לשייך את המסמך לחייל.');
    if (sid) { const s = Db.get('Soldiers', sid); if (!s || s.course_id !== courseId || s.record_status !== RECORD_STATUS.ACTIVE || !Soldiers.visibleFn_(ctx, courseId)(s)) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE); }
    const nm = Documents.cleanName_(p.file_name), spec = Documents.TYPES[nm.ext]; if (Util.str(p.mime_type) && Util.str(p.mime_type) !== spec.mime) throw new AppError('VALIDATION', 'סוג התוכן אינו תואם לסיומת הקובץ.');
    const bytes = Util.b64bytes(p.content_base64, Documents.MAX_BYTES); if (bytes.length < 4 || spec.magic.some(function (b, i) { return bytes[i] !== b; })) throw new AppError('VALIDATION', 'תוכן הקובץ אינו תואם לסוג הקובץ.');
    const type = Mods.note_(p.document_type, 60); if (!type) throw new AppError('VALIDATION', 'סוג מסמך חובה.');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'document.upload', courseId); if (sid) { const s2 = Db.get('Soldiers', sid); if (!s2 || s2.record_status !== RECORD_STATUS.ACTIVE || !Soldiers.visibleFn_(ctx, courseId)(s2)) throw new AppError('VALIDATION', Records.SOLDIER_UNAVAILABLE); }
      const f = Adapters.saveFile('documents', courseId + '_' + Util.uuid() + '_' + nm.name, spec.mime, p.content_base64);
      const row = { id: Util.uuid(), course_id: courseId, soldier_id: sid, document_type: type, drive_file_id: f.id, file_name: nm.name, uploaded_by: ctx.email, uploaded_at: Util.nowIso(), approval_status: '', linked_record_id: '', linked_table: '', mime_type: spec.mime, size_bytes: bytes.length, link_requested_by: '', link_reviewed_by: '' };
      Db.insert('Documents', row); Audit.log(ctx, { courseId: courseId, action: 'DOC_UPLOAD', table: 'Documents', recordId: row.id, after: { file_name: nm.name, soldier_id: sid, size: bytes.length } });
      return Documents.view_(ctx, row, null);
    });
  },
  load_(ctx, id) {
    const d = Db.get('Documents', Util.str(typeof id === 'string' ? id : '')); if (!d || !Policy.inScope(ctx, d.course_id)) throw new AppError('NOT_FOUND', 'המסמך לא נמצא.');
    if (d.soldier_id) { const s = Db.get('Soldiers', d.soldier_id); if (!s || !Soldiers.visibleFn_(ctx, d.course_id)(s)) throw new AppError('NOT_FOUND', 'המסמך לא נמצא.'); }
    else if (ctx.role !== ROLES.ADMIN) throw new AppError('NOT_FOUND', 'המסמך לא נמצא.');
    return d;
  },
  list(ctx, courseId, soldierId) {
    Records.guardCourse_(ctx, 'document.list', courseId); Soldiers.scalar_(soldierId, 'soldier_id'); const vis = Soldiers.visibleFn_(ctx, courseId), sol = Mods.soldierMap_(courseId);
    return Db.where('Documents', function (d) { return d.course_id === courseId && (!soldierId || d.soldier_id === Util.str(soldierId)) && (d.soldier_id ? (!!sol[d.soldier_id] && vis(sol[d.soldier_id])) : ctx.role === ROLES.ADMIN); }).map(function (d) { return Documents.view_(ctx, d, sol); });
  },
  /** The ONLY way to get file content. Server-side policy; audit on every read. */
  download(ctx, id) {
    const d = Documents.load_(ctx, id); Records.guardCourse_(ctx, ctx.role === ROLES.ADMIN ? 'document.read_any' : 'document.read_own', d.course_id);
    if (ctx.role !== ROLES.ADMIN && String(d.uploaded_by).toLowerCase() !== ctx.email) throw new AppError('FORBIDDEN', 'אין הרשאה לפתוח מסמך זה.');
    const f = Adapters.readFile(d.drive_file_id); Audit.log(ctx, { courseId: d.course_id, action: 'DOC_READ', table: 'Documents', recordId: d.id });
    return { id: d.id, file_name: d.file_name, mime_type: d.mime_type, content_base64: f.b64 };
  },
  /** Commander (owner) or admin requests linking the document to a record of the SAME soldier; admin approves. */
  requestLink(ctx, id, table, recordId) {
    const d = Documents.load_(ctx, id); Records.guardCourse_(ctx, 'document.upload', d.course_id); if (ctx.role !== ROLES.ADMIN && String(d.uploaded_by).toLowerCase() !== ctx.email) throw new AppError('NOT_FOUND', 'המסמך לא נמצא.');
    if (typeof table !== 'string' || Documents.LINK_TABLES.indexOf(table) === -1 || typeof recordId !== 'string') throw new AppError('VALIDATION', 'יעד קישור לא תקין.');
    const rec = Db.get(table, recordId); if (!rec || rec.course_id !== d.course_id || (d.soldier_id && rec.soldier_id !== d.soldier_id) || !Soldiers.visibleFn_(ctx, d.course_id)(Db.get('Soldiers', rec.soldier_id))) throw new AppError('VALIDATION', 'הרשומה לקישור לא נמצאה אצל אותו חייל.');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'document.upload', d.course_id); const cur = Db.get('Documents', d.id); if (cur.approval_status === 'pending' || cur.approval_status === 'approved') throw new AppError('DUPLICATE', 'כבר קיימת בקשת קישור או קישור מאושר.');
      Db.update('Documents', cur.id, { approval_status: 'pending', linked_table: table, linked_record_id: recordId, link_requested_by: ctx.email, link_reviewed_by: '' });
      Audit.log(ctx, { courseId: cur.course_id, action: 'DOC_LINK_REQUEST', table: 'Documents', recordId: cur.id, after: { table: table, record_id: recordId } }); return { id: cur.id, link_status: 'pending' };
    });
  },
  reviewLink(ctx, id, decision, note) {
    const pre = Db.get('Documents', Util.str(typeof id === 'string' ? id : '')); if (!pre || !Policy.inScope(ctx, pre.course_id)) throw new AppError('NOT_FOUND', 'המסמך לא נמצא.');
    Records.guardCourse_(ctx, 'document.link.review', pre.course_id); if (decision !== 'approve' && decision !== 'reject') throw new AppError('VALIDATION', 'החלטה לא תקינה.'); note = Mods.reason_(note, decision === 'reject');
    return Locks.run(function () {
      const cur = Db.get('Documents', pre.id); Records.guardCourse_(ctx, 'document.link.review', cur.course_id); if (cur.approval_status !== 'pending') throw new AppError('VALIDATION', 'אין בקשת קישור ממתינה.');
      const patch = decision === 'approve' ? { approval_status: 'approved', link_reviewed_by: ctx.email } : { approval_status: 'rejected', link_reviewed_by: ctx.email, linked_record_id: '', linked_table: '' };
      Db.update('Documents', cur.id, patch); Audit.log(ctx, { courseId: cur.course_id, action: 'DOC_LINK_' + decision.toUpperCase(), table: 'Documents', recordId: cur.id, reason: note }); return { id: cur.id, link_status: patch.approval_status };
    });
  },
  pendingLinks(ctx, courseId) { Records.guardCourse_(ctx, 'document.link.review', courseId); return Db.where('Documents', function (d) { return d.course_id === courseId && d.approval_status === 'pending'; }).map(function (d) { return Documents.view_(ctx, d, Mods.soldierMap_(courseId)); }); },

  /** Qualification evidence = a reference to a document of the same soldier (own upload for commanders). No file bytes are copied. */
  attachEvidence(ctx, assignmentId, documentId) {
    const a = Qualifications.load_(ctx, assignmentId); Records.guardCourse_(ctx, 'qual.update', a.course_id); const d = Documents.load_(ctx, documentId);
    if (d.course_id !== a.course_id || d.soldier_id !== a.soldier_id) throw new AppError('VALIDATION', 'המסמך אינו שייך לחייל זה.'); if (ctx.role !== ROLES.ADMIN && String(d.uploaded_by).toLowerCase() !== ctx.email) throw new AppError('NOT_FOUND', 'המסמך לא נמצא.');
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'qual.update', a.course_id); if (Db.where('QualificationEvidence', function (e) { return e.assignment_id === a.id && e.document_id === d.id; }).length) throw new AppError('DUPLICATE', 'המסמך כבר מצורף.');
      const row = { id: Util.uuid(), course_id: a.course_id, assignment_id: a.id, document_id: d.id, file_name: d.file_name, uploaded_by: ctx.email, uploaded_at: Util.nowIso() }; Db.insert('QualificationEvidence', row);
      Audit.log(ctx, { courseId: a.course_id, action: 'QUAL_EVIDENCE', table: 'QualificationEvidence', recordId: row.id, after: { assignment_id: a.id, document_id: d.id } }); return { id: row.id };
    });
  },
  evidenceFor(ctx, assignmentId) { const a = Qualifications.load_(ctx, assignmentId); Records.guardCourse_(ctx, 'result.read', a.course_id); return Db.where('QualificationEvidence', function (e) { return e.assignment_id === a.id; }).map(function (e) { return { id: e.id, document_id: e.document_id, file_name: ctx.role === ROLES.ADMIN || String(e.uploaded_by).toLowerCase() === ctx.email ? e.file_name : '', uploaded_at: e.uploaded_at }; }); }
};
