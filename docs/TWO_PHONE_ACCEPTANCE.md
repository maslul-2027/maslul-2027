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

---

## בקשה מוכנה להעתקה — לבעלים → IT / InfoSec (פיילוט פרטי בשני טלפונים, נתונים סינתטיים בלבד)
> שלום, אנחנו מבקשים **סביבת TEST פרטית** לפיילוט של אפליקציית MASLUL 2027 על **שני מכשירי בדיקה בלבד, עם מספרים בדויים בלבד** (אין נתוני אמת, אין נתונים צבאיים). הקוד מוכן ונבדק; חסרים רק הדברים הבאים, שרק IT יכול לספק:
> 1. **מארח פרטי מאושר** ברשת פנימית (כתובת RFC1918: `10.x`, `172.16–31.x` או `192.168.x`), נגיש משני מכשירי הבדיקה. ללא חשיפה לאינטרנט, ללא NAT / port-forward / tunnel.
> 2. **שם DNS פנימי + תעודת HTTPS מהימנה** (ממוסדת ב-CA של הארגון, כבר מהימנה במכשירים מנוהלים), עם **SAN התואם** לשם/לכתובת. אין התקנת תעודת שורש על טלפון אישי.
> 3. **נתיב מאובטח לסודות**: סיסמת מנהל ראשונית (PIN), `pepper`, ומפתח אחסון — מאגר סודות מאושר, לא קובץ גלוי ולא משתני סביבה במחשב אישי.
> 4. **תיקיית גיבוי פרטית** עם מדיניות שמירה (כמה עותקים / כמה זמן) והרשאות מוגבלות לשירות בלבד.
> 5. **שני מכשירי בדיקה ייעודיים** (לא מכשירים אישיים של המשתתפים), מאושרים לשימוש בפיילוט.
> 6. **אישור כתוב ל-TEST עם מספרים בדויים בלבד**, וסקירת InfoSec לפני הפעלה.
>
> עד לאישור כל הסעיפים לא נפרוס ולא נחשוף דבר. אין רכישת שירות/ספק/מארח כחלק מהבקשה.

## בדיקה ללא קוד — הבעלים על שני טלפונים (רק אחרי שה-IT סיפק את הנ״ל)
1. **טלפון א׳**: פותחים את הכתובת שה-IT נתן. אם מופיעה אזהרת תעודה — **עוצרים** (לא לאשר, לא להתקין תעודה) ופונים ל-IT.
2. נכנסים עם הטלפון וה-PIN של המנהל הסינתטי (נמסר מה-IT בערוץ מאובטח), פותחים *עוד ← משתמשים ואישורי גישה* ומאשרים את שני המשתמשים הסינתטיים (טלפון ב׳ + משתמש מצוות אחר).
3. **טלפון ב׳**: נכנסים כמשתמש מאושר מאותו צוות. רואים רק את החניכים של הצוות.
4. בטלפון א׳ מוסיפים נוכחות/משימה סינתטית; בטלפון ב׳ מרעננים ורואים אותה. עורכים בב׳ — ובא׳ רואים את העדכון.
5. נכנסים כמשתמש מצוות אחר: לא רואים את הרשומה. נכנסים כצופה: אין כפתורי עריכה.
6. יוצאים ונכנסים שוב; מבקשים מה-IT להפעיל מחדש את השרת — הנתונים נשארים.
7. בסיום: מבקשים מה-IT למחוק את תיקיית הנתונים.
כל שלב מסומן בטבלה למעלה כ-PASS/FAIL **רק** אחרי שבוצע על שני טלפונים פיזיים. **בדיקה בדפדפנים נפרדים על מחשב אחד אינה בדיקה בשני טלפונים פיזיים.** אם אין תשתית מאושרת — לא פורסים; 9 השלבים נשארים **NOT_RUN** והקוד נשאר מוכן.
