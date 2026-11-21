MASLUL 2027 — TEST package for ONE Windows computer          חבילת בדיקה (TEST) למחשב Windows אחד
=====================================================================================================
SYNTHETIC DATA ONLY. No real people, no real phone numbers, no military data.        נתונים סינתטיים בלבד.
This runs on THIS computer only (https://localhost). Phones/other computers cannot reach it.
זה רץ על המחשב הזה בלבד. טלפונים ומחשבים אחרים לא יכולים להתחבר. זו לא בדיקת שני טלפונים.

ONE-TIME PREREQUISITE (honest note: Node is NOT bundled)
  Install "Node.js 22 LTS" (Windows Installer .msi) from https://nodejs.org . A per-user install is enough; no administrator needed if you choose it.
  דרישה חד-פעמית: התקנת Node.js 22 LTS. החבילה לא כוללת את Node.

HOW TO RUN (no commands to type)
  1. Right-click the ZIP -> "Extract All..." to a normal folder such as Documents. Do not run from inside the ZIP.
     (If Windows shows "Windows protected your PC": More info -> Run anyway. The files are not signed; verify them with VERIFY-FILES.cmd.)
  2. Double-click  CHECK-ONLY.cmd   (optional: checks Node, files, folder and port; changes nothing).
  3. Double-click  START-MASLUL-TEST.cmd . A window prints the link, https://localhost:8443/ , and opens your browser.
  4. The browser says "Your connection is not private" once: Advanced -> Proceed to localhost. (Self-signed certificate for this computer only; nothing is installed in Windows.)
  5. Sign in with the SYNTHETIC admin printed in the window (phone 0500000001 + a random 4-digit PIN; also saved in data\ADMIN-LOGIN-SYNTHETIC.txt).
  6. To stop: close the window. Your data stays in the data\ folder (encrypted).

OTHER BUTTONS
  VERIFY-FILES.cmd     checks every file against SHA256SUMS.txt
  BACKUP-NOW.cmd       writes an encrypted backup to data\backups\
  RESTORE-BACKUP.cmd   drag a backup file onto it (close the app first). Invalid/tampered backups are refused and nothing changes.

WHAT IT DOES NOT DO
  No installer, no admin rights, no firewall/hosts/registry change, no certificate added to Windows, no internet call, no real data.
  It is not the private two-phone pilot (that needs an approved private host + trusted certificate + InfoSec approval).

IF IT DOES NOT START
  The window lists exactly what is missing (Node version, incomplete extraction, unwritable folder, busy port). Nothing is changed in that case.
