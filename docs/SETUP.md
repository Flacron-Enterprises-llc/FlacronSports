# Environment setup

FlacronSport has two running parts:

- **Website (frontend):** Next.js on AWS Amplify. It holds no database or provider credentials.
- **Backend:** the same Next.js code in a container on AWS ECS Fargate. It holds the secrets, calls the sports providers, and runs the scheduled jobs.

On Amplify, `API_ORIGIN` points at the backend, and every `/api/*` request is forwarded there.

## Run it on a computer

You need Node 22.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` from the table below. Never commit real values. Without a TheSportsDB key the site uses the provider's public test key, which returns a handful of events and is shown as a limited feed. Without Firebase Admin values, anything stored will not work.

Checks to run before any change goes out:

```bash
npm run typecheck
npm test
npm run build
```

## Settings

"Backend" settings are in `infrastructure/aws/flacron-sport.yml`. Secrets are stored in AWS Secrets Manager under `flacron-sport/production/` and the container receives them at start. They are never written to the repository.

| Setting | Where | Purpose |
|---|---|---|
| `APP_BASE_URL` | Backend, Amplify | The public site address, used in links, emails and the sitemap |
| `API_ORIGIN` | Amplify only | Address of the backend. Must be empty on the backend |
| `NEXT_PUBLIC_FIREBASE_*` | Amplify, local | Firebase web app settings. Public by design |
| `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | Backend secret | Database and sign-in checks on the server |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Backend secret | Payments |
| `STRIPE_PRICE_*`, `STRIPE_PORTAL_CONFIGURATION` | Backend | One Stripe price ID per plan and add-on, and the customer portal |
| `NEXT_PUBLIC_BILLING_MODE`, `STRIPE_LIVE_MODE_APPROVED` | See `.env.example` | Live Stripe keys are refused unless approved |
| `THESPORTSDB_API_KEY` | Backend secret | Sports data |
| `SCOREBAT_TOKEN` | Backend secret | Football video clips |
| `CRON_SECRET` | Backend secret | Proves a scheduled call is really from the scheduler |
| `SES_REGION`, `EMAIL_FROM` | Backend | Email through Amazon SES. If empty, nothing is sent |
| `JOBS_ENABLED` | Backend | Must be `true` for scheduled jobs and staff re-runs to work |
| `COMMUNITY_ENABLED` | Backend, Amplify | Must be `true` for chat, rooms and predictions. Off when unset |
| `FEATURE_VIDEO` | Backend | Set to `false` to stop all video. On when unset |
| `FEATURE_GENERATED_PUBLISHING` | Backend | Set to `false` to hold new reports for an editor. On when unset |
| `FEATURE_PAYMENTS` | Backend | Set to `false` to stop new purchases and plan changes. On when unset |
| `ROUNDUP_HOUR_UTC` | Backend | Hour after which yesterday's roundup is written. Default 6 |
| `GIT_COMMIT_SHA` | Set by the pipeline | Reported by `/api/health` |

The three `FEATURE_*` switches are stack parameters: `FeatureVideo`, `FeatureGeneratedPublishing` and `FeaturePayments`. With payments off, existing subscribers keep their access, and Stripe's payment notices are still processed.

Amplify copies only `APP_BASE_URL`, `API_ORIGIN`, `COMMUNITY_ENABLED` and `NEXT_PUBLIC_*` into its build. See `amplify.yml`.

## Accounts the product depends on

| Service | Used for | Current state |
|---|---|---|
| AWS, account 482881544977, `us-east-1` | Backend, website, email, logs, alarms | Stack `flacron-sport` |
| Firebase project | Sign-in and Firestore | See `DATA_MODEL.md` |
| Stripe | Payments | Test mode. Live prices still need creating |
| TheSportsDB | Sports data | Paid key checked on 2026-11-06 |
| ScoreBat | Football clips | Token live. Plan and commercial terms to be confirmed |
| YouTube | Highlights, through YouTube's own player | Approved channel list needs owner or counsel review |

## Staff accounts

Staff access comes from a `role` value on the Firebase account: `moderator`, `editor` or `admin`. This repository has no screen or script that sets it, so it must be set with the Firebase Admin SDK by whoever holds the service account. Every staff account must also sign in with an authenticator app, or the admin pages refuse it.
