# Decisions

Owner direction takes priority over older code. Each entry records why.

| # | Date | Decision | Reason |
|---|---|---|---|
| D-001 | 2026-11-05 | Old pages and theme are not a baseline. The UI was rebuilt from the Flacron Intel design language and the spec. | Owner instruction. |
| D-002 | 2026-11-05 | Tokens copied in value from Flacron Intel (`packages/design-tokens/tokens.json`): navy `#002961`, orange `#FE4B01`, Sora and Inter (SIL OFL, licences in `fonts/`). Tailwind stays on v3. | Same brand family. A v4 migration adds risk without user benefit. |
| D-003 | 2026-11-05 | Logo assets are extracted from the developer PDF: full logo, FS mark, reversed mark, PWA icons. | Repo `logo.png` was black and orange text, which is not the specified logo. Vector source would be better. |
| D-004 | 2026-11-05 | The owner's "bottom full-width glassy" request is the cookie consent bar, matching the frosted strip in Flacron Intel and EnergyVerse. Legal links also sit in the footer band. | The legal checklist requires consent controls, and the reference code uses this pattern. Confirm with owner. |
| D-005 | 2026-11-05 | Legal text is published word for word in English. French pages state it is English only. | A self-made translation of legal terms could change their meaning. Needs a reviewed translation. |
| D-006 | 2026-11-05 | Email is Amazon SES only via SESv2 and the ECS task role. SendGrid, Resend and ConvertKit are removed. | Owner spec. The earlier `.env.example` wrongly listed SendGrid from old code. |
| D-007 | 2026-11-05 | The old content pipeline (blog, automation, Gemini, newsletter, image service) is removed, and old articles are hidden. Nothing was deleted from Firestore. | It was Vercel-bound and not source-grounded, used a dead data key, and could invent content. Grounded publishing is rebuilt to spec. |
| D-008 | 2026-11-05 | Firestore remains the store for billing and entitlements, pending AWS review. | Already the live store, and the handoff warns against a split-brain store. The final choice needs the live AWS and Firebase audit. |
| D-009 | 2026-11-05 | Entitlement comes only from the verified webhook. Each event re-reads the subscription from Stripe. | Replays and out-of-order events converge, and the browser cannot grant access. |
| D-010 | 2026-11-05 | Grace: 3 days after a failed renewal. A delayed renewal webhook gets 3 days of leeway, then access reverts to Free. | Spec asks for server-side cutoffs but sets no number. Owner can change this in `lib/billing/entitlements.ts`. |
| D-011 | 2026-11-05 | TheSportsDB test key `123` runs as a limited feed. All 11 sports are enabled after a real feed check, each in its own format. | The old key `3` is disabled by the provider. The test tier is a few events per query with no commercial rights confirmed. |
| D-012 | 2026-11-05 | Team badges are not shown. | Spec allows permitted badges only, and rights are unconfirmed. |
| D-013 | 2026-11-05 | Live Stripe keys and live events are refused unless `STRIPE_LIVE_MODE_APPROVED=true`. | Owner requires test mode until explicit approval. |
| D-014 | 2026-11-05 | Superseded: `main` is the deployment branch. | Owner said Render is not used and everything runs on AWS. |
| D-015 | 2026-11-05 | Git history was rewritten and force pushed to remove 8 secrets, with a local backup bundle taken first. The public Firebase web key stayed. | Owner instruction, overriding the handoff's no-force-push rule. |
| D-016 | 2026-11-05 | The exposed Firebase service-account key was replaced and disabled, not deleted. | It was public for 17 months. Disabling can be reversed if something still needs it. |
| D-017 | 2026-11-05 | API Gateway with a VPC Link instead of an ALB. | HTTPS without a custom domain and no hourly ALB charge. |
| D-018 | 2026-11-05 | Amplify builds from a CodeCommit mirror pushed by CI. | The org disables deploy keys, and Amplify manual deployments do not run SSR. Switch to a direct GitHub connection if the org allows it. |
| D-019 | 2026-11-05 | The Stripe webhook uses API version `2025-03-31.basil`. | The test account allows only three versions, and other apps' endpoints must not change. |
| D-020 | 2026-11-05 | Firestore is confirmed as the data store. | Live project already holds users and data; a new database would add cost and split the data. |
| D-021 | 2026-11-05 | Assistant and reports are deterministic, with no model. | No approved model key exists for this app, and other apps' keys must not be reused. |
| D-022 | 2026-11-05 | Community is on, with a 13+ and guidelines gate on every write. | Owner decision. Guidelines are drafted from the Terms and Privacy Policy and need counsel review, including the higher consent age in parts of the EU. |
| D-023 | 2026-11-05 | Allowances reset on the UTC calendar month. Prediction points: exact score 5, correct outcome 2. Base rooms last until kickoff plus 24 hours. | The spec sets no number. Owner can change these. |
| D-024 | 2026-11-05 | Marketing is promotional only. All product features live in a signed-in dashboard under `/app`, on a Free account with no payment. | Owner's newer UX instruction, which overrides the PDF's guest browsing. To reopen guest scores, remove the gate in `components/dashboard/app-shell.tsx` for those routes. |
| D-025 | 2026-11-05 | Users never see internal values: no vendor names, IDs, raw status codes or technical wording. Attribution reads "Verified match data". The staff-only admin panel is the exception. | Owner instruction. `tests/domain.test.ts` guards it. |
| D-026 | 2026-11-05 | Social links in the footer are the Flacron Enterprises profiles used by Flacron Intel. | Owner instruction. |
| D-027 | 2026-11-05 | Firebase Auth was upgraded to Identity Platform and TOTP enabled. Firestore has daily backups kept 14 days. | Owner approved all remaining work. The upgrade cannot be reversed. |
| D-028 | 2026-11-05 | Test billing labels are removed from the site. Stripe's own Checkout page still shows Sandbox. | Owner instruction: nothing internal on the site. Overrides the handoff's visible test label. |
| D-029 | 2026-11-05 | All sports data calls go through ECS, and Amplify reads them from the API. | One cache keeps 11 sports within the feed's rate limit. |
