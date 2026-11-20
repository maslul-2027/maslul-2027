# Design system (light, minimal, RTL, Rafael-inspired) — implemented in src/Index.html and src/FormPage.html
Tokens: `--app-bg #F6F7F8, --surface #FFFFFF, --surface-muted #F1F3F5, --text #202428, --text-muted #667078, --border #E1E5E8, --accent #C62828, --accent-soft #FCEEEE`; legacy variable names alias to them. System font stack only (no CDN, no webfont). 
Shell: white top bar with accent marker; **right-hand sidebar** (areas) on ≥ 901px; below 900px the sidebar is a drawer (`#menuBtn`, `aria-expanded`, Escape/scrim/selection closes, closed drawer is `visibility:hidden`). Screen tabs wrap (no horizontal scroll anywhere in navigation). Buttons/inputs ≥ 44px, focus ring 3px, `prefers-reduced-motion` respected. Contrast: text #202428 on #FFFFFF ≈ 15:1; accent #C62828 on white ≈ 5.6:1 (AA); muted #667078 on #F6F7F8 ≈ 4.8:1 (AA).
Not done: per-screen re-layout (tables/forms keep their structure); automated axe/Lighthouse was NOT run (no network); contrast figures are computed, not measured by a tool.


## Final pass
Every screen starts with `header.pagehead` (title + one-line purpose). Dates: dd.mm.yyyy via `fmtDate`, timestamps dd.mm.yyyy hh:mm via `fmtStamp`; `cell()` applies both automatically to ISO strings. Suppressed scopes (<5 soldiers) show a `.notice#dashSmallGroup` and no numbers.
