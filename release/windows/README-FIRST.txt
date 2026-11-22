MASLUL 2027 — TEST package for ONE Windows computer          חבילת בדיקה (TEST) למחשב Windows אחד
=====================================================================================================
SYNTHETIC DATA ONLY. No real people, no real phone numbers, no military data.        נתונים סינתטיים בלבד.
This runs on THIS computer only (https://localhost). Phones/other computers cannot reach it.
זה רץ על המחשב הזה בלבד. טלפונים ומחשבים אחרים לא יכולים להתחבר. זו לא בדיקת שני טלפונים.

ONE-TIME PREREQUISITE (honest note: Node is NOT bundled)
  Install "Node.js 22 LTS" (Windows Installer .msi) from https://nodejs.org . A per-user install is enough; no administrator needed if you choose it.
  דרישה חד-פעמית: התקנת Node.js 22 LTS. החבילה לא כוללת את Node.

GET THE ZIP ONLY FROM THE APPROVED SOURCE
  Download the ZIP only from the repository release / workflow artifact or the internal channel your IT approved. Before extracting, compare its SHA-256 with the digest published SEPARATELY
  (next to the download, in the release notes):   PowerShell ->  Get-FileHash .\MASLUL-TEST-<version>-windows.zip -Algorithm SHA256
  The package is UNSIGNED (no code-signing certificate yet). Follow your organisation's IT/InfoSec approval. Do NOT disable SmartScreen/Defender, do NOT run as administrator,
  and if Windows blocks a file, stop and ask IT - do not work around the warning.
  הורידו את ה-ZIP רק מהמקור המאושר והשוו את ה-SHA-256 שלו לערך שפורסם בנפרד. החבילה אינה חתומה. אין לעקוף הגנות Windows ואין להפעיל כמנהל.

HOW TO RUN (no commands to type)
  1. Right-click the ZIP -> "Extract All..." to a normal folder such as Documents. Do not run from inside the ZIP.
  2. Double-click  CHECK-ONLY.cmd   (checks Node, file integrity, folder, port; changes nothing).
  2b. Optional quick self-test: double-click  SMOKE-TEST.cmd  (about 20 seconds; uses a temporary folder and deletes it; it does NOT touch your data folder and is NOT the two-phone pilot).
  3. Double-click  START-MASLUL-TEST.cmd . It first verifies every file against SHA256SUMS.txt and REFUSES to start if anything is missing, changed or extra.
     Then a window prints the link, https://localhost:8443/ , and opens your browser.
  4. The browser shows "Your connection is not private" once: this is a self-signed certificate for localhost only (nothing is installed in Windows). Compare the SHA-256 fingerprint
     printed in the window with the certificate details, then Advanced -> Continue to localhost. Never do this for any address other than https://localhost:<port>.
  5. Sign in with the SYNTHETIC admin printed in the window (phone 0500000001 + a random 4-digit PIN). It is also saved in the folder  data\ADMIN-LOGIN-SYNTHETIC.txt  (next to START-MASLUL-TEST.cmd).
  6. To stop: close the window. Your data stays in the data\ folder (encrypted).
  If Node.js is missing the window says so and where to get it; nothing is changed.

OTHER BUTTONS
  VERIFY-FILES.cmd     runs the same integrity check on its own (it also runs automatically on every start)
  BACKUP-NOW.cmd       writes a FULL encrypted backup (app data + all saved report files) to data\backups\ (no secrets inside; keep data\secrets.json safe, separately)
  RESTORE-BACKUP.cmd   drag a backup file onto it (close the app first). Invalid/tampered backups are refused and nothing changes; a failed or interrupted restore is rolled back automatically.

WHAT IT DOES NOT DO
  This is NOT an installer and NOT one-click: Node 22 must be installed first, and the localhost certificate warning appears once.
  No installer, no admin rights, no firewall/hosts/registry change, no certificate added to Windows, no internet call, no real data.
  It is not the private two-phone pilot (that needs an approved private host + trusted certificate + InfoSec approval).

IF IT DOES NOT START
  The window lists exactly what is missing (Node version, incomplete extraction, unwritable folder, busy port). Nothing is changed in that case.
