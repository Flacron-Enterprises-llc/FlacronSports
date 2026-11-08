# FlacronSport ↔ Flacron Growth Engine

FlacronSport is connected **once** to the Flacron Growth Engine (FCGE). Everything else (email journeys, webinars, giveaways, offer codes, popups, support chat) is configured in the Growth Engine dashboard, not in this repo. See D-036.

## Growth Engine side (configured 2026-11-08)

| Item | Value |
|---|---|
| App | **FlacronSport**, id `cmujjiled00lijy1je65xn4sn`, slug `flacronsport` |
| Publishable key | `pk_live_026f46e1…` (browser-safe; in `lib/growth-engine.ts`) |
| Allowed domains | `flacronsport.com`, `d27ncpia4c3b8i.amplifyapp.com` |
| Stripe | Shared Flacron account `acct_1HUAchKFLhrvSzkg` in **test mode**, `app_id=flacron-sport` (`stripeAppId` in FCGE). FlacronSport's restricted key is saved in FCGE (encrypted). "Offer codes in Stripe Checkout" is on. |
| Stripe webhook → FCGE | Test-mode endpoint `we_1UZTHjKFLhrvSzkg9G0wrFV3` → `https://dleleyb9ufrgz.cloudfront.net/webhooks/stripe/cmujjiled00lijy1je65xn4sn`, 12 events, metadata `app_id=flacron-sport`; events without our app_id are rejected by FCGE. A live-mode endpoint is needed when Stripe goes live (D-013). |
| Support chat | Widget `wid_6tVfNN13pKp-` "FlacronSport support", shown through the SDK, notifies `hello@flacronenterprises.com`, hidden on `/share/*` and `/fr/share/*` |
| Email content | 76 templates and 26 lifecycle automations exist **as drafts**. Turning them on is an owner decision in the Growth Engine. |

## App side

- **SDK, consent-gated** (`lib/growth-engine.ts`, `components/growth-engine-tracker.tsx`, mounted once in `app/[locale]/layout.tsx`).
  - The `window.FCGE` queue is created on the client and sends nothing.
  - `fcge.min.js` (which also brings the chat widget and any popups) is added to `<head>` only once the visitor allows **Analytics** in the cookie banner, including later in the visit. The SDK records page views itself, client-side navigations included.
  - The Analytics choice in Cookie preferences now has a note (English and French, `t.consent.analyticsNote`) naming the Growth Engine and saying usage is linked to the account once signed in. The legal category text itself is unchanged (see below).
  - The consent `VERSION` in `components/consent/consent-provider.tsx` went from 1 to 2, so returning visitors are asked again. Global Privacy Control still turns Analytics off.
  - Kill switch: `NEXT_PUBLIC_FCGE_DISABLED=true` (set in `.env.example` for local builds).
- **CSP** (`next.config.mjs`, the only place the app sets one): `https://dleleyb9ufrgz.cloudfront.net` added to `script-src` and `connect-src`. `style-src` already allows `'unsafe-inline'` and `img-src` allows `https:`. Amplify and the CloudFormation stack set no CSP.
- **Identify:** once the user is verified (email verified or Google), with email, uid, display name, locale, and the plan once the dashboard has read it (`GrowthEnginePlan` in `components/dashboard/app-shell.tsx`). Repeats with the same traits are dropped. `FCGE.reset()` runs on sign-out or when a different user signs in. Marketing consent is never sent: the app has no account-level marketing opt-in.
- **Events:**
  - `user_registered`: email sign-up, and Google sign-in for a new account (`components/auth/auth-form.tsx`)
  - `email_verified`: the verification link page and the waiting verify page, once per user per browser
  - `onboarding_completed`: the dashboard's "Get set up" checklist (follow a team, choose alerts, decide on spoiler mode) finishing during the visit
  - `pricing_page_visited`: `/pricing` and `/fr/pricing`
  - `upgrade_clicked`: any `data-fcge-upgrade` element (plan cards with the plan id, in-app "Upgrade" links with `any`)
  - `checkout_started`: subscription checkout opened (`lib/billing-client.ts`) and add-on checkout opened (`components/billing/addon-offers.tsx`)
  - `feature_used`, after the action succeeded:
    - `team_followed` (`components/account/prefs-provider.tsx`)
    - `alerts_enabled` with the alert type (`components/account/settings-panel.tsx`)
    - `assistant_question`, an answer from the Sports assistant (`components/assistant/assistant-panel.tsx`)
    - `compare_view_saved` (`components/compare/compare-tool.tsx`)
    - `report_exported`, match or comparison PDF (`components/sports/export-button.tsx`)
    - `viewing_option_opened`, the official broadcaster link (`components/sports/match-center.tsx`)

  Payment and subscription events come from Stripe through the FCGE webhook, never from the browser.

## Offer funnel

A Growth Engine webinar or giveaway link can open any FlacronSport page with `?code=<OFFER>&fcge_ref=<ref>` (and `utm_*`).

- The tracker keeps both in sessionStorage (`fs-fcge-offer`). When a visitor picks a plan before signing up, the offer is also saved with the pending plan (`fs-pending-plan`, localStorage), because the verification link often opens in a new tab. Both are sent with `POST /api/billing/checkout`.
- `app/api/billing/checkout/route.ts` with `lib/billing/growth-engine-funnel.ts`:
  - validates `fcge_ref` (`/^[A-Za-z0-9_\-.]{10,400}$/`) and the code (`/^[A-Z0-9][A-Z0-9_-]{1,39}$/` after trim and uppercase);
  - stamps `fcge_ref`, and `promo_code` when applied, on the Checkout Session metadata and `subscription_data.metadata`, next to the existing `app_id`, `firebase_uid`, `plan` and `interval`;
  - applies the code up front (`discounts`) when it is an active Stripe promotion code whose promotion code or coupon metadata says `app_id=flacron-sport` and whose coupon is valid. Otherwise Stripe Checkout shows its own code field (`allow_promotion_codes`). If Stripe rejects the discount, checkout retries once with the code field. A failed lookup never breaks checkout.
  - An open checkout is reused only for the same plan, interval, `fcge_ref` and requested code (`fcge_code` in the session metadata), so an offer is never lost to an older tab.
- **Add-ons** (`/api/billing/addon`, one-time payments): `fcge_ref` is stamped on the session and `payment_intent_data` metadata. Offer codes are not applied.
- **Plan changes** (`/api/billing/change-plan`) update an existing subscription without Stripe Checkout, so they carry no offer.

## Not done

- **Owner/counsel review:** the Cookies Policy (`lib/legal/content.ts`) is the owner's published text and lists categories, not services, so no Growth Engine row was added and it was not reworded. It should name the Growth Engine under Analytics and get a new effective date. The Privacy Policy's sharing section already covers analytics, email and customer-support providers.
- Turning on the email templates and automations in the Growth Engine (owner decision).
- Live-mode Stripe webhook endpoint and live promotion codes, when Stripe goes live.
- No usage-limit events: the Sports assistant allowance is not reported to the Growth Engine.
