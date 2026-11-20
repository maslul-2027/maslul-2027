/**
 * Adapters — the ONLY place that touches Google-only services (Drive, PDF conversion, OCR provider). v1.0.0.
 * Server modules call Adapters.* with base64 strings; Node tests install a fake (Adapters._fake). The Apps Script branches below are
 * UNVERIFIED in this package (no Apps Script runtime available during development) — see TEST_REPORT "not run in real Apps Script".
 * Files are created PRIVATE (owner = the deploying admin, no sharing). Nobody gets a Drive link: access only through Documents.download (server-side policy).
 */
const Adapters = {
  _fake: null,
  impl_() { return Adapters._fake || Adapters.gas_; },
  folder_(name) {
    const props = PropertiesService.getScriptProperties(); let rootId = props.getProperty('DRIVE_ROOT_ID'), root;
    if (rootId) { root = DriveApp.getFolderById(rootId); } else { root = DriveApp.createFolder('Course Tracker Files (do not share)'); props.setProperty('DRIVE_ROOT_ID', root.getId()); root.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); }
    const it = root.getFoldersByName(name); if (it.hasNext()) return it.next(); const f = root.createFolder(name); f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); return f;
  },
  gas_: {
    saveFile(bucket, name, mime, b64) {
      const blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name), f = Adapters.folder_(bucket).createFile(blob);
      f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); return { id: f.getId() };
    },
    readFile(id) { const f = DriveApp.getFileById(id), b = f.getBlob(); return { name: f.getName(), mime: b.getContentType(), b64: Utilities.base64Encode(b.getBytes()) }; },
    trashFile(id) { DriveApp.getFileById(id).setTrashed(true); },
    fileState(id) { try { const f = DriveApp.getFileById(id); return f.isTrashed() ? 'trashed' : 'exists'; } catch (e) { return 'unknown'; } },
    pdfFromHtml(html) { return Utilities.base64Encode(Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf').getBytes()); },
    xlsxFromModel(model) {
      const ss = SpreadsheetApp.create('tmp-export-' + Utilities.getUuid());
      try {
        model.sheets.forEach(function (s, i) { const sh = i === 0 ? ss.getSheets()[0] : ss.insertSheet(); sh.setName(String(s.name).slice(0, 99)); sh.setRightToLeft(true); const vals = [s.header].concat(s.rows); if (vals[0].length) { sh.getRange(1, 1, vals.length, vals[0].length).setNumberFormat('@').setValues(vals); sh.getRange(1, 1, 1, vals[0].length).setFontWeight('bold'); } });
        const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
        return Utilities.base64Encode(res.getBlob().getBytes());
      } finally { DriveApp.getFileById(ss.getId()).setTrashed(true); }
    },
    /** READ-ONLY inspection of the real Drive sharing state (UNVERIFIED in Apps Script). Never changes anything. */
    driveReport(cap) {
      const props = PropertiesService.getScriptProperties(), out = { owner: '', admin: String(props.getProperty(APP.PROP.ADMIN_EMAIL) || ''), targets: [], truncated: [], triggers: null };
      const info = function (o) {
        const own = o.getOwner(), mail = function (u) { return u && u.getEmail ? u.getEmail() : ''; };
        if (own && !out.owner) out.owner = mail(own);
        return { access: String(o.getSharingAccess()), permission: String(o.getSharingPermission()), owner: mail(own), editors: o.getEditors().map(mail), viewers: o.getViewers().map(mail), trashed: o.isTrashed ? o.isTrashed() : false };
      };
      const probe = function (label, kind, getter, required) { try { const o = getter(); if (!o) out.targets.push({ label: label, kind: kind, missing: true, required: required }); else out.targets.push({ label: label, kind: kind, info: info(o) }); } catch (e) { out.targets.push({ label: label, kind: kind, error: String(e && e.message || e) }); } };
      probe('main_spreadsheet', 'file', function () { const id = props.getProperty(APP.PROP.MAIN_DB); return id ? DriveApp.getFileById(id) : null; }, true);
      probe('private_spreadsheet', 'file', function () { const id = props.getProperty(APP.PROP.PRIVATE_DB); return id ? DriveApp.getFileById(id) : null; }, true);
      let root = null; try { const rid = props.getProperty('DRIVE_ROOT_ID'); root = rid ? DriveApp.getFolderById(rid) : null; } catch (e) { out.targets.push({ label: 'drive_root', kind: 'folder', error: String(e && e.message || e) }); }
      if (!root) { if (!out.targets.some(function (t) { return t.label === 'drive_root'; })) out.targets.push({ label: 'drive_root', kind: 'folder', missing: true, required: false }); }
      else {
        probe('drive_root', 'folder', function () { return root; }, false);
        ['documents', 'backups', 'reports'].forEach(function (b) {
          const it = root.getFoldersByName(b); if (!it.hasNext()) { out.targets.push({ label: b, kind: 'folder', missing: true, required: false }); return; }
          const f = it.next(); probe(b, 'folder', function () { return f; }, false);
          const files = f.getFiles(); let n = 0; while (files.hasNext()) { if (n >= cap) { out.truncated.push(b); break; } const file = files.next(); n++; probe(b + '/' + file.getName(), 'file', function () { return file; }, false); }
        });
      }
      try { out.triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }); } catch (e) { out.triggers = null; }
      return out;
    },
    ocrAvailable() { return false; },                       // no OCR provider chosen yet (open decision) — infrastructure only
    ocrExtract() { throw new AppError('NOT_CONFIGURED', 'ספק OCR לא הוגדר.'); }
  },
  saveFile(bucket, name, mime, b64) { return Adapters.impl_().saveFile(bucket, name, mime, b64); },
  readFile(id) { return Adapters.impl_().readFile(id); },
  trashFile(id) { return Adapters.impl_().trashFile(id); },
  fileState(id) { return Adapters.impl_().fileState(id); },
  pdfFromHtml(html) { return Adapters.impl_().pdfFromHtml(html); },
  xlsxFromModel(model) { return Adapters.impl_().xlsxFromModel(model); },
  driveReport(cap) { return Adapters.impl_().driveReport(cap); },
  ocrAvailable() { return Adapters.impl_().ocrAvailable(); },
  ocrExtract(fileB64, mime, target) { return Adapters.impl_().ocrExtract(fileB64, mime, target); }
};
