# MASLUL 2027 — Security and publication rules

This is a public repository. Never commit live military, personnel, medical, or other sensitive records; access tokens; OAuth credentials; private keys; spreadsheet contents; or private Google Apps Script project identifiers.

The Google Apps Script TEST web app remains restricted to its authorized test account. Public source code does **not** authorize public access to the web app or its databases.

Before any code publication, review the exact source for secrets and sensitive data. Before any automated deployment, require tests, an isolated TEST target, least-privilege credentials, and a documented rollback path. Production deployments and real data require separate explicit approval.

Report suspected vulnerabilities privately to the repository owner; do not include secrets in public issues.
