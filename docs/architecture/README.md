# Enterprise AI Enablement OS Architecture

This folder contains an editable Draw.io architecture map generated from the current application structure.

## Files

- `enterprise-ai-enablement-os-architecture.drawio` - native diagrams.net/Draw.io file with two pages:
  - `System Architecture` maps the product shell, API layer, domain intelligence, persistence, proof/audit layer, and external systems.
  - `Runtime + Proof Flows` maps the key operating loops: work demand to governed skill, assistant action loop, runtime import, connector execution, and scheduled reporting.
- `../../scripts/generate-enterprise-os-architecture-drawio.mjs` - generator script that emits the Draw.io XML.

## Regenerate

```bash
node scripts/generate-enterprise-os-architecture-drawio.mjs
```

Open the `.drawio` file in diagrams.net, the Draw.io desktop app, or the cloned Draw.io repo at `/Users/chrisdimarco/jarvis/projects/drawio`.
