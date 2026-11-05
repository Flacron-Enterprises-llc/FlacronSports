# FlacronSport

Multi-sport scores, authorized viewing options and match coverage. A product of Flacron Enterprises LLC. App ID: `flacron-sport`.

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## Verify

```bash
npm run typecheck
npm test
npm run build
```

## Project status

Status is tracked with evidence, not in this file: `WORK_STATE.md`, `REQUIREMENTS_STATUS.md`, `AUDIT_EVIDENCE.md`, `DECISIONS.md`.

## Structure

- `app/[locale]` pages. English has no prefix, French lives under `/fr`.
- `app/api` server routes. Identity comes only from verified Firebase tokens.
- `lib/billing` plan matrix, entitlements and Stripe webhook logic.
- `lib/sports` shared event schema and provider adapter.
- `lib/video` viewing-rights decision.
- `lib/legal` published policy text.
- `tests` unit tests. Fixtures there are synthetic and never ship.
