/**
 * Reports — report builder, PDF, Excel (sheet model -> xlsx), full export — v1.0.0.
 * Every row comes from Snapshot (current state: visibility + cancelled/inactive rules) or from visibility-filtered history lists; a commander's report can only contain what he can already see.
 * Private (מ״פ) data is NEVER included unless the ADMIN explicitly sets include_private=true (logged in ReportJobs + audit); it is impossible for a commander.
 * Excel safety: any text cell that starts with = + - @ is neutralised (formula injection). Files are stored in a private Drive folder; the link is never returned — download goes through Reports.download.
 */
const Reports = {
  SECTIONS: ['soldiers', 'fitness', 'marksmanship', 'navigation', 'exams', 'attendance', 'marches', 'qualifications', 'readiness', 'events'],
  LABELS: { soldiers: 'חיילים', fitness: 'כש״ג', marksmanship: 'קליעה', navigation: 'ניווטים', exams: 'מבחנים עיוניים', attendance: 'נוכחות', marches: 'מסעות', qualifications: 'הכשרות והסמכות', readiness: 'כשירות', events: 'אירועים והישגים', private_notes: 'הערות פרטיות', private_followups: 'מעקבים אישיים', private_assessments: 'הערכות מפקד' },
  safe_(v) { if (v === null || v === undefined) return ''; if (typeof v === 'number') return Number.isFinite(v) ? v : ''; if (typeof v === 'boolean') return v ? 'כן' : 'לא'; const s = String(v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; },
  num_(v) { const n = Calc.validNumber(v); return n === null ? '' : Util.display1(n); },

  tables_(ctx, courseId, sections, f, includePrivate) {
    const sol = Mods.soldierMap_(courseId), nm = function (id) { return sol[id] ? sol[id].full_name : ''; }, pn = function (id) { return sol[id] ? sol[id].personal_number : ''; }, T = [];
    const rowsOf = function (table) { return Snapshot.rows(ctx, table, courseId, f).sort(function (a, b) { return String(a._soldier.full_name).localeCompare(String(b._soldier.full_name), 'he'); }); };
    const org = Courses.org(ctx, courseId), dn = {}, tn = {}; org.departments.forEach(function (d) { dn[d.id] = d.name; }); org.teams.forEach(function (t) { tn[t.id] = t.name; });
    sections.forEach(function (sec) {
      if (sec === 'soldiers') T.push({ key: sec, header: ['מספר אישי', 'שם', 'מחלקה', 'צוות', 'פעיל'], rows: Snapshot.soldiers(ctx, courseId, f).map(function (s) { return [s.personal_number, s.full_name, dn[s.department_id] || '', tn[s.team_id] || '', Util.isTrue(s.active)]; }) });
      if (sec === 'fitness') T.push({ key: sec, header: ['מספר אישי', 'שם', 'תאריך', 'ציון משוקלל'], rows: rowsOf('FitnessTests').map(function (r) { return [pn(r.soldier_id), nm(r.soldier_id), Util.cellToIsoDate(r.test_date), !Calc.hasScore(r.weighted_score) ? Fitness.WAITING_TEXT : Reports.num_(r.weighted_score)]; }) });
      if (sec === 'marksmanship') T.push({ key: sec, header: ['מספר אישי', 'שם', 'תאריך', 'נשק', 'מרחק (מ׳)', 'ציון בוחן', 'ציון יל״מ', 'נשק מאופס'], rows: rowsOf('MarksmanshipTests').map(function (r) { return [pn(r.soldier_id), nm(r.soldier_id), Util.cellToIsoDate(r.test_date), r.weapon_type, r.distance_m, Reports.num_(r.examiner_score), Reports.num_(r.ylm_score), Util.isTrue(r.weapon_zeroed)]; }) });
      if (sec === 'navigation') T.push({ key: sec, header: ['מספר אישי', 'שם', 'תאריך', 'סוג ניווט', 'ציון סופי'], rows: rowsOf('NavigationTests').map(function (r) { const ty = Db.get('NavigationTypes', r.navigation_type_id); return [pn(r.soldier_id), nm(r.soldier_id), Util.cellToIsoDate(r.test_date), ty ? ty.name : '', Reports.num_(r.final_score)]; }) });
      if (sec === 'exams') T.push({ key: sec, header: ['מספר אישי', 'שם', 'מבחן', 'מועד', 'תאריך', 'ציון'], rows: rowsOf('TheoreticalExamAttempts').map(function (r) { const d = Db.get('ExamDefinitions', r.exam_id); return [pn(r.soldier_id), nm(r.soldier_id), d ? d.name : '', r.attempt, Util.cellToIsoDate(r.attempt_date), Reports.num_(r.score)]; }) });
      if (sec === 'attendance') T.push({ key: sec, header: ['מספר אישי', 'שם', 'תאריך', 'נוכח', 'יציאה מוקדמת', 'היעדרות מאושרת'], rows: rowsOf('AttendanceRecords').map(function (r) { return [pn(r.soldier_id), nm(r.soldier_id), Util.cellToIsoDate(r._parent.event_date), Util.isTrue(r.present), Util.isTrue(r.early_exit), Util.isTrue(r.absence_approved)]; }) });
      if (sec === 'marches') T.push({ key: sec, header: ['מספר אישי', 'שם', 'תאריך', 'מיקום', 'ק״מ ללא אלונקה', 'ק״מ עם אלונקה', 'נוכח'], rows: rowsOf('MarchAttendance').map(function (r) { return [pn(r.soldier_id), nm(r.soldier_id), Util.cellToIsoDate(r._parent.march_date), r._parent.location, r._parent.km_no_stretcher, r._parent.km_stretcher, Util.isTrue(r.present)]; }) });
      if (sec === 'qualifications') { const qs = Object.create(null); Db.where('Qualifications', function (q) { return q.course_id === courseId; }).forEach(function (q) { qs[q.id] = q; }); T.push({ key: sec, header: ['מספר אישי', 'שם', 'הכשרה', 'סטטוס', 'תאריך השלמה', 'הוצא מההכשרה'], rows: rowsOf('QualificationAssignments').map(function (r) { return [pn(r.soldier_id), nm(r.soldier_id), qs[r.qualification_id] ? qs[r.qualification_id].name : '', Qualifications.LABELS[r.status] || '', Util.cellToIsoDate(r.completion_date), r.exclusion_status === 'approved']; }) }); }
      if (sec === 'readiness') { const cur = Readiness.current_(Snapshot.rows(ctx, 'ReadinessRecords', courseId, f)); T.push({ key: sec, header: ['מספר אישי', 'שם', 'סטטוס כשירות', 'מגבלות', 'בדיקה הבאה'], rows: Snapshot.soldiers(ctx, courseId, f).map(function (s) { const r = cur[s.id]; return [s.personal_number, s.full_name, r ? Readiness.LABELS[r.status] : 'לא הוזן', r ? r.restrictions : '', r ? Util.cellToIsoDate(r.next_review_date) : '']; }) }); }
      if (sec === 'events') T.push({ key: sec, header: ['מספר אישי', 'שם', 'תאריך', 'סוג', 'תיאור'], rows: rowsOf('SoldierEvents').map(function (r) { return [pn(r.soldier_id), nm(r.soldier_id), Util.cellToIsoDate(r.event_date), SoldierEvents.LABELS[r.event_type] || '', r.description]; }) });
    });
    if (includePrivate) {            // ADMIN only (checked by the caller) — explicitly requested
      const ok = Object.create(null); Snapshot.soldiers(ctx, courseId, f).forEach(function (s) { ok[s.id] = true; });
      T.push({ key: 'private_notes', header: ['מספר אישי', 'שם', 'הערה (גרסה אחרונה)'], rows: Private.listNotes(ctx, courseId, '', false).filter(function (n) { return ok[n.soldier_id]; }).map(function (n) { return [pn(n.soldier_id), nm(n.soldier_id), n.note_text]; }) });
      T.push({ key: 'private_followups', header: ['מספר אישי', 'שם', 'מה לבדוק', 'מועד', 'סטטוס'], rows: Private.listFollowUps(ctx, courseId, {}).filter(function (n) { return ok[n.soldier_id]; }).map(function (n) { return [pn(n.soldier_id), nm(n.soldier_id), n.what_to_check, n.due_date, n.status]; }) });
      T.push({ key: 'private_assessments', header: ['מספר אישי', 'שם', 'תאריך', 'מעריך', 'חוזקות', 'לשיפור'], rows: Private.listAssessments(ctx, courseId, '').filter(function (n) { return ok[n.soldier_id]; }).map(function (n) { return [pn(n.soldier_id), nm(n.soldier_id), n.assessment_date, n.author, n.strengths, n.improvement_areas]; }) });
    }
    return T;
  },

  /** Report model (also what the UI previews). spec: {sections[], departmentId, teamId, from, to, include_private}. */
  build(ctx, courseId, spec) {
    spec = spec || {}; Records.guardCourse_(ctx, 'dashboard.view', courseId);
    if (!Array.isArray(spec.sections) || !spec.sections.length || spec.sections.length > 12) throw new AppError('VALIDATION', 'בחרו לפחות פרק אחד לדוח.');
    const secs = Array.from(new Set(spec.sections.map(function (s) { if (typeof s !== 'string' || Reports.SECTIONS.indexOf(s) === -1) throw new AppError('VALIDATION', 'פרק לא מוכר בדוח.'); return s; })));
    ['departmentId', 'teamId', 'from', 'to'].forEach(function (k) { Soldiers.scalar_(spec[k], k); });
    if (spec.include_private !== undefined && typeof spec.include_private !== 'boolean') throw new AppError('VALIDATION', 'include_private חייב להיות כן/לא.');
    const priv = spec.include_private === true; if (priv) Records.guardCourse_(ctx, 'private.read', courseId);
    if (spec.include_inactive !== undefined && typeof spec.include_inactive !== 'boolean') throw new AppError('VALIDATION', 'include_inactive חייב להיות כן/לא.');
    if (spec.include_inactive === true) Records.guardCourse_(ctx, 'private.read', courseId);   // owner decision D4: history of inactive soldiers only when explicitly marked AND permitted (admin)
    const f = { onlyActive: spec.include_inactive === true ? false : true, departmentId: Util.str(spec.departmentId) || undefined, teamId: Util.str(spec.teamId) || undefined, from: Util.str(spec.from) ? Util.isoDate(spec.from, 'מתאריך') : undefined, to: Util.str(spec.to) ? Util.isoDate(spec.to, 'עד תאריך') : undefined };
    const course = Courses.mustGet_(courseId), tables = Reports.tables_(ctx, courseId, secs, f, priv);
    return { title: 'דוח קורס — ' + course.name, course_id: courseId, generated_at: Util.nowIso(), generated_by: ctx.email, include_private: priv, include_inactive: spec.include_inactive === true, filters: f, tables: tables.map(function (t) { return { key: t.key, name: Reports.LABELS[t.key], header: t.header, rows: t.rows }; }) };
  },
  html_(model) {
    const e = function (v) { return String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    let h = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + e(model.title) + '</title><style>body{font-family:Arial,sans-serif;margin:24px}h1{font-size:20px}h2{font-size:16px;margin-top:22px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #888;padding:4px 6px;text-align:right}th{background:#eee}.meta{color:#555;font-size:12px}.priv{color:#a00;font-weight:bold}</style></head><body><h1>' + e(model.title) + '</h1><div class="meta">הופק: ' + e(model.generated_at) + ' · ' + e(model.generated_by) + '</div>';
    if (model.include_inactive) h += '<p class="priv">מסמך זה כולל היסטוריה של חיילים שאינם פעילים (סומן במפורש ע״י מנהל המערכת).</p>';
    if (model.include_private) h += '<p class="priv">מסמך זה כולל מידע פרטי של מ״פ — אין להפיץ.</p>';
    model.tables.forEach(function (t) { h += '<h2>' + e(t.name) + ' (' + t.rows.length + ')</h2><table><thead><tr>' + t.header.map(function (c) { return '<th>' + e(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + (t.rows.length ? t.rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + e(typeof c === 'boolean' ? (c ? 'כן' : 'לא') : c) + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="' + t.header.length + '">אין נתונים</td></tr>') + '</tbody></table>'; });
    return h + '</body></html>';
  },
  // ---------------- analytic A4 report (product-dev6.2) ----------------
  // Inline SVG charts + a data table for every chart (the table is the fallback if the PDF engine drops SVG/CSS). No external fonts/images. Emergency contact / private data are NEVER read here.
  esc_(v) { return String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  noData_(why) { return '<div class="nodata">אין מספיק נתונים' + (why ? ' — ' + Reports.esc_(why) : '') + '</div>'; },
  barSvg_(items) {
    const e = Reports.esc_, W = 480, rowH = 30, H = items.length * rowH + 10, max = Math.max(100, Math.max.apply(null, items.map(function (i) { return i.value; })));
    let g = ''; items.forEach(function (it, k) { const w = Math.round(250 * it.value / max), y = 5 + k * rowH; g += '<text x="' + (W - 4) + '" y="' + (y + 16) + '" text-anchor="end" class="lb">' + e(it.label) + '</text><rect x="' + (W - 140 - w) + '" y="' + y + '" width="' + w + '" height="21" rx="3" fill="#C62828"/><text x="' + (W - 146 - w) + '" y="' + (y + 14) + '" text-anchor="end" class="vl">' + e(it.value) + ' (N=' + e(it.n) + ')</text>'; });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="תרשים עמודות">' + g + '</svg>';
  },
  lineSvg_(tr) {
    const e = Reports.esc_, W = 420, H = 150, L = 30, pts = tr.points, vs = pts.map(function (p) { return p.mean; }).filter(function (v) { return v !== null; });
    const y0 = Math.floor(Math.min.apply(null, vs) / 10) * 10, y1 = Math.max(y0 + 10, Math.ceil(Math.max.apply(null, vs) / 10) * 10), X = function (k) { return L + k * (W - L - 20) / Math.max(1, pts.length - 1); }, Y = function (v) { return H - 24 - (v - y0) / (y1 - y0) * (H - 40); };
    let g = '<line x1="' + L + '" y1="' + (H - 24) + '" x2="' + (W - 10) + '" y2="' + (H - 24) + '" stroke="#667078"/>', line = [];
    pts.forEach(function (p, k) { if (p.mean === null) return; line.push(X(k).toFixed(1) + ',' + Y(p.mean).toFixed(1)); g += '<circle cx="' + X(k).toFixed(1) + '" cy="' + Y(p.mean).toFixed(1) + '" r="3" fill="#C62828"/><text x="' + X(k).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="vl">' + e(p.period) + '</text><text x="' + X(k).toFixed(1) + '" y="' + (Y(p.mean) - 6).toFixed(1) + '" text-anchor="middle" class="vl">' + e(p.mean) + '</text>'; });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="מגמה">' + g.replace('<circle', '<polyline points="' + line.join(' ') + '" fill="none" stroke="#C62828" stroke-width="2"/><circle') + '</svg>';
  },
  tbl_(head, rows) { const e = Reports.esc_; return '<table><thead><tr>' + head.map(function (c) { return '<th>' + e(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + e(c === null || c === undefined ? '—' : c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; },
  PAGE_PX: 955,   // layout model: the page body is packed with blocks of estimated height (GROUP ONLY report: no per-soldier table, scatter or radar exists any more)
  /** @param {Object} d Analytics.reportData; @return {{html:string, pages:number}} self-contained A4 RTL HTML. Blocks (summary KPIs, completeness, insights, definitions, achievements table, comparisons, scatter, radar profiles, trends) are packed into A4 pages in reading order — no fixed one-block-per-page structure, so a short table shares a page with charts and no page is left nearly empty; "page X of N" is exact because N is the packed page count and every page is a real <section>. */
  analyticHtml_(d, title, by, when) {
    const e = Reports.esc_, T = Reports.tbl_, CAP = Reports.PAGE_PX, lines = function (t, cpl) { return Math.max(1, Math.ceil(String(t || '').length / cpl)); };
    const css = '@page{size:A4;margin:12mm}*{box-sizing:border-box}svg{direction:ltr}body{font-family:Arial,Helvetica,sans-serif;color:#202428;margin:0;font-size:13px;line-height:1.4}.pg{height:273mm;overflow:hidden;position:relative;page-break-after:always;padding-bottom:14mm}.pg:last-child{page-break-after:auto}h1{font-size:22px;margin:0 0 4px;border-bottom:3px solid #C62828;padding-bottom:6px}h1.run{font-size:15px;color:#667078;border-bottom:1px solid #E1E5E8;padding-bottom:4px;margin-bottom:6px}h2{font-size:15px;margin:12px 0 6px;color:#C62828}h3{font-size:13px;margin:0 0 4px}.kp{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.k b{white-space:nowrap}.k{border:1px solid #E1E5E8;border-radius:6px;padding:10px 12px;background:#F6F7F8}.k b{display:block;font-size:26px;line-height:1.2}.k small{color:#667078;font-size:11px;display:block}table{border-collapse:collapse;width:100%;margin:4px 0}th,td{border:1px solid #E1E5E8;padding:6px 7px;text-align:right;font-size:12.5px}th{background:#F1F3F5}.lb{font-size:13px;fill:#202428}.vl{font-size:11.5px;fill:#667078}.pt{font-size:11px;fill:#202428}.nodata{border:1px dashed #C9D0D5;padding:8px 12px;text-align:center;color:#667078;font-size:12px;margin:4px 0}.ft{position:absolute;bottom:0;left:0;right:0;border-top:1px solid #E1E5E8;padding-top:4px;color:#667078;font-size:10.5px}.cap{color:#667078;font-size:11.5px}ul{margin:4px 0;padding-right:18px}li{margin-bottom:8px}.grid{display:flex;gap:12px;align-items:flex-start}.grid>div{flex:1 1 46%}.grid>div.w{flex:1 1 62%}.grid>div.n{flex:1 1 32%}.rad{display:flex;gap:10px;flex-wrap:wrap}.rad>div{flex:0 0 calc(33.33% - 7px)}.tr{display:flex;gap:12px;flex-wrap:wrap}.tr>div{flex:0 0 calc(50% - 6px)}.ex{color:#667078;font-size:11.5px;margin-top:2px}';
    let h = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + e(title) + '</title><style>' + css + '</style></head><body>';
    const foot = function (n, total) { return '<div class="ft">' + e(title) + ' · הופק ' + e(when) + ' · ' + e(by) + ' · עמוד ' + n + ' מתוך ' + total + '</div>'; };
    if (d.small_group) return { pages: 1, html: h + '<section class="pg"><div class="bd"><h1>' + e(title) + '</h1>' + Reports.noData_(d.reason) + '<p class="cap">לא מוצגים סכומים, ספירות, כותרות או נתוני קבוצה כלשהם.</p></div>' + foot(1, 1) + '</section></body></html>' };
    // ---- packer ----
    const pages = []; let cur = null;
    const fresh = function () { cur = { px: 0, html: '' }; pages.push(cur); if (pages.length > 1) { cur.html += '<h1 class="run">' + e(title) + ' — המשך</h1>'; cur.px += 40; } };
    const add = function (html, px) { if (!cur) fresh(); if (cur.px + px > CAP && cur.px > 60) fresh(); cur.html += html; cur.px += px; };
    fresh(); cur.html += '<h1>' + e(title) + '</h1><div class="cap">' + d.soldiers + ' חיילים בהיקף · נתונים נכונים ל-' + e(d.generated_at) + '</div>'; cur.px += 70;
    add('<h2>מדדים מרכזיים</h2><div class="kp">' + d.kpis.map(function (k) { return '<div class="k"><small>' + e(k.label) + '</small><b>' + (k.value === null ? '—' : e(k.value)) + '</b><small>' + (k.n !== null && k.n !== undefined ? 'N=' + e(k.n) + ' · ' : '') + e(k.note || '') + '</small></div>'; }).join('') + '</div>', 40 + Math.ceil(d.kpis.length / 5) * 95);
    add('<h2>סטטוס השלמת נתונים</h2><div class="cap">מספר החיילים עם תוצאה רשומה בכל תחום (פעילים בהיקף בלבד).</div>' + T(['תחום', 'חיילים עם תוצאה', 'מתוך', 'חסרים'], d.completeness.map(function (c) { return c.suppressed ? [c.label, 'מדוכא מטעמי פרטיות', '—', '—'] : [c.label, c.have, c.total, c.missing]; })), 72 + (d.completeness.length + 1) * 27);
    add('<h2>תובנות סטטיסטיות מקומיות</h2>' + (d.insights.length ? '<ul>' + d.insights.map(function (i) { return '<li><b>' + e(i.title) + ':</b> ' + e(i.text) + '<div class="ex">חלון: ' + e((i.window.from || '—') + ' עד ' + (i.window.to || '—')) + ' · N=' + e(i.n) + ' · מקור: ' + e(i.source.join(', ')) + '</div><div class="ex">נוסחה: ' + e(i.formula) + '</div><div class="ex">הסתייגות: ' + e(i.caveat) + '</div></li>'; }).join('') + '</ul>' : Reports.noData_('לא נמצאו תובנות בהיקף זה')) + (d.suppressed.length ? '<div class="cap">לא הוצגו: ' + d.suppressed.map(function (x) { return e(x.reason); }).join(' · ') + '</div>' : ''),
      50 + (d.insights.length ? d.insights.reduce(function (a, i) { return a + lines(i.title + i.text, 105) * 18 + lines(i.formula, 125) * 15 + lines(i.caveat, 125) * 15 + 30; }, 0) : 50) + (d.suppressed.length ? 40 : 0));
    // comparisons — bars (unavailable ones collapse into one compact notice), scatter
    const okBars = d.bars.filter(function (b) { return b.available; }), noBars = d.bars.filter(function (b) { return !b.available; });
    okBars.forEach(function (b) { const n = b.items.length; add('<h2>' + e(b.title) + '</h2><div class="grid"><div class="w">' + Reports.barSvg_(b.items) + '</div><div class="n">' + T(['מחלקה', 'ממוצע', 'N'], b.items.map(function (i) { return [i.label, i.value, i.n]; })) + '</div></div>' + (b.hidden_note ? '<div class="ex">' + e(b.hidden_note) + '</div>' : ''), 60 + Math.max(n * 32 + 10, (n + 1) * 33) + (b.hidden_note ? 22 : 0)); });
    if (noBars.length) add('<h2>השוואות בין מחלקות</h2>' + noBars.map(function (b) { return '<div class="nodata"><b>' + e(b.title) + '</b> — אין מספיק נתונים' + (b.reason ? ': ' + e(b.reason) : '') + '</div>'; }).join(''), 46 + noBars.length * 54);
    const okTr = d.trends.filter(function (t) { return t.available; }), noTr = d.trends.filter(function (t) { return !t.available; });
    if (okTr.length) for (let k = 0; k < okTr.length; k += 2) add((k === 0 ? '<h2>מגמות חודשיות</h2>' : '') + '<div class="tr">' + okTr.slice(k, k + 2).map(function (t) { return '<div><h3>' + e(t.label) + '</h3>' + Reports.lineSvg_(t) + '<div class="ex">' + t.points.map(function (p) { return e(p.period) + ': ' + e(p.mean) + ' (N=' + e(p.n) + ')'; }).join(' · ') + '</div></div>'; }).join('') + '</div>', (k === 0 ? 40 : 0) + 235);
    if (noTr.length) add((okTr.length ? '' : '<h2>מגמות חודשיות</h2>') + '<div class="nodata">אין מספיק נתונים למגמה — ' + noTr.map(function (t) { return e(t.label); }).join(', ') + ': נדרשים חודשים עם לפחות ' + Analytics.MIN_GROUP + ' חיילים.</div>', (okTr.length ? 0 : 40) + 50);
    add('<h2>הגדרות</h2><ul>' + d.definitions.map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul><h2>מה אינו כלול במסמך</h2><ul><li>נתונים אישיים כלשהם: טבלת הישגים לפי חייל, תרשים פיזור של חיילים או פרופיל רדאר אישי (דוח קבוצתי בלבד).</li><li>פרטי קשר לחירום, הערות או הערכות פרטיות של מ״פ.</li><li>חיילים שאינם פעילים, וקבוצות קטנות מ-' + Analytics.MIN_GROUP + ' חיילים.</li><li>שיפוט, דירוג או המלצה על חיילים; ציון מרוכב, או סף שלא הוגדר.</li></ul>',
      100 + d.definitions.reduce(function (a, x) { return a + lines(x, 100) * 18 + 6; }, 0) + 3 * 24);
    const total = pages.length;
    h += pages.map(function (pgx, k) { return '<section class="pg"><div class="bd">' + pgx.html + '</div>' + foot(k + 1, total) + '</section>'; }).join('');
    return { pages: total, html: h + '</body></html>' };
  },
  /** Report preview for the UI (dashboard.view; commander = own scope only because the data comes from Snapshot). */
  preview(ctx, courseId, spec) {
    spec = spec || {}; Records.guardCourse_(ctx, 'dashboard.view', courseId); ['departmentId', 'teamId', 'from', 'to'].forEach(function (k) { Soldiers.scalar_(spec[k], k); });
    const course = Courses.mustGet_(courseId), d = Analytics.reportData(ctx, courseId, { departmentId: Util.str(spec.departmentId) || undefined, teamId: Util.str(spec.teamId) || undefined, from: Util.str(spec.from) ? Util.isoDate(spec.from, 'מתאריך') : undefined, to: Util.str(spec.to) ? Util.isoDate(spec.to, 'עד תאריך') : undefined });
    const out = Reports.analyticHtml_(d, 'דוח אנליטי — ' + course.name, ctx.email, d.generated_at); return { title: 'דוח אנליטי — ' + course.name, data: d, html: out.html, pages: out.pages };
  },
  sheetModel_(model) { return { sheets: model.tables.map(function (t) { return { name: String(t.name).replace(/[\[\]\*\?\/\\:]/g, ' ').slice(0, 31), header: t.header.map(Reports.safe_), rows: t.rows.map(function (r) { return r.map(Reports.safe_); }) }; }) }; },

  /** Generate + store (private Drive folder) + log. format: 'pdf' | 'xlsx'. Returns metadata only (never a Drive link). */
  generate(ctx, courseId, spec, format) {
    Records.guardCourse_(ctx, 'report.generate', courseId); if (format !== 'pdf' && format !== 'xlsx') throw new AppError('VALIDATION', 'פורמט: pdf או xlsx.');
    if (format === 'pdf' && (!spec || spec.layout !== 'tabular')) {   // owner decision D3: the analytic A4 RTL report is the DEFAULT PDF; the tabular report is the explicit alternative (layout:'tabular')
      spec = Object.assign({}, spec, { layout: 'analytic' }); const pv = Reports.preview(ctx, courseId, spec); return Reports.store_(ctx, courseId, spec, 'pdf', Adapters.pdfFromHtml(pv.html), pv.data.small_group ? 0 : pv.data.soldiers, false); }
    const model = Reports.build(ctx, courseId, spec); const b64 = format === 'pdf' ? Adapters.pdfFromHtml(Reports.html_(model)) : Adapters.xlsxFromModel(Reports.sheetModel_(model));
    const rows = model.tables.reduce(function (a, t) { return a + t.rows.length; }, 0);
    return Reports.store_(ctx, courseId, spec, format, b64, rows, model.include_private);
  },
  store_(ctx, courseId, spec, format, b64, rows, includePrivate) {
    return Locks.run(function () {
      Records.guardCourse_(ctx, 'report.generate', courseId); const f = Adapters.saveFile('reports', 'report_' + Util.uuid() + '.' + format, format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64);
      const row = { id: Util.uuid(), course_id: courseId, requested_by: ctx.email, requested_at: Util.nowIso(), params_json: JSON.stringify(spec), format: format, file_id: f.id, rows_count: rows, include_private: includePrivate };
      Db.insert('ReportJobs', row); Audit.log(ctx, { courseId: courseId, action: 'REPORT_GENERATE', table: 'ReportJobs', recordId: row.id, after: { format: format, rows: rows, include_private: includePrivate } });
      return { id: row.id, format: format, rows_count: rows, include_private: includePrivate };
    });
  },
  download(ctx, jobId) {
    const j = Db.get('ReportJobs', Util.str(typeof jobId === 'string' ? jobId : '')); if (!j || !Policy.inScope(ctx, j.course_id) || String(j.requested_by).toLowerCase() !== ctx.email && ctx.role !== ROLES.ADMIN) throw new AppError('NOT_FOUND', 'הדוח לא נמצא.');
    Records.guardCourse_(ctx, 'report.generate', j.course_id); const f = Adapters.readFile(j.file_id); return { id: j.id, format: j.format, content_base64: f.b64 };
  },
  jobs(ctx, courseId) { Records.guardCourse_(ctx, 'report.generate', courseId); return Db.where('ReportJobs', function (j) { return j.course_id === courseId; }).map(function (j) { return { id: j.id, format: j.format, requested_by: j.requested_by, requested_at: j.requested_at, rows_count: Number(j.rows_count), include_private: Util.isTrue(j.include_private) }; }); },

  /** Full Excel export of one course: every section, all history rows (admin). Private sheets only on explicit request. */
  fullExport(ctx, courseId, includePrivate) { return Reports.generate(ctx, courseId, { sections: Reports.SECTIONS.slice(), include_private: includePrivate === true }, 'xlsx'); }
};
