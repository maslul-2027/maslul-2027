# -*- coding: utf-8 -*-
"""
Builds the DRAFT fitness-scoring transcription (JSON / CSV / XLSX) from the 8 source screenshots
and validates it (contiguity, monotonicity). Nothing here is approved: every table is status=DRAFT.
Gender labels are NOT printed on the screenshots; sheet A/B is the printed-page grouping only.
"""
import json, csv
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment


def T(s):  # "mm:ss" -> seconds
    m, sec = s.split(":")
    return int(m) * 60 + int(sec)


def runs(spec):  # (score, from, to); None = open end
    return [dict(score=s, from_sec=None if a is None else T(a), to_sec=None if b is None else T(b),
                 from_txt=a, to_txt=b) for s, a, b in spec]


# ---------- 3 km, doc page 31 (IMG_4807) : sheet A ----------
R3_A = runs([
    (100, None, "10:57"), (99, "10:58", "11:03"), (98, "11:04", "11:09"), (97, "11:10", "11:15"), (96, "11:16", "11:20"),
    (95, "11:21", "11:25"), (94, "11:26", "11:30"), (93, "11:31", "11:35"), (92, "11:36", "11:40"), (91, "11:41", "11:45"),
    (90, "11:46", "11:50"), (89, "11:51", "11:55"), (88, "11:56", "12:00"), (87, "12:01", "12:05"), (86, "12:06", "12:10"),
    (85, "12:11", "12:15"), (84, "12:16", "12:20"), (83, "12:21", "12:25"), (82, "12:26", "12:30"), (81, "12:31", "12:35"),
    (80, "12:36", "12:40"), (79, "12:41", "12:45"), (78, "12:46", "12:50"), (77, "12:51", "12:55"), (76, "12:56", "13:00"),
    (75, "13:01", "13:05"), (74, "13:06", "13:10"), (73, "13:11", "13:15"), (72, "13:16", "13:20"), (71, "13:21", "13:25"),
    (70, "13:26", "13:31"), (69, "13:32", "13:37"), (68, "13:38", "13:42"), (67, "13:43", "13:48"), (66, "13:49", "13:54"),
    (65, "13:55", "14:00"), (64, "14:01", "14:05"), (63, "14:06", "14:11"), (62, "14:12", "14:17"), (61, "14:18", "14:23"),
    (60, "14:24", "14:29"), (59, "14:30", "14:39"), (58, "14:40", "14:49"), (57, "14:50", "14:59"), (56, "15:00", "15:09"),
    (55, "15:10", "15:20"), (54, "15:21", "15:26"), (53, "15:27", "15:32"), (52, "15:33", "15:39"), (51, "15:40", "15:45"),
    (50, "15:46", "15:52"), (49, "15:53", "15:59"), (48, "16:00", "16:05"), (47, "16:06", "16:11"), (46, "16:12", "16:18"),
    (45, "16:19", "16:24"), (44, "16:25", "16:31"), (43, "16:32", "16:37"), (42, "16:38", "16:43"), (41, "16:44", "16:50"),
    (40, "16:51", None)])

# ---------- 3 km, doc page 39 (IMG_4804) : sheet B ----------
R3_B = runs([
    (100, None, "12:38"), (99, "12:39", "12:47"), (98, "12:48", "12:57"), (97, "12:58", "13:06"), (96, "13:07", "13:15"),
    (95, "13:16", "13:24"), (94, "13:25", "13:33"), (93, "13:34", "13:42"), (92, "13:43", "13:51"), (91, "13:52", "14:00"),
    (90, "14:01", "14:09"), (89, "14:10", "14:18"), (88, "14:19", "14:27"), (87, "14:28", "14:37"), (86, "14:38", "14:46"),
    (85, "14:47", "14:55"), (84, "14:56", "15:04"), (83, "15:05", "15:13"), (82, "15:14", "15:22"), (81, "15:23", "15:31"),
    (80, "15:32", "15:40"), (79, "15:41", "15:49"), (78, "15:50", "15:58"), (77, "15:59", "16:08"), (76, "16:09", "16:17"),
    (75, "16:18", "16:26"), (74, "16:27", "16:35"), (73, "16:36", "16:44"), (72, "16:45", "16:53"), (71, "16:54", "17:02"),
    (70, "17:03", "17:11"), (69, "17:12", "17:20"), (68, "17:21", "17:29"), (67, "17:30", "17:39"), (66, "17:40", "17:48"),
    (65, "17:49", "17:57"), (64, "17:58", "18:06"), (63, "18:07", "18:15"), (62, "18:16", "18:24"), (61, "18:25", "18:33"),
    (60, "18:34", "18:42"), (59, "18:43", "18:51"), (58, "18:52", "19:00"), (57, "19:01", "19:09"), (56, "19:10", "19:19"),
    (55, "19:20", "19:28"), (54, "19:29", "19:37"), (53, "19:38", "19:46"), (52, "19:47", "19:55"), (51, "19:56", "20:04"),
    (50, "20:05", "20:13"), (49, "20:14", "20:22"), (48, "20:23", "20:31"), (47, "20:32", "20:40"), (46, "20:41", "20:50"),
    (45, "20:51", "20:59"), (44, "21:00", "21:08"), (43, "21:09", "21:17"), (42, "21:18", "21:26"), (41, "21:27", "21:35"),
    (40, "21:36", None)])

