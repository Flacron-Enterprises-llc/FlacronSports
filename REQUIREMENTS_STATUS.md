# Requirements status

IDs come from `REQUIREMENTS_AND_ACCEPTANCE.md`. Evidence is in `AUDIT_EVIDENCE.md`.
Built means code and unit tests exist. LIVE means it was also observed on the deployed AWS stack.

| ID | Status | Note |
|---|---|---|
| GOV-01, GOV-02 | PASS | Baseline, defect ledger and evidence |
| UX-01 | PARTIAL | Theme done. Logo is a raster extract; vector needed |
| UX-02 | PASS | Promotional marketing, checked in four browser profiles |
| UX-03 | LIVE | Dashboard shell, sidebar, plan and allowance, drawer, tabs |
| UX-04 | PARTIAL | axe WCAG AA clean, overflow and keyboard checked. No human screen reader pass |
| UX-05 | PARTIAL | EN and FR with stable URLs and hreflang. Legal text is English only; French needs a native review |
| UX-06 | PARTIAL | Manifest, service worker and offline page. Install not tested on a real device |
| UX-07 | LIVE | First-login tour, anchored, with replay |
| UX-08 | PASS | No user-facing AI wording |
| SPORT-01 | PARTIAL | 11 of 11 enabled, limited by the test feed: 3 events per query, tennis results only, cricket often without a score |
| SPORT-02 | LIVE | Filters and truthful states |
| SPORT-03 | PARTIAL | Sport-specific results. Live updates, statistics and participants need a commercial feed |
| SPORT-04 | PARTIAL | Stable IDs, UTC, dedupe. No cross-provider mapping |
| SPORT-05 | LIVE | Account favorites and server limit |
| SPORT-06 | PARTIAL | Start and final alerts, quiet hours, mute, spoiler, moved kickoffs. Other alert types need a live event feed |
| SPORT-07 | PARTIAL | Team pages, standings, filters. No global search or African discovery |
| WATCH-01, WATCH-02, WATCH-03 | BLOCKED | Decision logic tested. Needs a licensed video provider |
| WATCH-04 | LIVE | Spoiler mode observed in the browser |
| AUTH-01 | PARTIAL | Live sign-up, tokens, SES accepted through the live route. Real inbox not observed |
| AUTH-02 | PARTIAL | TOTP enabled on the project and enforced by the API. Enrolment UI not run; no admin enrolled yet |
| AUTH-03 | LIVE | Plan kept through to hosted checkout |
| AUTH-04 | LIVE | Preferences, export, deletion |
| BILL-01 to BILL-05 | LIVE | Prices, entitlements, checkout, cancel, undo, upgrade, downgrade, past due, portal, isolation |
| BILL-06 | PARTIAL | Ledger and billing health. Multi-app reporting matrix not run |
| BILL-07, BILL-08 | LIVE | Forged webhook rejected, test mode only |
| BILL-09, BILL-10 | LIVE | Add-on payment, atomic credit, PDF. Refund of a purchase not run live |
| CONTENT-01 | LIVE | Grounded reports from the scheduled job |
| CONTENT-02 | PARTIAL | SES domain verified. Newsletter not observed end to end |
| CONTENT-03 | PARTIAL | Sitemap, robots, canonical, hreflang |
| COMM-01, COMM-02, COMM-03 | LIVE | 29 of 29 checks on real Firestore with two and three users. Guidelines need counsel review |
| COMM-04 | LIVE | Grounded assistant with quotas |
| ADMIN-01 | PARTIAL | Operations, moderation and billing tabs. No coverage controls |
| ADMIN-02 | PARTIAL | RBAC, rate limits, audit log, deny-all rules, daily backups. Restore drill pending the first backup |
| CLOUD-01, CLOUD-02, CLOUD-03 | LIVE | Amplify, ECS, domain, www redirect, push to deploy, rollback |
| CLOUD-04 | LIVE | Alarms for errors, webhook, jobs, feed, budget |
| QA-01 | PARTIAL | Chrome, WebKit, iPhone and Android emulation. No real devices |
| QA-02 | PARTIAL | 25-client load test with 0 errors. No provider fault injection |

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
