# -*- coding: utf-8 -*-
"""
Transcription of the two scoring-table images supplied by the user (boys / girls) for v1.0.3.
Source of authority: the user's images (image 1 = boys "בוחן כושר גופני · בנים", image 2 = girls — the user stated that table 2 is the girls' table).
Nothing here is interpolated or completed: every row below is a row printed in the image.
Run:  python3 scoring/transcribe_v103.py   -> writes src/FitnessDraft.gs, scoring/fitness_scoring_v103.json, scoring/fitness_scoring_v103.csv, docs/FITNESS_SCORING_TRANSCRIPTION_v1.0.3.md
"""
import json, csv, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def sec(t):
    m = re.fullmatch(r'(\d{1,2}):(\d{2})', t); assert m, t
    return int(m.group(1)) * 60 + int(m.group(2))

def times(rows):
    """rows: list of (score, 'a-b' | '<=a' | '>=a' | 'a')  -> [score, from_sec|None, to_sec|None]"""
    out = []
    for sc, r in rows:
        if r.startswith('<='): out.append([sc, None, sec(r[2:])])
        elif r.startswith('>='): out.append([sc, sec(r[2:]), None])
        elif '-' in r: a, b = r.split('-'); out.append([sc, sec(a), sec(b)])
        else: out.append([sc, sec(r), sec(r)])
    return out

def reps(rows):
    out = []
    for sc, r in rows:
        if '-' in r: a, b = r.split('-'); out.append([sc, int(a), int(b)])
        else: out.append([sc, int(r), int(r)])
    return out

def ladder3(first, start_score, spec):
    """3km tables are printed as 3 columns of consecutive scores; spec = list of range strings from the best score downward."""
    rows = []
    sc = start_score
    for r in spec:
        rows.append((sc, r)); sc -= 1
    return rows

# ---------- boys, 3 km (image 1) : 61 rows, scores 100..40 ----------
B3 = ['<=10:57','10:58-11:03','11:04-11:09','11:10-11:15','11:16-11:20','11:21-11:25','11:26-11:30','11:31-11:35','11:36-11:40','11:41-11:45','11:46-11:50','11:51-11:55','11:56-12:00','12:01-12:05','12:06-12:10','12:11-12:15','12:16-12:20','12:21-12:25','12:26-12:30','12:31-12:35','12:36-12:40',
      '12:41-12:45','12:46-12:50','12:51-12:55','12:56-13:00','13:01-13:05','13:06-13:10','13:11-13:15','13:16-13:20','13:21-13:25','13:26-13:31','13:32-13:37','13:38-13:42','13:43-13:48','13:49-13:54','13:55-14:00','14:01-14:05','14:06-14:11','14:12-14:17','14:18-14:23','14:24-14:29','14:30-14:39',
      '14:40-14:49','14:50-14:59','15:00-15:09','15:10-15:20','15:21-15:26','15:27-15:32','15:33-15:39','15:40-15:45','15:46-15:52','15:53-15:59','16:00-16:05','16:06-16:11','16:12-16:18','16:19-16:24','16:25-16:31','16:32-16:37','16:38-16:43','16:44-16:50','>=16:51']
# ---------- girls, 3 km (image 2) ----------
G3 = ['<=12:38','12:39-12:47','12:48-12:57','12:58-13:06','13:07-13:15','13:16-13:24','13:25-13:33','13:34-13:42','13:43-13:51','13:52-14:00','14:01-14:09','14:10-14:18','14:19-14:27','14:28-14:37','14:38-14:46','14:47-14:55','14:56-15:04','15:05-15:13','15:14-15:22','15:23-15:31','15:32-15:40',
      '15:41-15:49','15:50-15:58','15:59-16:08','16:09-16:17','16:18-16:26','16:27-16:35','16:36-16:44','16:45-16:53','16:54-17:02','17:03-17:11','17:12-17:20','17:21-17:29','17:30-17:39','17:40-17:48','17:49-17:57','17:58-18:06','18:07-18:15','18:16-18:24','18:25-18:33','18:34-18:42','18:43-18:51',
      '18:52-19:00','19:01-19:09','19:10-19:19','19:20-19:28','19:29-19:37','19:38-19:46','19:47-19:55','19:56-20:04','20:05-20:13','20:14-20:22','20:23-20:31','20:32-20:40','20:41-20:50','20:51-20:59','21:00-21:08','21:09-21:17','21:18-21:26','21:27-21:35','>=21:36']