# ---------- 150x2, doc page 32 (IMG_4806) : sheet A ----------
R150_A = runs([(100, None, "00:43"), (95, "00:44", "00:44"), (90, "00:45", "00:46"), (85, "00:47", "00:48"),
               (80, "00:49", "00:50"), (75, "00:51", "00:53"), (70, "00:54", "00:56"), (65, "00:57", "00:59"),
               (60, "01:00", "01:01"), (55, "01:02", "01:04"), (50, "01:05", "01:07"), (45, "01:08", "01:10"),
               (40, "01:11", None)])

# ---------- 150x2, doc page 40 (IMG_4805) : sheet B ----------
R150_B = runs([(100, None, "00:50"), (95, "00:51", "00:52"), (90, "00:53", "00:54"), (85, "00:55", "00:56"),
               (80, "00:57", "00:59"), (75, "01:00", "01:02"), (70, "01:03", "01:04"), (65, "01:05", "01:06"),
               (60, "01:07", "01:09"), (55, "01:10", "01:12"), (50, "01:13", "01:14"), (45, "01:15", "01:16"),
               (40, "01:17", None)])


def reps(spec):
    return [dict(score=s, reps_min=a, reps_max=b) for s, a, b in spec]


PU_A_NOWEIGHT = reps([(100, 20, 20), (95, 19, 19), (90, 18, 18), (85, 17, 17), (80, 15, 16), (75, 13, 14), (70, 11, 12),
                      (65, 9, 10), (60, 7, 8), (55, 5, 6), (50, 3, 4), (45, 2, 2), (40, 1, 1)])   # IMG_4808 right
PU_A_VEST = reps([(100, 15, 15), (95, 14, 14), (90, 13, 13), (85, 12, 12), (80, 11, 11), (75, 10, 10), (70, 9, 9),
                  (65, 8, 8), (60, 7, 7), (55, 5, 6), (50, 3, 4), (45, 2, 2), (40, 1, 1)])         # IMG_4808 left
PU_B_RUBBER = reps([(100, 20, 20), (95, 19, 19), (90, 17, 18), (85, 14, 16), (80, 11, 13), (75, 9, 10), (70, 7, 8),
                    (65, 5, 6), (60, 4, 4), (55, 3, 3), (50, 2, 2), (45, 1, 1), (40, 1, 1)])       # IMG_4803; last two rows both "1"

TABLES = [
    dict(id="run3km_A", component="ריצת 3 ק״מ", unit="mm:ss", sheet="A", doc_page=31, image="IMG_4807(1).jpeg", rows=R3_A, kind="time"),
    dict(id="run3km_B", component="ריצת 3 ק״מ", unit="mm:ss", sheet="B", doc_page=39, image="IMG_4804(1).jpeg", rows=R3_B, kind="time"),
    dict(id="run150x2_A", component="ריצת 150×2", unit="mm:ss", sheet="A", doc_page=32, image="IMG_4806(1).jpeg", rows=R150_A, kind="time"),
    dict(id="run150x2_B", component="ריצת 150×2", unit="mm:ss", sheet="B", doc_page=40, image="IMG_4805(1).png", rows=R150_B, kind="time"),
    dict(id="pullups_A_noweight", component="מתח", variant="ללא משקל חיצוני", unit="reps", sheet="A", doc_page=28, image="IMG_4808(1).jpeg", rows=PU_A_NOWEIGHT, kind="reps"),
    dict(id="pullups_A_vest", component="מתח", variant="עם אפוד אישי", unit="reps", sheet="A", doc_page=28, image="IMG_4808(1).jpeg", rows=PU_A_VEST, kind="reps"),
    dict(id="pullups_B_rubberband", component="מתח", variant="בסיוע ממתח גומי", unit="reps", sheet="B", doc_page=36, image="IMG_4803(1).jpeg", rows=PU_B_RUBBER, kind="reps"),
]


