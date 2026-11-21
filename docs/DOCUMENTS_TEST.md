# Secure document upload / download — private TEST server and Windows package (Issue #72, part 3)

Synthetic data only. Works for real **only** in the private TEST server and the Windows TEST package. The public demo has no file engine, so `docs.upload` / `docs.download` stay `BLOCKED_NOT_CONNECTED` there (the public route ledger stays 158 PASS / 5 POLICY_BLOCKED / 13 BLOCKED_NOT_CONNECTED; nothing is faked).

## What was connected
| Layer | Behaviour |
|---|---|
| Engine (`src/Documents.gs`, unchanged/frozen) | 8 MB cap, allowed types pdf/png/jpg/jpeg/docx/xlsx, magic bytes, file-name cleaning, course/team scope, commander = own uploads only, admin = any, viewer denied, DOC_UPLOAD / DOC_READ audit |
| Host adapter (`engine_host.js`) | bucket `documents` allowed; **content guard** + per-installation quota (300 MB) before anything is stored; bidi / zero-width characters stripped from file names |
| `backend_next/content_guard.js` | PDF: no /JavaScript, /JS, /Launch, /OpenAction, /AA, /EmbeddedFile, /RichMedia, /XFA, /SubmitForm, /GoToE, /GoToR; PNG: signature, IHDR first, CRC of every chunk, IEND last, no trailing bytes; JPEG: SOI/EOI, no trailing payload; docx/xlsx: strict ZIP central-directory reader (entry count / size / ratio bounds → zip-bomb refusal, no `..`/absolute names, no encryption flag, no executable extensions, no vbaProject / macros / ActiveX / embeddings / OLE / .bin, required parts, no External relationship targets) |
| Storage | `file_store.js`: AES-256-GCM per file, random id `f_<32 hex>`, mode 0600; the user never chooses a path |
| Download | `GET /api/download/document/:id` (session cookie): the engine decides access; binary response with fixed ASCII name `maslul-doc-<id8>.<ext>`, `content-disposition: attachment`, `nosniff`, `no-store`, `content-security-policy: sandbox; default-src 'none'`; allow and deny both audited; document ids and report ids are separate namespaces |
| Upload size | authenticated `POST /api` may carry up to 12 MB (an 8 MB file is ~10.7 MB base64); every other body keeps the 2 MB cap |
| Backups | documents live in the same file store, so every full backup (`backup.create`, launcher `--backup`) includes them; restore brings back a deleted document byte-identical |

## Evidence (all run locally on Linux; CI + Windows results are in the PR)
* `tests/documents_server.js` — 14 tests over HTTPS: 5 allowed types upload and download byte-identical; commander own-team upload/download, foreign-team and no-trainee refusal; admin file hidden from commander; other-team commander and viewer denied; anonymous 401; traversal-looking ids refused; **24 hostile/invalid uploads all refused with nothing stored** (MZ renamed .pdf, PDF with JavaScript/Launch/OpenAction/EmbeddedFile, PNG bad CRC / trailing payload, JPEG trailing payload / HTML, docx with macro / embedded exe / external relationship / zip-slip name / wrong-kind / 70 MB zip bomb, .exe, .pdf.exe, .docm, .html, .svg, empty, tiny); oversize 8 MB + 10 MB; unauthenticated 2 MB cap; file-name tricks; quota; encrypted at rest + audit; **backup → delete a document file → restore → byte-identical**; restart persistence; unit test of the guard.
* `scripts/e2e_documents_browser.js` — 7 browser checks: real file picker upload, three refusals shown in the dialog, real download event byte-identical (sha256), ciphertext at rest, no horizontal overflow at 320/360/414, viewer has no upload control and download refused, commander does not see the admin file, UI-origin evidence for `docs.upload` and `docs.download`.
* `scripts/e2e_release_package.js` — extended (now 28 on Linux): the packaged server accepts a real PDF, refuses an active-content PDF, serves the download with the exact length and a safe attachment name, files are ciphertext.

## NOT claimed
* **OCR stays NOT_CONNECTED**: no extraction, no scanning; an approved local engine + human review is required first.
* No antivirus engine: the guard is a strict structural allowlist, not malware detection. Files are never rendered or executed server-side.
* Document list rows for a viewer are metadata only; the physical two-phone acceptance remains NOT_RUN.
