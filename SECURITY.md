# Security Policy

Enterprise AI Enablement OS handles sensitive operating context: AI assets, prompts, approvals, evidence, connector configuration, and business metrics. Please report security issues privately.

## Reporting A Vulnerability

Do not open a public issue for vulnerabilities, leaked credentials, bypasses, or exploit details.

Use GitHub private vulnerability reporting if it is enabled for this repository. If that is unavailable, email the repository owner from the GitHub profile and include:

- affected version or commit
- a concise description of the issue
- reproduction steps or proof of concept
- expected impact
- any recommended mitigation

Please do not include production credentials, customer data, private prompts, or sensitive business records in the report.

## Supported Versions

The `master` branch is the active development line. Security fixes will target the latest public code unless a hosted or enterprise customer agreement states otherwise.

## Security Expectations

Contributions should preserve these rules:

- secrets stay out of source control, logs, browser state, screenshots, and model context
- connector tokens should be validated server-side and stored only in approved secret storage
- AI assistant actions should be permissioned, reviewable, and bounded by an allowlist
- governance, approval, eval, trace, and ROI records should remain auditable
- external model calls should receive compact, sanitized context rather than raw workspace dumps
- new API routes should validate input, enforce tenant boundaries, and emit safe operational telemetry

## Local Secret Hygiene

Use `.env.example` as the template and keep real values in ignored local env files such as `.env.production.local`. Before publishing changes, run:

```bash
git status --short
npm audit
npm run verify
```
