# Audit evidence

Baseline: `main` at `3453021f22a9de3b42e5eb807dd320a623697f7d`, captured 2026-11-05.
Status terms: PASS, PARTIAL, FAIL, BLOCKED, NOT_TESTED. PASS means observed, not assumed.

## Access

| Item | Result |
|---|---|
| GitHub | `umerali06`, ADMIN, repo is PUBLIC |
| AWS | BLOCKED. All four SSO profiles expired, including `flacron-cloudadmin` |
| Stripe CLI | Profiles found, including `flacron enterprises llc`. Default profile is Being Tchitaka, so it must not be used here. No Stripe call was made |
| Firebase CLI | Signed in as `umerali7454@gmail.com`. Project access NOT_TESTED |
| Reference repos | Flacron-intel and EnergyVerse exist. Flacron-intel read only. EnergyVerse not opened |

## Baseline defects (all at `3453021`)

| ID | Sev | Finding | Source | Status now |
|---|---|---|---|---|
| B-01 | P0 | Webhook verified the signature, then only logged. No entitlement, no dedupe, no app check | `app/api/webhooks/stripe/route.ts` | Fixed, unit tested |
| B-02 | P0 | `/api/is-premium` trusted a body `userId`; one successful payment meant premium forever | `app/api/is-premium/route.ts` | Removed |
| B-03 | P0 | Create and cancel subscription took a body `userId`, so anyone could cancel another user's plan. `userId` was also placed in a Stripe search query | `app/api/*-subscription` | Removed |
| B-04 | P0 | Cron, automation, publish, generate and newsletter routes had no auth | `app/api/**` | Removed |
| B-05 | P0 | Dashboard settings were readable and writable by anyone who knew an email address | `pages/api/*-dashboard-settings.ts` | Fixed, 401 observed |
| B-06 | P0 | `/admin` had no auth and showed invented users, revenue and newsletter stats | `app/admin/page.tsx` | Replaced |
| B-07 | P0 | `/api/football-free` returned invented scores marked LIVE | `app/api/football-free/route.ts` | Removed |
| B-08 | P0 | RapidAPI key hardcoded in a public repo and sent over plain HTTP. Widget key in `public/widgets.html` and `test.html` | `app/api/matches/today/route.ts` | Removed from HEAD. **Remains in git history, must be rotated** |
| B-09 | P0 | "Live match streaming" sold in the upgrade dialog with no video provider | `components/blog/TranslateButton.tsx` | Removed |
| B-10 | P0 | `next@15.2.4` critical advisories | `package.json` | Upgraded to 15.5.29 |
| B-11 | P1 | Price shown as $19.99/month against spec $6.99 and $12.99 | `components/UpgradeButton.tsx` | Fixed by central plan matrix |
| B-12 | P1 | TheSportsDB key `3` is permanently disabled, so old score code was dead | Provider response 2026-11-05 | Replaced |
| B-13 | P1 | 18 TypeScript errors hidden by `ignoreBuildErrors` | `next.config.mjs` | 0 errors, flag removed |
| B-14 | P1 | No email verification, MFA, i18n, service worker, tests, CI, Firestore rules or IaC | Source search | See `REQUIREMENTS_STATUS.md` |
| B-15 | P1 | `GOOGLE_AI_API_KEY` exposed through Next `env` config | `next.config.mjs` | Removed |
| B-16 | P1 | Site hosted on Render (`flacronsports-odnc.onrender.com`), not AWS | DNS | Open, blocked by AWS access |
| B-17 | P2 | SPF authorises Hostinger only, DMARC is `p=none`, no `api.` record | DNS | Open |

## Verification on branch `audit/p0-remediation`

Local production build (`next start`), no provider credentials configured.

| Check | Result |
|---|---|
| `tsc --noEmit` | PASS, exit 0 |
| `npm audit --omit=dev` | 0 critical, 6 high, 8 moderate. Remaining fixes need breaking upgrades (firebase, zod, next 16) |
| Unit tests | PASS, 66 of 66 |
| `next build` with type checking on | PASS |
| 20 EN routes and 4 FR routes | PASS, 200 |
| `/nope`, `/fr/nope`, unknown match | PASS, 404 after fixing a soft 404 |
| `/en/scores` to `/scores`, `/blog` to `/news` | PASS, 308 |
| 8 protected API routes without a token | PASS, 401 |
| Forged bearer token | Fail-closed 503, because Firebase Admin is not configured locally. Rejection by real verification is covered only by a mocked unit test |
| Webhook without configured secret | Fail-closed 503 |
| `/api/matches?sport=basketball` | PASS, 3 real events, all basketball, `limited: true` |
| Viewing options | PASS, Follow Live with `no_licensed_source` |
| Security headers | PASS, CSP, HSTS, nosniff present, `X-Powered-By` removed |
| Horizontal overflow at 320, 390, 768, 1440px across 16 pages | PASS, none (Chrome device emulation) |
| Consent bar | PASS. Spans 0 to 1265 of 1265px, fixed to bottom, `blur(14px)`. Reject persists across reload. Footer reopens preferences |
| Favorites | PASS, stops at 5 with notice, listed on My Teams |
| Plan kept through signup page | PASS for the stored value only, `premium/annual` |
| Theme toggle and persistence, `lang="fr"` | PASS |
| Browser console errors | PASS, 0 |

## Not tested

Real Firebase sign-up, email verification and MFA. Real Stripe sandbox checkout, webhook delivery and cancel flow. Firestore transaction behaviour against a real database. SES sending. Screen readers, Safari, iOS and Android devices. Any AWS, deployment or production check. The live site itself: this network resets connections to both `flacronsport.com` and `render.com`, so its status is unknown.

The browser checks were run from a throwaway script and are not yet a repeatable test in this repo.
