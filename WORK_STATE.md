# Work state

Last updated 2026-11-05. Branch `audit/p0-remediation`, based on `main` at `3453021`. Nothing is deployed.

## Resume here

1. Confirm branch and SHA, then run `npm run typecheck`, `npm test` and `npm run build`.
2. Read `REQUIREMENTS_STATUS.md` for gaps and `DECISIONS.md` before changing direction.
3. Old pages are not a baseline. Design follows Flacron Intel, scope follows the spec.

## Next tasks, in order

1. Build spoiler mode (WATCH-04), then add it back to marketing and the Free plan list.
2. Profile settings: language, time zone, notifications, privacy, account deletion.
3. Connect favorites to the account with server-side limits.
4. Interactive role-based tour with Replay App Tour (UX-07).
5. Upgrade and downgrade, rate limits, audit log, MFA enrolment, service worker, hreflang.
6. Own-domain verification email through SES.
7. Grounded publishing, consent-based newsletter, alerts.
8. Add a repeatable browser test suite to the repo.
9. With AWS access: live baseline, then Amplify, ECS, DNS, SES and OIDC CI/CD.
10. With a Stripe restricted key: create the catalog, run the sandbox matrix.

## Owner actions

See the blockers list in the latest handoff report. The urgent one is rotating the exposed RapidAPI and API-Sports keys.

## Release gate

Before merging to `main`: confirm whether Render auto-deploys it, and migrate any existing premium users. Old subscribers have no `billing_entitlements` record and would fall to Free.