def validate(t):
    issues = []
    rows = t["rows"]
    scores = [r["score"] for r in rows]
    if scores != sorted(scores, reverse=True):
        issues.append("scores not descending")
    if len(set(scores)) != len(scores):
        issues.append("duplicate score rows: " + str(sorted({s for s in scores if scores.count(s) > 1})))
    if t["kind"] == "time":
        for i, r in enumerate(rows):
            if i == 0 and r["from_sec"] is not None:
                issues.append("first row must be open-ended below")
            if i == len(rows) - 1 and r["to_sec"] is not None:
                issues.append("last row must be open-ended above")
            if r["from_sec"] is not None and r["to_sec"] is not None and r["from_sec"] > r["to_sec"]:
                issues.append("score %s: from>to" % r["score"])
            if i > 0:
                p = rows[i - 1]
                if p["to_sec"] is None or r["from_sec"] is None or r["from_sec"] != p["to_sec"] + 1:
                    issues.append("gap/overlap between score %s and %s" % (p["score"], r["score"]))
    else:
        for i, r in enumerate(rows):
            if r["reps_min"] > r["reps_max"]:
                issues.append("score %s: min>max" % r["score"])
            if i > 0 and rows[i - 1]["reps_min"] != r["reps_max"] + 1:
                issues.append("gap/overlap between score %s (min %s) and %s (max %s)" % (
                    rows[i - 1]["score"], rows[i - 1]["reps_min"], r["score"], r["reps_max"]))
    return issues


report = {t["id"]: validate(t) for t in TABLES}

# weights & external conditions exactly as printed (IMG_4801 = doc p.27, IMG_4802 = doc p.35)
CONDITIONS = [
    ("A", "opening", "מתח", 20, "ללא", 27, "IMG_4801(1).jpeg"),
    ("A", "opening", "מקבילים", 20, "ללא", 27, "IMG_4801(1).jpeg"),
    ("A", "opening", "TRAP BAR", 20, "מוט בלבד (20 ק״ג)", 27, "IMG_4801(1).jpeg"),
    ("A", "opening", "ריצת 3 ק״מ", 40, "ללא", 27, "IMG_4801(1).jpeg"),
    ("A", "regular", "מתח", 20, "אפוד לוחם, 7 ק״ג", 27, "IMG_4801(1).jpeg"),
    ("A", "regular", "מקבילים", 20, "ללא", 27, "IMG_4801(1).jpeg"),
    ("A", "regular", "TRAP BAR", 20, "60 ק״ג (מוט + 20 ק״ג בכל צד)", 27, "IMG_4801(1).jpeg"),
    ("A", "regular", "ריצת 150×2", 10, "ללא", 27, "IMG_4801(1).jpeg"),
    ("A", "regular", "ריצת 3 ק״מ", 30, "ללא", 27, "IMG_4801(1).jpeg"),
    ("B", "opening", "מתח (בסיוע ממתח גומי)", 20, "ללא", 35, "IMG_4802(1).jpeg"),
    ("B", "opening", "מקבילים", 20, "ללא", 35, "IMG_4802(1).jpeg"),
    ("B", "opening", "TRAP BAR", 20, "מוט בלבד (20 ק״ג)", 35, "IMG_4802(1).jpeg"),
    ("B", "opening", "ריצת 3 ק״מ", 40, "ללא", 35, "IMG_4802(1).jpeg"),
    ("B", "regular", "מתח (בסיוע ממתח גומי)", 20, "ללא", 35, "IMG_4802(1).jpeg"),
    ("B", "regular", "מקבילים", 20, "ללא", 35, "IMG_4802(1).jpeg"),
    ("B", "regular", "TRAP BAR", 20, "40 ק״ג (מוט + 10 ק״ג בכל צד)", 35, "IMG_4802(1).jpeg"),
    ("B", "regular", "ריצת 150×2", 10, "ללא", 35, "IMG_4802(1).jpeg"),
    ("B", "regular", "ריצת 3 ק״מ", 30, "ללא", 35, "IMG_4802(1).jpeg"),
]

