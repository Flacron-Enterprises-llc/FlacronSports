# Data model

All application data is in Google Firestore. Times are stored in UTC and turned into local time only on screen.

## Security rules

`firestore.rules` refuses every direct read and write from a browser. All data goes through server routes, which use the Admin SDK and check the signed-in person's identity, role and plan on each request. A browser therefore cannot read another person's data or write its own plan.

```
match /{document=**} { allow read, write: if false; }
```

The Admin SDK bypasses these rules, so the checks that matter are in the server routes. Any new route must do its own check.

## Indexes

There is no index file, and `firebase.json` only points at the rules. The app is written to need only Firestore's automatic single-field indexes:

- Lists read by time use a single sort field, such as `feedKey` on `reports`, or `at` on `audit_logs`.
- Filters on several fields with no sort are allowed by Firestore without a composite index.
- The test database in `tests/fake-db.ts` throws an error on a query that would need a composite index, so such a query fails in tests before it reaches production.

If a future query needs a composite index, add a `firestore.indexes.json` and point `firebase.json` at it.

## Collections

Each collection is listed with what one document holds. Check the code for the exact fields.

### Accounts and preferences

| Collection | One document is |
|---|---|
| `users` | A person's profile |
| `user_preferences` | Language, time zone, favorites, alert and newsletter settings, consent |
| `dashboard_settings` | Saved dashboard layout |
| `user_blocks` | Who a person has blocked |
| `audit_logs` | One staff or account action: `action`, `actorUid`, `detail`, `at`. Append-only |

### Billing

Written only after Stripe's signature is verified, or by server billing routes.

| Collection | One document is |
|---|---|
| `billing_entitlements` | A person's subscription: plan, status, paid-until date |
| `billing_customers` | Link between a person and their Stripe customer |
| `billing_purchases` | One add-on purchase, with allowance and expiry |
| `billing_payments`, `billing_refunds` | Ledger of payments and refunds |
| `processed_stripe_events` | Stripe events already handled, so a repeat is ignored |
| `billing_quarantine` | Stripe events that could not be applied and need a person |
| `assistant_usage` | Assistant requests used in a period |

### Sports data and video

| Collection | One document is |
|---|---|
| `feed_snapshots` | A stored, compressed provider answer. Visitors read these instead of calling the provider |
| `event_kickoffs` | The kickoff last seen for a game, to detect a moved game |
| `coverage_seen` | One per sport: each competition's last data seen. Written by the scheduled job |
| `admin_config/coverage` | One document: sports and competitions, and competition video, switched off by staff |

### Published content

| Collection | One document is |
|---|---|
| `reports` | One report for one match, type and language. Id: `{matchId}-{type}-{locale}`, or `roundup-{date}-{locale}` for a daily roundup. Types: `result`, `recap`, `preview`, `roundup`. Statuses: `draft`, `validated`, `published`, `corrected`, `rejected`. `reports` is public while published, so nothing staff-only goes in it |
| `report_versions` | Same id as the report. Up to 10 earlier versions, used for rollback. Never public |
| `saved_reports`, `compare_views` | A member's saved items |

`jobKey` on a report is match, type, language and source version. The same key is never written twice. `feedKey` is `locale#publishedAt` and exists only while a report is public. When `editedAt` is set, the scheduled job never touches that report again.

### Notifications and email

| Collection | One document is |
|---|---|
| `notifications` | One alert to one person. Created before sending, which is what prevents a duplicate |
| `newsletter_sends` | One digest for one person and local date. Created before sending, for the same reason |
| `user_calendar_feeds`, `calendar_feeds` | Personal calendar subscription links |

### Community

| Collection | One document is |
|---|---|
| `community_acceptance` | Age and guidelines acceptance |
| `community_reports`, `community_sanctions` | Reported messages, and mutes or suspensions |
| `community_badges` | Supporter badges |
| `match_chats`, `match_chat_participants`, `message_reactions` | Match chat. Messages sit below `match_chats` |
| `match_polls`, `poll_votes` | Match polls |
| `rooms`, `room_members`, `room_hosts`, `room_invites` | Private rooms. Invitations store a hash, never the link itself |
| `predictions` | One entry. Id: `{matchId}_{uid}`. Stores the result key it was scored against |
| `prediction_points` | One person's leaderboard total |
| `prediction_groups`, `prediction_group_members`, `prediction_group_owners`, `prediction_group_invites` | Private prediction groups |
| `referral_accounts`, `referral_links`, `referral_claims` | Points-only referrals |

### Operations

| Collection | One document is |
|---|---|
| `ops_daily` | One UTC day of counters: provider calls, rate-limit hits, failures, email results, playback checks. Saved every few minutes |
| `job_runs` | One job run. Ids are reused, so scheduled runs keep about a week and staff runs the last 200 |

## Backups

Firestore has daily backups kept for 14 days (decision D-027). The restore drill has not been done yet.