assert len(B3) == 61 and len(G3) == 61

R300_M = [(100,'<=00:43'),(95,'00:44'),(90,'00:45-00:46'),(85,'00:47-00:48'),(80,'00:49-00:50'),(75,'00:51-00:53'),(70,'00:54-00:56'),(65,'00:57-00:59'),(60,'01:00-01:01'),(55,'01:02-01:04'),(50,'01:05-01:07'),(45,'01:08-01:10'),(40,'>=01:11')]
R300_F = [(100,'<=00:50'),(95,'00:51-00:52'),(90,'00:53-00:54'),(85,'00:55-00:56'),(80,'00:57-00:59'),(75,'01:00-01:02'),(70,'01:03-01:04'),(65,'01:05-01:06'),(60,'01:07-01:09'),(55,'01:10-01:12'),(50,'01:13-01:14'),(45,'01:15-01:16'),(40,'>=01:17')]

PARALLEL = [(100,'20'),(95,'19'),(90,'18'),(85,'17'),(80,'15-16'),(75,'13-14'),(70,'11-12'),(65,'9-10'),(60,'7-8'),(55,'5-6'),(50,'3-4'),(45,'2'),(40,'1')]   # identical printed values in both images; kept as two separate tables
PULL_M_NONE = PARALLEL      # boys, "ללא משקל חיצוני" (printed 20..1)
PULL_M_VEST = [(100,'15'),(95,'14'),(90,'13'),(85,'12'),(80,'11'),(75,'10'),(70,'9'),(65,'8'),(60,'7'),(55,'5-6'),(50,'3-4'),(45,'2'),(40,'1')]   # boys, "אפוד אישי · 7 ק״ג" (printed 15..1)
PULL_F_BAND = [(100,'20'),(95,'19'),(90,'17-18'),(85,'14-16'),(80,'11-13'),(75,'9-10'),(70,'7-8'),(65,'5-6'),(60,'4'),(55,'3'),(50,'2'),(40,'1')]   # girls, "בסיוע גומי": 1 rep = 40 is an APPROVED PROFESSIONAL DECISION (N1, v1.0.6) — NOT a value copied from the source image (the image prints 45 for one rep)
TRAP = [(100,'10'),(95,'9'),(90,'8'),(80,'7'),(70,'6'),(60,'5'),(50,'4'),(40,'3'),(30,'2'),(20,'1')]   # same score ladder in both images; working weight differs (boys 80 kg, girls 40 kg)

V_NONE, V_VEST, V_BAND = 'ללא משקל חיצוני', 'אפוד אישי 7 ק״ג', 'בסיוע גומי'
TABLES = []
def add(tid, gender, comp, variant, kind, rows, meta=None, excluded=None):
    t = {'id': tid, 'gender': gender, 'component': comp, 'variant': variant, 'sheet': gender, 'kind': kind, 'rows': rows}
    if meta: t['meta'] = meta
    if excluded: t['excluded'] = excluded   # kept as historical source material; never imported / never used for scoring
    TABLES.append(t)
for g, label in (('M', 'בנים'), ('F', 'בנות')):
    add('run3km_' + g, g, 'run3km', '', 'time', times(ladder3(None, 100, B3 if g == 'M' else G3)))
    add('run150x2_' + g, g, 'run150x2', '', 'time', times(R300_M if g == 'M' else R300_F))
    add('trap_bar_' + g, g, 'trap_bar', '', 'reps', reps(TRAP), {'work_weight_kg': 80 if g == 'M' else 40})
add('parallel_bars_M', 'M', 'parallel_bars', V_NONE, 'reps', reps(PARALLEL))
add('parallel_bars_F', 'F', 'parallel_bars', V_BAND, 'reps', reps(PARALLEL))
add('pullups_M_none', 'M', 'pullups', V_NONE, 'reps', reps(PULL_M_NONE), excluded='v1.0.6: אין מסלול ניקוד "מתח ללא משקל חיצוני" לבנים (החלטה מקצועית מחייבת). חומר מקור היסטורי בלבד — לא מיובא ולא משמש לחישוב.')
add('pullups_M_vest', 'M', 'pullups', V_VEST, 'reps', reps(PULL_M_VEST))
add('pullups_F_band', 'F', 'pullups', V_BAND, 'reps', reps(PULL_F_BAND), {'flag_rows': {'12': 'PROF_DECISION_N1'}, 'professional_decision': 'N1: חזרה אחת = 40 נק׳ — החלטה מקצועית מאושרת (v1.0.6). לא ערך שהועתק מהמקור (בתמונה: 45). 0 חזרות — אין ציון אוטומטי, נדרשת בדיקה.'})