UNCERTAIN = [
    ("U1", "מגדר הטבלאות", "שני סטים של טבלאות (גיליון A: עמ׳ 27–32, גיליון B: עמ׳ 35–40). אף צילום אינו נושא כותרת מגדר. השערה (לא מאומתת): A=גברים, B=נשים — על סמך מתח בסיוע גומי, משקל Trap Bar נמוך וזמני ריצה איטיים יותר בגיליון B.", "נדרש אישור המשתמש לפני שיוך מגדר."),
    ("U2", "מתח — גיליון A: שתי טבלאות", "בעמ׳ 28 מופיעות שתי טבלאות מתח: ״ללא משקל חיצוני״ ו״עם אפוד אישי״. עמ׳ 27 מגדיר: מבחן פתיחה — ללא משקל; מבחן רגיל — אפוד לוחם 7 ק״ג. זה עומד בסתירה להחלטה ״אין מסלול נפרד למתח עם/בלי אפוד״ אם היא נקראת כפשוטה.", "נדרשת הכרעה: בחירת טבלה אוטומטית לפי סוג מבחן (בלי בחירה ידנית של המפקד), או טבלה אחת בלבד (איזו?)."),
    ("U3", "מתח בסיוע גומי (גיליון B) — שתי השורות האחרונות", "בעמ׳ 36 שתי השורות האחרונות מציגות ״1״ בעמודת ההישג: ציון 45 וגם ציון 40. כנראה שגיאת דפוס במקור (ייתכן 1 ו-0).", "נדרש אימות מול המסמך המקורי. לא נוחש."),
    ("U4", "מקבילים — טבלאות חסרות", "אף אחד משמונת הצילומים אינו כולל טבלת ניקוד למקבילים (לא לגיליון A ולא ל-B).", "נדרש צילום/העתק של טבלת המקבילים. בלעדיו לא ניתן לחשב ציון כש״ג משוקלל."),
    ("U5", "ערכים מחוץ לטווח הטבלה", "מתח: אין שורה ל-0 חזרות ולא למספר חזרות מעל המקסימום המודפס (20 / 15). ריצות: הטווחים פתוחים בשני הקצוות ולכן מכוסים.", "נדרש אישור: 0 חזרות = איזה ציון? חזרות מעל המקסימום = 100? (אינטרפולציה לא תבוצע)."),
    ("U6", "כלל מעבר חדש במקור: סף 60 נקודות בכל רכיב", "עמ׳ 32 סעיף 6ה: כדי לעבור את הבוחן יש לעבור את כל חמשת הרכיבים בסף המועדי; ככלל הסף הוא 60 נקודות לרכיב, עם יוצאים מן הכלל (נקרא בחלקו בלבד — הטקסט נחתך בקצה הצילום). כלל זה אינו מופיע באפיון המאושר.", "לא מומש. נדרשת הכרעה אם להוסיף כלל מעבר כש״ג (ואם כן — נוסח מלא של החריגים)."),
    ("U7", "רזולוציית צילומים", "7 מתוך 8 הצילומים ברזולוציה 706×1536. הספרות נקראו בהגדלה ונבדקו בבדיקת רציפות אוטומטית (ללא פערים/חפיפות בטבלאות הזמן). טעות הקלדה שאינה שוברת רציפות לא הייתה מתגלה.", "מומלץ שהמשתמש יאמת ויזואלית את הטבלאות המתומללות (קובץ ה-XLSX) לפני אישור."),
    ("U8", "הערות ביצוע שנקראו בצילומים", "סדר רכיבים מומלץ בבוחן פתיחה: מתח, מקבילים, כוח רגליים (Trap Bar), ריצת 3 ק״מ. מנוחה: לפחות 5 דק׳ בין רכיבי הכוח לריצת 3 ק״מ, ובין 5 ל-30 דק׳ בין 3 ק״מ ל-300 מ׳. בבוחן הפתיחה מתח נמדד ללא משקל חיצוני.", "לידיעה בלבד; לא מנוהל במערכת אלא אם יוחלט אחרת."),
]


