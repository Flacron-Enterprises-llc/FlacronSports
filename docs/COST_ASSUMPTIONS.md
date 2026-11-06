# Cost assumptions

This lists what is known, from the code and `infrastructure/aws/flacron-sport.yml`. Anything not known is marked **Unknown**. No monthly total is given, because actual bills have not been reviewed and real traffic has not been measured.

## What we are running

| Item | Known | Cost |
|---|---|---|
| ECS Fargate | One task of 0.25 vCPU and 512 MB, scaling up to 3 at 65% CPU | **Unknown**, check the AWS bill |
| API Gateway HTTP API | Used instead of a load balancer. Throttled at 100 requests a second, burst 200 | **Unknown**, depends on traffic |
| Amplify hosting | Website | **Unknown**, depends on traffic |
| CloudWatch logs | Kept 30 days. Container Insights off | **Unknown** |
| Amazon SES | Sends alerts and digests | **Unknown**, depends on mail volume |
| Amazon SQS | One dead-letter queue, normally empty | **Unknown**, expected to be very small |
| ECR | Keeps the last 10 images | **Unknown** |
| Firestore | Reads and writes below. Daily backups kept 14 days | **Unknown**, depends on traffic |
| Firebase Auth | Identity Platform | **Unknown** |
| AWS budget alert | $30 a month, warns at 80%. Counts resources tagged `project=flacron-sport` | This is an alert, not a limit |

No NAT gateway or load balancer is used, by design.

## Provider plans

| Provider | Known | Cost |
|---|---|---|
| TheSportsDB | The key is a paid Premium plan (checked 2026-11-06). The code assumes 100 calls a minute | **Unknown** |
| ScoreBat | Live token. The spec lists Starter at $69 a month with 5,000 credits, as of 2 November 2026. Our plan and commercial terms are unconfirmed | **Unknown** |
| API-Football | Key reported Free, 100 requests a day, ending 2026-11-19. Not used | None while unused |
| YouTube | Embedded player and oEmbed check, no paid plan | None known |
| Stripe | Test mode so far | Fees **Unknown** until live terms are confirmed |
| Anthropic API | Sports Assistant only, when `ANTHROPIC_API_KEY` is set. Reports stay deterministic. See "Sports Assistant model" below | **Unknown** |

## Sports Assistant model

Known:

- The key is stored in Secrets Manager as `flacron-sport/production/anthropic` and reaches the ECS task as `ANTHROPIC_API_KEY` through the `AnthropicSecretArn` stack parameter.
- The key is shared with another app's Anthropic account, so usage from both apps is billed together. The bill alone does not show this app's share.
- The default model is `claude-opus-5-5` at low effort, changed with `ASSISTANT_MODEL`. Published rates on 2026-10-06, per million tokens: $4 input and $20 output for `claude-opus-5-5`, with cache reads at $0.20; $2 and $10 for `claude-sonnet-5-5`; $0.10 and $0.50 for `claude-haiku-5-5`.
- Limits per question, from the code: 3,000 output tokens per model call, 4 model calls, 8 data lookups, 18 seconds. One question can use at most 12,000 output tokens, which is $0.24 at the default rate, plus input tokens. Input has no fixed cap, though each lookup result is limited in length.
- The system prompt is cached, which only helps while questions arrive within the cache lifetime of a few minutes.
- Plans allow up to 300 questions a month on Premium, and the $4.99 add-on gives 100 more. Betting questions are refused before any model call. A failed call gives the member's credit back, but tokens it used are still billed to us.

Unknown:

- **The real cost per question.** No live call has been made, so there is no token measurement. Each answered question logs `Assistant model` with its token counts to CloudWatch, with no question text. Measure from those logs before relying on any figure.
- **How many questions members will ask**, and how much of their allowance they use.
- **Whether the margin holds at the default model.** Compare the measured cost per question with plan prices before launch. A cheaper model is one `AssistantModel` parameter change, but its answer quality has not been tested.
- **Any spending limit on the shared account**, and whether this app can have its own workspace or key to separate the bill.

## Provider calls the app makes

These are maximums from the code, not measurements.

- The scheduled job runs every 15 minutes. Each run refreshes today and yesterday for 11 sports, which is 22 calls.
- It then refreshes 5 more days of the calendar and 6 sport and day TV listings, which is 61 calls.
- Recaps fetch match detail for up to 40 finished games a run, at up to 3 calls each. A finished game's detail is kept for 6 hours.
- Live scores are polled at most once a minute by each running server.
- ScoreBat is called at most every 6 hours.
- Visitors read stored copies, so traffic does not normally add provider calls. A match page can fetch detail on a visit.

Actual calls and rate-limit hits are on the Operations screen.

## Firestore use by the scheduled job

- Up to 11 writes per run for coverage last seen
- 1 write per run for the job record, and 1 every 5 minutes per server for counters
- 1 read a minute per server for coverage rules
- Reads on `reports` for each covered game and language, in each run

Monthly Firestore cost at real traffic: **Unknown**.

## Revenue side

Prices are set in `lib/billing/plans.ts`, and decision D-034 records them: Basic $19.99, Plus $29.99, Premium $49.99 a month, and $199.99, $299.99 and $499.99 a year.

## Still unknown

- Number of members and visitors at launch
- Actual monthly AWS, Firebase and SES bills
- TheSportsDB and ScoreBat renewal prices and dates
- Whether a paid wall around YouTube and ScoreBat embeds is allowed by their terms (open question in D-034)
- Live Stripe fees and tax handling
- Whether the $30 budget alert covers everything, as it counts only tagged resources

Review margins once a month of real bills exists, as the spec requires.