UNCERTAIN = [
 {'id': 'N1', 'status': 'CLOSED', 'status_note': 'נסגר (v1.0.6): החלטה מקצועית מאושרת — חזרה אחת = 40 נק׳; 0 חזרות = אין ציון אוטומטי, נדרשת בדיקה', 'topic': 'מתח בנות (בסיוע גומי) — חזרה אחת', 'detail': 'בתמונה שורת החזרה האחת מודפסת 45 נק׳. ה-40 הוא החלטה מקצועית מאושרת ולא ערך שהועתק מהמקור (סימון בשורה: PROF_DECISION_N1). 0 חזרות — מחוץ לטבלה → בקשת בדיקה.', 'needed': 'אין.'},
 {'id': 'N2', 'status': 'CLOSED', 'status_note': 'נסגר (v1.0.6): טבלת האפוד האישי 7 ק״ג היא המסלול היחיד לבנים; מסתיימת ב-15 חזרות', 'topic': 'מתח בנים — איזו תת-טבלה היא איזה סוג ביצוע', 'detail': 'לבנים בכל סוגי המבחנים משתמשים אך ורק בטבלת ״אפוד אישי · 7 ק״ג״ (100 = 15 חזרות). ״ללא משקל חיצוני״ אינו מסלול ניקוד תקף לבנים; הטבלה נשמרת כחומר מקור היסטורי בלבד ואינה מיובאת.', 'needed': 'אין.'},
 {'id': 'N3', 'status': 'CLOSED', 'status_note': 'נסגר בראיה: 122 שורות 3 ק״מ זהות בין שני תמלולים עצמאיים (צילומי המקור המקוריים והתמונות הערוכות), והרצף 100→40 רציף, שורה אחת לכל ציון (נבדק בבדיקה אוטומטית)', 'topic': 'ריצת 3 ק״מ — ספרת היחידות של הציון נחתכת בתמונה', 'detail': 'בשתי תמונות (בנים ובנות) בעמודות הראשונה והשנייה ספרת היחידות של הציון נחתכת חלקית בקצה העמודה. הציונים נקבעו לפי הרצף (61 שורות, ירידה של 1 בכל שורה, 100→40) והספרות הנראות תואמות.', 'needed': 'אישור ויזואלי קצר (ספירה: 21+21+19 שורות בכל טבלה).'},
 {'id': 'N4', 'status': 'CLOSED', 'status_note': 'נסגר: הובהר על ידך — התמונה השנייה היא טבלת הבנות', 'topic': 'התמונה השנייה אינה נושאת כותרת ״בנות״', 'detail': 'כותרת התמונה השנייה היא ״בוחן כושר גופני״ בלבד. השיוך לבנות נעשה לפי הצהרת המשתמש וסימנים בתמונה (בסיוע גומי, Trap Bar 40 ק״ג, זמנים איטיים יותר).', 'needed': 'אישור שהתמונה השנייה היא טבלת הבנות (נלקח מהודעתך).'},
 {'id': 'N5', 'status': 'CLOSED', 'status_note': 'הוחלט: ערך מחוץ לטווח לא מקבל ציון אוטומטי (נדרשת בדיקה); אין חיתוך למקסימום ואין מעבר לטבלה אחרת', 'topic': 'ערכים מחוץ לטווח', 'detail': 'חזרות מעל המקסימום המודפס (בנים 15 / בנות 20 / מקבילים 20 / Trap Bar 10) או 0 חזרות (במתח בנות ובשאר הרכיבים) — אין ציון אוטומטי ומוצג ״מחוץ לטווח הטבלה — נדרשת בדיקה״. זמנים: פתוחים בשני הקצוות.', 'needed': 'אין.'},
 {'id': 'N6', 'status': 'CLOSED', 'status_note': 'נסגר (v1.0.6): אין בחירת סוג ביצוע — לבנים תמיד אפוד אישי 7 ק״ג בכל סוגי המבחנים', 'topic': 'סוג ביצוע במתח לבנים', 'detail': 'הכלל קבוע בקוד (Fitness.POLICY_VARIANT) ואינו תלוי בהגדרת סוג מבחן. ניסיון לבחור ״ללא משקל חיצוני״ נדחה. אין fallback שקט בין טבלאות.', 'needed': 'אין.'},
 {'id': 'N7', 'status': 'CLOSED', 'status_note': 'הוחלט: תמונות המקור הן הסמכות; הנוסחה הישנה לא בשימוש', 'topic': 'Trap Bar — סתירה לנוסחה הקודמת', 'detail': 'ערכי הטבלה נקבעים לפי תמונות המקור (9=95, 8=90, 7=80, 6=70 ...). הנוסחה 100−10×(10−חזרות) לא בשימוש.', 'needed': 'אין.'},
 {'id': 'N8', 'status': 'CLOSED', 'status_note': 'נסגר בראיה: תת-הכותרת בתמונה היא "2×150 מ׳ · ניקוד לפי זמן" — אותו רכיב', 'topic': 'שם רכיב ריצת 300 מ׳', 'detail': 'התמונות: ״ריצת הלוך־חזור 300 מ׳ (2×150 מ׳)״. זה אותו רכיב שהיה ״ריצת 150×2״ (מזהה פנימי run150x2 נשמר כדי לא לשבור נתונים). התווית שונתה.', 'needed': 'אישור שמדובר באותו רכיב.'},
 {'id': 'N9', 'status': 'CLOSED', 'status_note': 'אין פעולה', 'topic': 'שם רכיב המתח', 'detail': 'בתמונות רכיב המתח נקרא בשם ישן. בקוד ובממשק של v1.0.2 המונח כבר ״מתח״, ולכן לא נדרש שינוי.', 'needed': 'אין.'},
 {'id': 'U6', 'status': 'OPEN', 'status_note': 'פתוח — הכרעה נפרדת', 'topic': 'סף 60 נקודות לרכיב (מהתמלול הישן) — ללא שינוי', 'detail': 'נשאר פתוח; לא מומש ולא נוגעים בו בסבב זה.', 'needed': 'הכרעה נפרדת.'},
]

