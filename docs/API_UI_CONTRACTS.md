# API ↔ UI contracts touched in uxqa1
| Endpoint | UI reads | Notes |
|---|---|---|
| `attendance.events` | `id, event_date, type_name, scope_type, scope_id, present, absent, early_exits, total` | `absent = total − present`, all counted over soldiers the caller may see (commander) |
| `attendance.roll` | `soldier_name, present, early_exit, notes` | read-only detail, already scope-filtered |
| `attendance.create` | request `{request_id, event_date, activity_type_id, scope_type, scope_id, absent[{soldier_id}], early_exit[ids]}` → `{event, duplicate, records}` | same `request_id` is reused for a retry (idempotent); success text built from the server's `records` |
| `emergency.get / emergency.set` | `{present,name,relation,phone,phone_display}` / `{name,relation,phone}` | admin only (private.read / private.write) |
| `forms.open` (FormPage) | `fields`, `emergency_fields` (names only, never values) | submit flat payload; contact stays pending until `forms.review` |
| `analytics.insights` | `items[{id,title,text,n,window,source,formula,generated_at,caveat,reason,question}], suppressed[], notice, generated_at` | dashboard.view, own scope |
| `reports.preview` | `{title,data,html,pages}`; `reports.generate` `format:'pdf'` = analytic by default, `spec.layout:'tabular'` for the tabular PDF (admin) | preview html = the html converted to PDF |


## Final pass (owner decisions)
`dash.overview` / `dash.compareCourses` / `dash.home` cards / `analytics.insights` / `reports.preview` return `{suppressed|small_group:true, reason}` (no counts) for scopes under 5 soldiers. `dash.groups` rows below 5 are replaced by one anonymous suppressed row; with exactly one hidden group the smallest visible group is hidden too. `reports.generate` pdf = analytic unless `spec.layout==='tabular'`; `spec.include_inactive` (boolean, admin only) adds history of inactive soldiers.
