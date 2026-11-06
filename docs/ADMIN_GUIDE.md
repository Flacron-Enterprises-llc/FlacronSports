# Admin guide

The admin area is at `/app/admin`. Every account there must sign in with an authenticator app. What you see depends on your role:

| Screen | Admin | Editor | Moderator |
|---|---|---|---|
| Operations | Yes | | |
| Coverage | Yes | | |
| Editorial | Yes | Yes | |
| Moderation | Yes | | Yes |
| Community | Yes | | Yes |
| Billing health | Yes | | |

Most actions ask for a reason. It goes into the audit log with your account and the time. Check that it is one you would be happy for a colleague to read.

## Operations

This is the first place to look when something seems wrong.

- **Feed state and fixtures today.** Whether sports data is healthy now.
- **Last scheduled run.** Jobs run every 15 minutes. A warning appears if none has been recorded for 45 minutes.
- **Switches.** Whether video, publishing and payments are on.
- **Providers.** "Paused after repeated failures" means five calls in a row failed, so the site stopped calling that provider for a short time and is showing stored data. It tries again by itself, waiting between 1 and 10 minutes. You do not need to do anything unless it stays paused. This status is for the one server that answered your page.
- **No recent data.** A sport with nothing seen for 48 hours. A sport out of season appears here too, so this is not always a fault.
- **Email, playback, calls.** Counts for today and the last 7 days. They are saved every few minutes, so very recent ones may be missing if a server restarts.
- **Recent job runs.** "OK", the jobs that failed, or "Stopped before finishing".

### Running a job again

Choose the job, give a reason, and press Run job. It runs in the background, and the result appears under Recent job runs. Only one job runs at a time on a server.

Re-running cannot send duplicate mail. Each alert and digest is recorded before sending, so a re-run skips anyone already recorded. This also means that a digest which failed to send is not retried: the person misses that one digest rather than risk receiving two. A digest only goes out during the person's morning delivery hour, so a re-run at another time sends nothing.

## Coverage

Lists each sport and competition with when data was last seen. Everything is on unless switched off here.

- **Shown** hides a sport or competition from scores, reports and alerts. Switching a sport off also stops its provider calls.
- **Video** stops video for one competition and leaves its scores.
- Changes reach every server within about a minute.
- Football clips use the video provider's own competition names, such as "ENGLAND: League Cup". Those appear marked "video feed only", with only a Video switch.
- A game in a hidden competition still settles its predictions, so nobody loses points by a switch being turned off.

A competition appears only after a scheduled job has seen it. There is no screen yet for approving providers, or for reviewing ambiguous fixture matches between providers.

## Editorial

Reports are written automatically from verified match data, from fixed templates. No AI model is used.

| Type | When | What it says |
|---|---|---|
| Preview | Up to 36 hours before a major or followed game | Teams, competition, time, venue if known |
| Result | After the game | Final score only |
| Recap | After the game, when a timeline exists | Final score, goals and red cards. Games with no timeline get no recap |
| Daily roundup | Each morning (UTC) | Yesterday's verified results, in each language |

Reports appear in the News page once they pass validation. A report that could not be checked waits in Draft with the reason shown.

Queues:

- **Draft:** waiting for a person. Common reasons are that the facts changed after publication, or the timeline does not add up to the score.
- **Validated:** ready, held because publishing is switched off.
- **Rejected, Corrected, Published:** use Published to find a live report that needs fixing.

Actions, each needing a reason:

- **Correct:** change the title or text. It goes live at once, with your reason shown to readers as the correction note, so write it for them. The job never replaces a corrected report.
- **Publish:** make the report public as it stands.
- **Reject:** take it off the site.
- **Roll back:** put back the version before the last change. Press again to go further back, up to 10 versions.

After any editor action the report belongs to the editors, and the job will not change it, even if the source data changes later. If the facts change, correct it by hand.

When facts change after publication, the report comes down and goes to Draft. The earlier text is kept, so Roll back returns it to the site.

## Moderation

Open reports from members. Each lets you remove the message, mute or suspend the person, lock the room, revoke a room's invitation, or resolve the report.

## Community

- **Revoke a room invitation.** Enter the room ID. New people can no longer join with that link. People already in the room stay in. To clear a room, lock it from a report as well.
- **Audit log.** Search by action, account ID or detail, such as a room ID. Each search looks through the latest 500 entries. Use "Look further back" to continue.

## Billing health

Totals for payment events, quarantined events and purchases needing review. Test and live money, and different currencies, are never added together. If the screen says totals cover only the first 5,000 records, check Stripe for the full figure.

## Feature switches

These stop one area without a code change. Update the stack parameter (see `DEPLOY_AND_ROLLBACK.md`), which restarts the service.

| Parameter | When set to `false` |
|---|---|
| `FeatureVideo` | No video is offered or played. Scores and TV listings carry on |
| `FeatureGeneratedPublishing` | New reports wait in Validated for an editor. Reports already live stay live |
| `FeaturePayments` | No new subscriptions, add-ons or plan changes. Existing subscribers keep access, and cancelling still works |

Chat, rooms and predictions have their own switch, `COMMUNITY_ENABLED`.

## When a report is wrong

1. Find it under Published.
2. Press Correct, fix the text, and write a short note for readers.
3. If the data was wrong, tell the provider. The report stays as you left it, either way.

## When the sports data stops

1. Check Operations. If the provider is paused, the site is already showing stored scores, labelled as possibly out of date.
2. Stored data is used for up to 6 hours. After that, the site says scores are unavailable rather than show old ones.
3. Check the provider's status and your plan's limits. See `OWNERS.md` for who to call.
