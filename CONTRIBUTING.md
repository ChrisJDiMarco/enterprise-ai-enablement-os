# Contributing

Enterprise AI Enablement OS is open source because enterprise AI needs shared operating patterns: governance, proof, rollout, adoption, and measurable value.

## How To Contribute

1. Open an issue for product ideas, bugs, research-backed improvements, or implementation gaps.
2. Fork the repository and create a focused branch.
3. Keep changes aligned with the product mission: help organizations take AI from scattered experiments to governed, measurable capability.
4. Add or update tests when changing behavior.
5. Run the local verification commands before opening a pull request.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For broader local validation:

```bash
npm run verify
```

## Product Principles

- Governed AI should be usable by non-specialists and credible to professional developers, security teams, legal teams, and executives.
- Every meaningful AI initiative should connect work demand, ownership, controls, evidence, adoption, and ROI.
- Interfaces should reduce operating noise. Prefer clear workflows, visible next actions, and audit-ready proof over generic dashboards.
- AI assistant behavior should be explainable, action-oriented, bounded by permissions, and reviewable.
- Connector work should avoid storing raw secrets in client state and should support enterprise deployment patterns.

## Pull Request Expectations

Good pull requests include:

- a concise explanation of what changed and why
- screenshots or notes for user-facing UI changes
- tests or a clear reason tests were not practical
- notes about data, security, migration, or deployment impact

## Commercial And Hosted Work

The open-source project should remain useful on its own. Hosted, managed, or enterprise extensions may add operational convenience, scale, support, compliance operations, managed connectors, and deployment services. See [docs/open-core.md](docs/open-core.md) for the intended model.
