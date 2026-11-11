# FlacronSport mobile (Flutter)

The Android app for FlacronSport members. It uses the same backend as the website:
every call goes to `https://flacronsport.com/api/...` with the member's Firebase ID
token as a Bearer header, exactly like the web's `authFetch`. No backend logic is
duplicated in the app.

## Plans and payments

Members buy and manage plans on the website. The app reads `/api/billing/status`
(effective plan, add-ons, day pass) and `/api/assistant` (allowance) and unlocks the
same features the web does. It re-reads the plan whenever it returns to the
foreground, so a purchase made on the site unlocks the app straight away.

## Structure

```
lib/
  core/        config, API client, auth (Firebase + Google + TOTP MFA), router, theme, state
  models/      lenient readers for the backend's JSON (SportEvent, Account, Preferences)
  widgets/     shared UI: cards, event rows, skeletons, error states, avatar
  features/    one folder per product area (home, scores, match, watch, news, community, ...)
test/          unit tests for models, plan logic and link routing
```

Copy is bilingual through `tr('English', 'Français')`; the language follows the
account's `locale` preference, as on the web.

## Run locally

1. Put `google-services.json` for the Android app `com.flacronsport.app`
   (Firebase project `flacronsport`) in `android/app/`. It is git-ignored.
2. Optional, for signed release builds: create `android/key.properties`
   (git-ignored) with `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.
   Without it, release builds use the debug key.
3. `flutter pub get && flutter run`

Point at another backend with `--dart-define=API_BASE=https://staging.example.com`.

## CI/CD: GitHub Actions and Firebase App Distribution

`.github/workflows/mobile.yml` runs on every push to `main` that changes `mobile/**`
(and on manual dispatch). It analyzes, tests, builds a signed release APK, keeps it as
a workflow artifact, and uploads it to Firebase App Distribution, which emails the
testers.

Repository secrets:

| Secret | Contents |
|---|---|
| `GOOGLE_SERVICES_JSON_BASE64` | base64 of `android/app/google-services.json` |
| `ANDROID_KEYSTORE_BASE64` | base64 of the upload keystore (`.jks`) |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` | keystore credentials |
| `FIREBASE_SERVICE_ACCOUNT` | JSON key of `github-app-distribution@flacronsport.iam.gserviceaccount.com` (role: Firebase App Distribution Admin) |

Repository variables:

| Variable | Value |
|---|---|
| `FIREBASE_ANDROID_APP_ID` | `1:587360197502:android:7057b820e73464614b312f` |
| `FIREBASE_TESTERS` | comma-separated tester emails |
| `FIREBASE_TESTER_GROUPS` | `testers` |

The keystore's SHA-1 and SHA-256 are registered on the Firebase Android app, which
Google Sign-In needs, and its SHA-256 is in the website's
`public/.well-known/assetlinks.json` so invite and match links open in the app.
Keep the keystore safe: a different key means testers must reinstall.

Changes under `mobile/` do not trigger the website's CI or deploy workflows.
