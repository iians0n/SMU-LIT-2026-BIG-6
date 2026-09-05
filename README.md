# SMU-LIT-2026-BIG-6

Casepath is a source-linked preparation workspace for self-represented users exploring Singapore's small-claims process. It turns a confirmed case record into a rules-based route screening, neutral next-step options, reviewable draft fields, a CJTS preparation checklist, and a separate verification record.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`. The P0 uses a synthetic repair-work case and an in-memory session store.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The route and drafting services are deterministic. They do not call a model, predict case merits, invent missing information, or file anything with CJTS. Official procedural statements pass through the reviewed source gate before rendering.