def check(t):
    rows = t['rows']; prev = None
    for i, r in enumerate(rows):
        if i: assert r[0] < rows[i - 1][0], (t['id'], 'scores not descending')
        if t['kind'] == 'time':
            if i == 0: assert r[1] is None
            if i == len(rows) - 1: assert r[2] is None
            if i:
                assert r[1] == rows[i - 1][2] + 1, (t['id'], i, 'gap/overlap', r, rows[i - 1])
        else:
            assert r[1] <= r[2]
            if i: assert rows[i - 1][1] == r[2] + 1, (t['id'], i, 'gap/overlap', r, rows[i - 1])
for t in TABLES: check(t)
exp = {'run3km': 61, 'run150x2': 13, 'trap_bar': 10, 'parallel_bars': 13, 'pullups': None}
for t in TABLES:
    if exp.get(t['component']): assert len(t['rows']) == exp[t['component']], (t['id'], len(t['rows']))
assert [len(t['rows']) for t in TABLES if t['id'].startswith('pullups')] == [13, 13, 12]

DRAFT = {'status': 'TRANSCRIBED_FROM_IMAGES_PENDING_USER_CONFIRMATION',
 'note': 'תמלול מתמונות הניקוד שהמשתמש צירף (בנים/בנות). הטבלאות נטענות כגרסת DRAFT בלבד; שימוש בחישוב — רק אחרי אישור מפורש של מנהל (Fitness.approve) והגדרת סוג ביצוע מתח. ראו uncertain.',
 'uncertain': UNCERTAIN, 'tables': TABLES}

