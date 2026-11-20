// In-memory fakes for the Google-only adapters (Drive / PDF / xlsx / OCR). Node tests ONLY — never evidence of real Apps Script behaviour.
function install(X) {
  const files = {}; let n = 0; const calls = { read: 0, pdf: 0, xlsx: 0, ocr: 0 };
  X.Adapters._fake = {
    files, calls, ocrProvider: null,
    saveFile(bucket, name, mime, b64) { const id = 'file-' + (++n); files[id] = { bucket, name, mime, b64, sharing: { access: 'PRIVATE', editors: [], viewers: [] } }; return { id }; },
    /* Drive sharing state the Preflight inspects. Tests mutate it to simulate an over-shared object. Healthy by default. */
    drive: { owner: 'admin@x.com', admin: 'admin@x.com', main: { access: 'PRIVATE', editors: [], viewers: [] }, private: { access: 'PRIVATE', editors: [], viewers: [] }, root: { access: 'PRIVATE', editors: [], viewers: [] }, folders: { documents: { access: 'PRIVATE', editors: [], viewers: [] }, backups: { access: 'PRIVATE', editors: [], viewers: [] }, reports: { access: 'PRIVATE', editors: [], viewers: [] } }, triggers: ['dailyJob_'], failFor: {} },
    driveReport(cap) { const d = X.Adapters._fake.drive, mk = (label, kind, s, req) => d.failFor[label] ? { label, kind, error: 'PERMISSION_DENIED' } : s ? { label, kind, info: { access: s.access, permission: 'VIEW', owner: d.owner, editors: s.editors.slice(), viewers: s.viewers.slice() } } : { label, kind, missing: true, required: !!req };
      const out = { owner: d.owner, admin: d.admin, targets: [mk('main_spreadsheet', 'file', d.main, true), mk('private_spreadsheet', 'file', d.private, true), mk('drive_root', 'folder', d.root, false)], truncated: [], triggers: d.triggers };
      ['documents', 'backups', 'reports'].forEach(b => { const used = Object.keys(files).filter(k => files[k].bucket === b && !files[k].trashed); out.targets.push(mk(b, 'folder', used.length || d.folders[b] ? d.folders[b] : null, false)); used.slice(0, cap).forEach(k => out.targets.push(mk(b + '/' + files[k].name, 'file', files[k].sharing, false))); if (used.length > cap) out.truncated.push(b); });
      return out; },
    readFile(id) { calls.read++; if (!files[id]) throw new Error('no such file'); return { name: files[id].name, mime: files[id].mime, b64: files[id].b64 }; },
    trashFile(id) { if (!files[id]) throw new Error('no such file'); files[id].trashed = true; },
    fileState(id) { if (!files[id]) return 'unknown'; return files[id].trashed ? 'trashed' : 'exists'; },
    pdfFromHtml(html) { calls.pdf++; return Buffer.from('%PDF-1.4 fake ' + html.length).toString('base64'); },
    xlsxFromModel(model) { calls.xlsx++; return Buffer.from(JSON.stringify(model)).toString('base64'); },
    ocrAvailable() { return !!X.Adapters._fake.ocrProvider; },
    ocrExtract(b64, mime, target) { calls.ocr++; if (!X.Adapters._fake.ocrProvider) throw new X.AppError('NOT_CONFIGURED', 'ספק OCR לא הוגדר.'); return X.Adapters._fake.ocrProvider(b64, mime, target); }
  };
  return X.Adapters._fake;
}
const PDF = Buffer.from('%PDF-1.4\n%fake\n').toString('base64'), PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).toString('base64'), JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]).toString('base64');
module.exports = { install, PDF, PNG, JPG };
