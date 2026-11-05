# Requirements status

IDs come from `REQUIREMENTS_AND_ACCEPTANCE.md`. Evidence is in `AUDIT_EVIDENCE.md`.
Built means code and unit tests exist. LIVE means it was also observed on the deployed AWS stack.

| ID | Status | Note |
|---|---|---|
| GOV-01, GOV-02 | PASS | SHA, defect ledger, AWS and Firebase baseline captured |
| UX-01 | PARTIAL | Logo and theme done. Logo is a raster extract; vector needed |
| UX-02 | PARTIAL | Marketing pages rebuilt. No verified social links |
| UX-03 | PARTIAL | Account, settings, security and admin pages. No sidebar layout or usage meter on the account page |
| UX-04 | PARTIAL | Overflow, keyboard start and themes checked. No contrast audit or screen reader test |
| UX-05 | PARTIAL | EN and FR with stable URLs and hreflang. Some plan table strings inline; legal text English only |
| UX-06 | PARTIAL | Manifest, icons, service worker, offline page built. Install and offline not tested in a browser |
| UX-07 | PARTIAL | Role-aware anchored tour with replay built. Not exercised in a signed-in browser |
| UX-08 | PARTIAL | No user-facing "AI". Assistant is labelled Assistant because it uses no model |
| SPORT-01 | PARTIAL | 7 team sports enabled on the limited feed. Tennis, cricket, combat and motorsport off: they need their own schema and feed |
| SPORT-02 | PARTIAL | Filters and truthful states. Limited feed |
| SPORT-03 | PARTIAL | Overview only. Live updates, statistics and participants need a commercial feed |
| SPORT-04 | PARTIAL | Stable IDs, UTC, dedupe. No cross-provider mapping or event sequence |
| SPORT-05 | LIVE | Account favorites and server limit observed live |
| SPORT-06 | PARTIAL | Start and final alerts, quiet hours, mute, spoiler. Rescheduled-event correction missing |
| SPORT-07 | PARTIAL | Team pages, standings (partial on test key), fixture filter. No global search or African discovery |
| WATCH-01 to WATCH-03 | BLOCKED | Decision logic tested. Needs a licensed video provider |
| WATCH-04 | PARTIAL | Spoiler mode masks scores and alerts. Not tested with signed-in browser |
| AUTH-01 | PARTIAL | Live sign-up and token verification pass. Own-domain email waits on SES DNS |
| AUTH-02 | PARTIAL | Admin API requires second factor. TOTP UI built; MFA is disabled on the Firebase project |
| AUTH-03 | PARTIAL | Checkout live. Full browser funnel with a real inbox not tested |
| AUTH-04 | LIVE | Preferences and deletion observed live; export built |
| BILL-01 | LIVE | Prices in Stripe sandbox match the matrix |
| BILL-02 | PARTIAL | Favorites live; allowances built, not run live |
| BILL-03 | LIVE | Checkout session and subscription through webhook. Hosted card page not driven in a browser |
| BILL-04 | LIVE | Cancel, undo, upgrade, portal session. Downgrade and failed renewal not run |
| BILL-05 | LIVE | Own price IDs, app metadata, separate webhook |
| BILL-06 | PARTIAL | Ledger and billing health built. Multi-app reporting matrix not run |
| BILL-07 | LIVE | Forged webhook rejected live; replay covered by unit test |
| BILL-08 | LIVE | Test mode only, notice shown, live keys refused |
| BILL-09, BILL-10 | PARTIAL | Add-ons, allowances and PDF built. Not run against live Stripe and Firestore |
| CONTENT-01 | PARTIAL | Grounded templates, statuses, corrections. Not observed live |
| CONTENT-02 | BLOCKED | Built; SES domain needs DNS at Hostinger |
| CONTENT-03 | PARTIAL | Sitemap, robots, canonical and hreflang. Reports not in sitemap |
| COMM-01 to COMM-03 | PARTIAL | Built behind `COMMUNITY_ENABLED`, off. Reactions and polls not built |
| COMM-04 | PARTIAL | Deterministic grounded assistant with quotas. Not run live |
| ADMIN-01 | PARTIAL | Operations, moderation and billing tabs. Coverage controls missing |
| ADMIN-02 | PARTIAL | RBAC, CSP, rate limits, audit log. Firestore rules not deployed; no restore drill |
| CLOUD-01 | LIVE | Amplify and ECS running, secrets in Secrets Manager, $30 budget alarm |
| CLOUD-02 | BLOCKED | Domain still points to Render. Needs Hostinger DNS |
| CLOUD-03 | LIVE | GitHub push deploys with OIDC, SHA smoke test, circuit breaker rollback observed |
| CLOUD-04 | PARTIAL | 5xx and CPU alarms. No score-freshness or webhook alarm |
| QA-01, QA-02 | PARTIAL | Chrome only. No Safari or devices; no load test |

## Legal publication checklist (owner's PDF, section 7)

| Item | Status |
|---|---|
| Separate policy links in footer | PASS. At checkout: Terms and Refunds only on signup, Stripe page not configured |
| Broadcast statement near pricing and Watch | PASS |
| Renewal, annual total, cancellation and taxes before checkout | PARTIAL, add-on expiry pending add-ons |
| Consent mechanism | PASS. No optional technology is loaded yet |
| Account controls for privacy and unsubscribe | FAIL |
| Commercial rights for feeds, images and logos | BLOCKED, owner |
| DMCA intake, retention schedule, minors decision | FAIL, owner input needed |
| Counsel review | Open, owner. The PDF asks for this before public launch |
