# Work state

Last updated 2026-11-05. Deployment branch `main`. Live site: https://flacronsport.com
Backend: https://43sqn0qz7a.execute-api.us-east-1.amazonaws.com (account 482881544977, us-east-1, stack `flacron-sport`).

## Resume here

1. Confirm `main` and `/api/health` report the same SHA, then run `npm run typecheck`, `npm test`, `npm run build`.
2. Read `REQUIREMENTS_STATUS.md` for gaps and `DECISIONS.md` before changing direction.
3. Design follows Flacron Intel, scope follows the spec. Old code is not a baseline.
4. Marketing lives in `app/[locale]/(site)`, the product in `app/[locale]/app`. Never show users internal values.

## Deploying

Push to `main`: tests, ECS image, smoke test, CodeCommit mirror, Amplify release, smoke test.
Stack updates must pass the running image as `ImageTag` and `DesiredCount=1`, or the service moves to a tag that does not exist.

## Owner actions

GitHub Support purge of PR #1, MFA upgrade decision, commercial sports feed, video license, community decisions, counsel review.

## Next tasks

1. Drive the hosted Stripe page and the signed-in UI in a browser, in both languages.
2. Run add-ons, allowance, assistant and jobs against the live stack.
3. Rescheduled-event alert correction, score-freshness alarm, restore drill, contrast audit.
4. Firestore rules deployment and a repeatable browser test suite.
