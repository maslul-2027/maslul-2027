# MASLUL 2027 — private two-phone TEST: acceptance path (SYNTHETIC DATA ONLY)

**Status: automated evidence only. Physical two-phone acceptance = NOT_RUN.**
Separate browser contexts on one machine (`scripts/private_test_probe.js`, `e2e_secure_browser.js`) are **not** a test on two physical phones. They prove server-side logic (A writes, authorized B reads, foreign team blocked, viewer read-only, persistence across refresh/logout/re-login/restart). They do not prove phone networking, certificate trust on a real device, mobile browser quirks or real SMS/phone-ownership checks.

## Network policy (enforced in code: `backend_next/private_net.js`)
- The server binds only to an **RFC1918 IPv4** (10/8, 172.16/12, 192.168/16) or **IPv6 ULA** (fc00::/7) literal. Public IPs, `0.0.0.0`, `::`, multicast, link-local, CGNAT, IPv4-mapped IPv6 and DNS names as `--bind` are refused (tests: `tests/private_net.js`).
- HTTPS only; no HTTP listener; `ORIGIN` must be `https://` and a private IP equal to the bind, or a DNS name. A non-loopback bind requires a real certificate file pair.
- The tool opens no firewall, NAT, port-forward or tunnel. No public deployment of this server.

## Certificate route (decision for IT / InfoSec)
1. **Preferred:** IT issues a trusted HTTPS certificate for an internal pilot name (internal CA already trusted on managed devices, or a public-CA cert for an internal name). Nothing is installed on phones.
   `MASLUL_SYNTHETIC_ONLY_ACK=yes node backend_next/private_test_launch.js --name pilot.example.internal --bind 10.1.2.3 --cert fullchain.pem --key privkey.pem`
   The launcher refuses to start if the SAN lacks the name, the cert is expired/near expiry, or the key does not match.
2. **Access:** approved private VPN / organization-managed test devices on the private network.
3. **Fallback only with explicit owner + InfoSec approval, dedicated test devices only:** short-lived (7 days) private CA, enabled by `MASLUL_CA_FALLBACK_APPROVED=owner+infosec-dedicated-test-devices`. Never install it on a personal device without that approval. The CA private key is deleted immediately after signing and never leaves the host; only `ca.crt` is given to devices (verify SHA-256 fingerprint printed by the launcher). **At the end of the pilot remove the trust profile / root CA from every device and delete the pilot directory.**

## Still OPEN (not decided, not done)
Hosting/private network and who runs it · approved certificate · secret store for `STATE_KEY`/seed admin PIN (today: environment variables, no managed secret store) · backup location · real phone-ownership verification (no SMS vendor selected) · InfoSec review · owner go-live approval.

## Physical acceptance table (two real phones) — all NOT_RUN
| # | Step | Result |
|---|------|--------|
| 1 | Phone A opens the pilot URL with no certificate warning | NOT_RUN |
| 2 | Phone A logs in (phone + PIN), admin-approved | NOT_RUN |
| 3 | A writes a synthetic record | NOT_RUN |
| 4 | Phone B (same course/team) logs in and sees it | NOT_RUN |
| 5 | Phone B edits; A sees the change | NOT_RUN |
| 6 | Foreign-team user cannot see it | NOT_RUN |
| 7 | Viewer cannot change anything | NOT_RUN |
| 8 | Data persists after refresh, logout/login, server restart | NOT_RUN |
| 9 | Pilot ends: trust profile removed, directory deleted | NOT_RUN |

## עדכון אבטחה (סקירת מנהל): הפעלה ישירה = אותה הקפדה כמו ה-launcher
`test_server.start()` (כניסה ישירה, ללא `private_test_launch`) כבר אינו עוקף: בלשון non-loopback הוא דורש (1) bind RFC1918/ULA בלבד; (2) ORIGIN ב-https, וכש-ORIGIN הוא IP — **שווה ל-bind**; (3) פורט ה-ORIGIN **שווה** לפורט ההאזנה; (4) תעודה+מפתח שסופקו: SAN מכיל את מארח ה-ORIGIN, בתוקף כעת ולפחות שעה, והמפתח תואם לתעודה (`private_net.checkCertFiles`, ללא openssl, משותף ל-launcher). כשל = השרת לא עולה ולא נשמע דבר. מסלול ה-loopback של חבילת Windows (תעודת Node טהור) לא מושפע. בדיקות: `tests/private_net.js` (10) כולל ORIGIN שגוי, פורט שגוי, SAN שגוי, פג תוקף, מפתח לא תואם, קבצים חסרים, ופיקסצ'ר פרטי מאושר חיובי.

## מה צריך מהבעלים/IT לפיילוט שני הטלפונים (NOT_RUN עד אז)
1. מארח פרטי מאושר ברשת RFC1918 + כתובת/שם קבוע. 2. תעודת HTTPS מהימנה מה-IT (לא CA על מכשיר אישי). 3. מאגר סודות + נתיב גיבוי. 4. שני מכשירים סינתטיים מאושרים. 5. אישור InfoSec ושער go-live של הבעלים. PIN בלבד אינו מאמת בעלות טלפון.
