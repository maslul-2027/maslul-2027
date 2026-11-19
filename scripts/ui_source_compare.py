#!/usr/bin/env python3
"""UI branch vs Apps Script source: for every API_ action -> source line (Code.gs), Index.html call sites (base commit vs working tree), enclosing screen function, tests that reference it.
Usage: python3 scripts/ui_source_compare.py <base-commit> > docs/ui-source-comparison.json   (read-only; no Google)"""
import re, sys, json, glob, subprocess
base = sys.argv[1] if len(sys.argv) > 1 else 'c9bc782'
def git(path): return subprocess.run(['git', 'show', f'{base}:{path}'], capture_output=True, text=True).stdout
code = git('src/Code.gs').split('\n'); in_api = False; routes = {}
for i, l in enumerate(code, 1):
    if l.startswith('const API_'): in_api = True; continue
    if in_api:
        if l.startswith('};'): break
        m = re.match(r"\s*'([a-zA-Z]+\.[a-zA-Z]+)'\s*:\s*(.*)$", l)
        if m: routes[m.group(1)] = {'source_line': i, 'handler': m.group(2).strip()[:90]}
def scan(text):
    out = {}; lines = text.split('\n'); fn = None
    for i, l in enumerate(lines, 1):
        m = re.search(r'function\s+([A-Za-z0-9_$]+)\s*\(', l)
        if m: fn = m.group(1)
        for r in routes:
            if re.search(r"['\"]" + re.escape(r) + r"['\"]", l): out.setdefault(r, []).append({'line': i, 'in_function': fn})
    return out
before = scan(git('src/Index.html')); after = scan(open('src/Index.html', encoding='utf-8').read())
tests = {f: open(f, encoding='utf-8', errors='ignore').read() for f in glob.glob('tests/*.js')}
cls = json.load(open('tests/route_classes.json'))
rows = []
for r, v in sorted(routes.items()):
    t = sorted(f.split('/')[-1][:-3] for f, s in tests.items() if re.search(r"['\"]" + re.escape(r) + r"['\"]", s))
    rows.append({'action': r, 'class': cls.get(r), 'source': f'src/Code.gs:{v["source_line"]}', 'handler': v['handler'],
                 'ui_calls_base': [f'src/Index.html:{c["line"]} ({c["in_function"]})' for c in before.get(r, [])], 'ui_calls_now': [f'src/Index.html:{c["line"]} ({c["in_function"]})' for c in after.get(r, [])],
                 'wired_in_ui': bool(after.get(r)), 'tests_referencing': t, 'class_authz_test': 'd7_authz' if r in cls else None})
print(json.dumps({'base': base, 'actions': len(rows), 'wired_in_ui': sum(1 for x in rows if x['wired_in_ui']), 'not_wired_in_ui': [x['action'] for x in rows if not x['wired_in_ui']], 'ui_call_sites_changed_vs_base': sum(1 for x in rows if len(x['ui_calls_base']) != len(x['ui_calls_now'])), 'rows': rows}, ensure_ascii=False, indent=1))
