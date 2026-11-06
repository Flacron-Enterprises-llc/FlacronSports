# FlacronSport QA report

Date: 7 November 2026. Scope: the spec PDF, as changed by the owner in DECISIONS.md D-034 and D-035.

## Result

The code and the automated checks pass. Launch is not cleared: the items under "Before launch" need people, outside accounts or decisions that testing cannot provide.

| Check | Result |
|---|---|
| Unit and integration tests | 835 of 835 |
| TypeScript | No errors |
| CI pipeline, including the browser and accessibility suite | Passing |
| Live site checks on production, all plans | 183 of 183 on commit 75919a3 |
| Live Basic journey, limits and upgrade to Premium | 52 of 52 on commit 75919a3 |
| Scheduled job after the final deploy | Finished, feed ok, no FlacronSport alarms, dead-letter queue empty |

## What the live checks covered

- 15 public pages in English and French, 4 on mobile: page loads, no error text, no sideways scrolling, no console errors.
- An account with no plan: 15 dashboard pages stop at the paywall; billing and settings stay open.
- Member data refused with no account (401) and with no plan (402) on 9 data routes and several member routes. Page source checked on 6 pages for leaked data.
- Real Stripe test checkouts on Basic and Premium, webhook activation, the Basic to Premium upgrade, the Basic limits, and cleanup.
- Member features through their APIs: favorites, alert filters, search, player comparison, share cards, calendar feed, saved reports, clubs, groups, referrals, assistant, predictions, rooms.
- 25 member pages on desktop, 18 on mobile, 5 in dark mode, 10 in French, and all five match tabs.
- A member is refused by the admin APIs.

## Defects found and fixed in this pass

- 18 billing and security defects from the audit, including failed renewals keeping access, upgrades granted before payment, refunds that changed nothing, and double subscriptions.
- 11 defects from the code review, including a proration refund cancelling a whole subscription, and the provider limit being exceeded across tasks.
- Member data was readable without a plan through the page source and open APIs. Now enforced on the server.
- Saving preferences failed for every plan below Premium.
- A day pass did not open the dashboard.
- Games abandoned by the feed showed as live or upcoming, and an unstarted game could show 0-0.
- The sports provider key reached the logs through a framework cache warning. Fixed; rotate the key, because older logs contain it.

## Not built, because the data does not exist

Injuries, tennis draws, bracket trees, formations, unconfirmed lineup labels, contract data, and sport-specific live data such as down and distance, outs, count or power plays. Stats and timelines are football only in the feed. Non-football games show period scores where the feed gives them.

Live streams and replays need licensing. Nothing on the site claims them.

## Not built, needs an outside account or a decision

- Push notifications: needs a messaging key.
- AI-written coverage and translated articles: needs an approved model and key. Coverage today is templates built from verified facts.
- Staging environment: needs separate AWS, Firebase and Stripe accounts.
- Sponsorship and affiliate placements: needs commercial partners.
- Cross-provider ID mapping: needs a second provider.

## Before launch

Owner and client:
1. Confirm paid walls around YouTube and ScoreBat embeds are allowed. The spec says not to paywall public embeds, and YouTube and ScoreBat terms have not been checked.
2. Rotate the TheSportsDB, API-Football and ScoreBat keys, which were shared in chat, and rotate the Stripe key the same way.
3. Confirm commercial terms for TheSportsDB and ScoreBat.
4. Create live Stripe products and prices, decide on Stripe Tax, set dunning and the refund policy. Stripe is in test mode until then.
5. Counsel review of terms, privacy, refund and community documents, plus DMCA intake, retention schedule and the minors decision.
6. Fill in `docs/OWNERS.md`.
7. Review the approved video channel list.

Human testing that automation cannot do:
8. Play one highlight in a real browser.
9. Real phones: iPhone Safari and Android Chrome, including PWA install.
10. A screen reader pass.
11. A real inbox: sign-up, password reset, alerts and the daily digest.
12. Playback from target countries.
13. A native French review, including the legal documents, which are English only.

Operations:
14. Backup restore drill.
15. A load test at expected pilot traffic, on this final build.
16. One refund on a test add-on and on a test subscription.
17. Measure LCP and INP on the live site.