def gs():
    head = ('/**\n * FITNESS_DRAFT — v1.0.3 transcription of the two scoring-table images supplied by the user (boys / girls). Generated by scoring/transcribe_v103.py — do not edit by hand.\n'
            ' * NOT approved, NOT used by any calculation until an admin imports it as a DRAFT version, verifies it against the source and approves it (Fitness.importDraft -> Fitness.approve).\n'
            ' * rows: [score, from, to] — time tables in whole seconds (null = open end), reps tables as [score, reps_min, reps_max]. gender is explicit per table (M = boys image, F = girls image).\n */\n')
    return head + 'const FITNESS_DRAFT = ' + json.dumps(DRAFT, ensure_ascii=False) + ';\n'
open(os.path.join(ROOT, 'src', 'FitnessDraft.gs'), 'w', encoding='utf-8').write(gs())
json.dump(DRAFT, open(os.path.join(ROOT, 'scoring', 'fitness_scoring_v103.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
def fmt(sc):
    return '' if sc is None else '%d:%02d' % (sc // 60, sc % 60)
with open(os.path.join(ROOT, 'scoring', 'fitness_scoring_v103.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f); w.writerow(['table_id', 'gender', 'component', 'variant', 'score', 'from', 'to', 'kind', 'status'])
    for t in TABLES:
        for r in t['rows']:
            a, b = (fmt(r[1]), fmt(r[2])) if t['kind'] == 'time' else (r[1], r[2])
            w.writerow([t['id'], t['gender'], t['component'], t['variant'], r[0], a, b, t['kind'], 'EXCLUDED_HISTORICAL' if t.get('excluded') else ''])
LAB = {'run3km': 'ריצת 3 ק״מ', 'run150x2': 'ריצת הלוך־חזור 300 מ׳ (2×150)', 'trap_bar': 'Trap Bar (הרמה מהרצפה)', 'parallel_bars': 'מקבילים', 'pullups': 'מתח'}
md = ['# תמלול טבלאות הניקוד — כש״ג (v1.0.3)', '', 'מקור הסמכות: שתי התמונות שצירף המשתמש. אין אינטרפולציה, אין השלמת טווחים, אין איחוד בין הטבלאות. סטטוס: **טיוטה — ממתינה לאישור המשתמש** (ראו רשימת הערכים הלא-ודאיים בסוף).', '',
      '**משקלים:** מתח 20% · מקבילים 20% · Trap Bar 20% · ריצת 300 מ׳ 10% · ריצת 3 ק״מ 30% (סה״כ 100%).', '**משקל עבודה ב-Trap Bar:** בנים 80 ק״ג · בנות 40 ק״ג (חזרות מלאות; הציון לפי חזרות בלבד).', '']
for t in TABLES:
    g = 'בנים' if t['gender'] == 'M' else 'בנות'
    md += ['## %s — %s%s' % (LAB[t['component']], g, (' — ' + t['variant']) if t['variant'] else '') + (' — היסטורי בלבד, לא בשימוש' if t.get('excluded') else ''), '', ('> ' + t['excluded'] if t.get('excluded') else (('> ' + t['meta']['professional_decision']) if (t.get('meta') or {}).get('professional_decision') else '')), '', '| ציון | ' + ('זמן (mm:ss)' if t['kind'] == 'time' else 'חזרות') + ' |', '|---|---|']
    for r in t['rows']:
        if t['kind'] == 'time':
            v = ('≤ ' + fmt(r[2])) if r[1] is None else (fmt(r[1]) + '+' if r[2] is None else (fmt(r[1]) if r[1] == r[2] else fmt(r[1]) + '–' + fmt(r[2])))
        else: v = str(r[1]) if r[1] == r[2] else '%d–%d' % (r[1], r[2])
        md.append('| %d | %s |' % (r[0], v))
    md.append('')
md += ['## ערכים שלא נקראו בוודאות / דורשים אישור', '']
LBL = {'OPEN': 'פתוח — נדרשת הכרעה', 'CONFIRM': 'ממתין לאישור סופי', 'CLOSED': 'סגור'}
for u in UNCERTAIN: md.append('- **%s — %s.** [**%s**: %s] %s _נדרש:_ %s' % (u['id'], u['topic'], LBL[u['status']], u['status_note'], u['detail'], u['needed']))
os.makedirs(os.path.join(ROOT, 'docs'), exist_ok=True)
open(os.path.join(ROOT, 'docs', 'FITNESS_SCORING_TRANSCRIPTION_v1.0.3.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
print('OK tables=%d rows=%d' % (len(TABLES), sum(len(t['rows']) for t in TABLES)))