def export():
    out = {
        "status": "DRAFT_NOT_APPROVED",
        "note": "תמלול טיוטה מצילומי המקור. אין לטעון למערכת לפני אישור המשתמש. מגדר לא מאומת (U1).",
        "weights_approved_by_user": {
            "opening": {"pullups": 20, "parallel_bars": 20, "trap_bar": 20, "run3km": 40},
            "regular": {"pullups": 20, "parallel_bars": 20, "trap_bar": 20, "run150x2": 10, "run3km": 30}},
        "trap_bar_rule_approved_by_user": "10 reps = 100; each rep fewer = -10; 0 = 0",
        "tables": [dict(t) for t in TABLES],
        "validation": report,
        "uncertain": [dict(id=u[0], topic=u[1], detail=u[2], needed=u[3]) for u in UNCERTAIN],
    }
    with open("fitness_scoring_draft.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    with open("fitness_scoring_draft.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["table_id", "sheet(A/B)", "gender", "component", "variant", "doc_page", "source_image", "score",
                    "from", "to", "reps_min", "reps_max", "status"])
        for t in TABLES:
            for r in t["rows"]:
                w.writerow([t["id"], t["sheet"], "לא מאומת", t["component"], t.get("variant", ""), t["doc_page"], t["image"],
                            r["score"], r.get("from_txt") or "", r.get("to_txt") or "", r.get("reps_min", ""),
                            r.get("reps_max", ""), "DRAFT"])

    wb = Workbook()
    hdr = Font(name="Arial", bold=True, color="FFFFFF")
    fill = PatternFill("solid", fgColor="243746")
    base = Font(name="Arial", size=10)

    def sheet(ws, header, rows, widths):
        ws.sheet_view.rightToLeft = True
        ws.append(header)
        for c in ws[1]:
            c.font = hdr
            c.fill = fill
            c.alignment = Alignment(horizontal="center")
        for r in rows:
            ws.append(r)
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.font = base
        for i, wd in enumerate(widths):
            ws.column_dimensions[chr(65 + i)].width = wd
        ws.freeze_panes = "A2"

    ws = wb.active
    ws.title = "README"
    ws.sheet_view.rightToLeft = True
    for line in ["תמלול טיוטה של טבלאות ניקוד כש״ג — לא מאושר",
                 "מקור: 8 צילומי מסך (תיקיית source_images).",
                 "גיליונות A/B = חלוקת העמודים במקור (A: עמ׳ 27–32, B: עמ׳ 35–40). אין כותרת מגדר בצילומים — ראה U1.",
                 "פורמט זמן: mm:ss. הטווח 'מ' עד 'עד' כולל בשני הקצוות; שורה ראשונה פתוחה כלפי מטה, אחרונה פתוחה כלפי מעלה.",
                 "בדיקת רציפות אוטומטית: גיליון Validation. ערכים לא ודאיים: גיליון Uncertain_Values.",
                 "אין לטעון לייצור לפני אישור המשתמש."]:
        ws.append([line])
    ws.column_dimensions["A"].width = 120
    for t in TABLES:
        rows = []
        for r in t["rows"]:
            rows.append([r["score"], r.get("from_txt") or ("ומטה" if t["kind"] == "time" else ""),
                         r.get("to_txt") or ("ומעלה" if t["kind"] == "time" else ""), r.get("reps_min", ""),
                         r.get("reps_max", ""), t["doc_page"], t["image"], "DRAFT"])
        sheet(wb.create_sheet(t["id"][:31]), ["ציון", "מ", "עד", "חזרות מ", "חזרות עד", "עמוד מקור", "קובץ מקור", "סטטוס"],
              rows, [8, 10, 10, 10, 10, 11, 22, 10])
    sheet(wb.create_sheet("Conditions_Weights"), ["גיליון", "סוג מבחן", "רכיב", "משקל % (מודפס)", "משקל חיצוני (מודפס)", "עמוד", "קובץ"],
          [list(c) for c in CONDITIONS], [8, 10, 26, 14, 34, 8, 22])
    sheet(wb.create_sheet("Validation"), ["טבלה", "תוצאה", "פירוט"],
          [[k, "תקין" if not v else "בעיה", "; ".join(v)] for k, v in report.items()], [24, 10, 90])
    s = wb.create_sheet("Uncertain_Values")
    sheet(s, ["מזהה", "נושא", "פירוט", "נדרש"], [list(u) for u in UNCERTAIN], [6, 34, 110, 60])
    for row in s.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")
    wb.save("fitness_scoring_transcription.xlsx")


if __name__ == "__main__":
    export()
    bad = {k: v for k, v in report.items() if v}
    print("tables:", len(TABLES), "rows:", sum(len(t["rows"]) for t in TABLES))
    print("validation issues:", json.dumps(bad, ensure_ascii=False, indent=1) if bad else "none")
