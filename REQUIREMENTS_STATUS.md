# Requirements status

IDs come from `REQUIREMENTS_AND_ACCEPTANCE.md`. Evidence is in `AUDIT_EVIDENCE.md`.

| ID | Status | Note |
|---|---|---|
| GOV-01, GOV-02 | PARTIAL | SHA and defect ledger done. Live cloud baseline blocked |
| UX-01 | PARTIAL | Logo and theme done. Logo is a raster extract; vector needed |
| UX-02 | PARTIAL | Marketing pages rebuilt. No verified social links |
| UX-03 | FAIL | Simple account page only, no grouped dashboard or allowance display |
| UX-04 | PARTIAL | Themes, focus, reduced motion and overflow checked. No contrast or screen reader audit |
| UX-05 | PARTIAL | EN and FR UI, stable URLs. Plan table has inline strings; legal text is English only; no hreflang yet |
| UX-06 | PARTIAL | Manifest and icons. No service worker or offline fallback |
| UX-07 | FAIL | Interactive tour not built |
| UX-08 | PARTIAL | No user-facing "AI" in the dictionary. Assistant not built |
| SPORT-01 | PARTIAL | All 11 defined, 2 enabled on a limited feed. Commercial feed needed |
| SPORT-02 | PARTIAL | Tabs, date, sport and text filters. No freshness per event |
| SPORT-03 | PARTIAL | Overview only. No live updates, statistics or participants tabs |
| SPORT-04 | PARTIAL | Stable IDs, UTC, dedupe. No provider mapping table, event versioning or sequence |
| SPORT-05 | PARTIAL | Guest favorites, limit of 5 on device. Account sync and paid unlimited not connected |
| SPORT-06 | FAIL | Alerts not built |
| SPORT-07 | PARTIAL | Filter on loaded fixtures. No global search, standings or African discovery |
| WATCH-01 | PARTIAL | Decision logic tested. No provider connected |
| WATCH-02 | PARTIAL | Honest empty state and Follow Live. No playable source |
| WATCH-03 | BLOCKED | Needs a licensed provider |
| WATCH-04 | FAIL | Spoiler mode not built, and not advertised |
| AUTH-01 | PARTIAL | Firebase flows written, untested live. Uses Firebase-hosted email, not own-domain SES links |
| AUTH-02 | PARTIAL | Admin API requires a second factor. Enrolment UI and audit log missing, so no admin can currently enter |
| AUTH-03 | PARTIAL | Plan stored through verify to checkout. Not tested end to end |
| AUTH-04 | FAIL | No profile, time zone, privacy or account deletion settings |
| BILL-01 | PASS | Matrix unit tested, and shown on pricing page |
| BILL-02 | PARTIAL | Matrix defined. Only favorites limit applied, and only in the browser |
| BILL-03 | PARTIAL | Checkout written with metadata. Stripe catalog not created, untested |
| BILL-04 | PARTIAL | Cancel, undo, portal. Upgrade and downgrade missing, untested |
| BILL-05 | PARTIAL | Isolation unit tested. Restricted key and webhook endpoint not created |
| BILL-06 | PARTIAL | Payment and refund ledger with `application_id`. No reconciliation or reporting |
| BILL-07 | PARTIAL | Logic unit tested with an in-memory store. Firestore transaction not run live |
| BILL-08 | PARTIAL | Live key and live event refusal, test notice shown |
| BILL-09, BILL-10 | FAIL | Add-ons and atomic allowances not built, and not sold |
| CONTENT-01, CONTENT-02 | FAIL | Removed as non-compliant, to rebuild grounded. SES sender written, unsent |
| CONTENT-03 | PARTIAL | Sitemap and robots. No canonical or hreflang tags |
| COMM-01 to COMM-04 | NOT_TESTED | Not built. Marked coming soon on pricing |
| ADMIN-01 | FAIL | No operations tools |
| ADMIN-02 | PARTIAL | RBAC check, CSP, deny-all Firestore rules written. Rules not deployed; no rate limits, backups or audit log |
| CLOUD-01 to CLOUD-04 | BLOCKED | AWS login expired |
| QA-01, QA-02 | PARTIAL | Chrome only. Provider failure paths coded, not fault-tested |

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
