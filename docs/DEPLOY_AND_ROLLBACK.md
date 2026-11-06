# Deploy and roll back

## How a normal deploy works

Pushing to the `main` branch on GitHub starts `.github/workflows/deploy.yml`, which:

1. Runs the type check and tests.
2. Builds the container image and pushes it to Amazon ECR, tagged with the commit.
3. Starts the new image on ECS. If it fails its health checks, ECS puts the old one back and the deploy fails.
4. Calls `/api/health` until it reports the new commit.
5. Mirrors the code to CodeCommit and starts an Amplify build. Amplify builds from that mirror because the organization disables deploy keys.
6. Checks the home page, pricing and `/api/health`, and that `/api/matches` refuses a request with no account.
7. Runs the browser tests against the live site.

To confirm a deploy, compare the commit on `main` with the `commit` value from `https://flacronsport.com/api/health`.

The working branch can differ from `main`. To publish a branch: `git push origin HEAD:main`.

## Changing infrastructure

Infrastructure is in `infrastructure/aws/flacron-sport.yml`, as the CloudFormation stack `flacron-sport` in `us-east-1`. The pipeline above does not apply this file. A person must update the stack.

**Pass the running image and desired count on every stack update.** Otherwise the service moves to an image tag that does not exist. Use `ImageTag=<the commit now running>` and `DesiredCount=1`, and keep all other parameters at their current values.

### Not applied yet

The following are in the template but were not applied when this document was written, because the application code they depend on must ship first:

- Retries (3 attempts, within 10 minutes) and a dead-letter queue on the scheduled tick
- An alarm when the dead-letter queue holds anything
- The feature switches and `ROUNDUP_HOUR_UTC`

Deploy the code first, then update the stack. The tick route must answer at once before retries are switched on. Otherwise a long tick looks like a failure, and each one would be retried and end up in the dead-letter queue.

## Rolling back

**Backend.** ECS rolls back by itself when a new version fails health checks. To return to an earlier working version by hand, update the service to its previous task definition:

```bash
aws ecs update-service --cluster flacron-sport --service flacron-sport-api --task-definition flacron-sport-api:<revision>
aws ecs wait services-stable --cluster flacron-sport --services flacron-sport-api
```

ECR keeps the last 10 images, so only those can be returned to.

**Website.** In the Amplify console, redeploy the earlier successful build. Keep the website and backend from the same commit where you can, because a new page may rely on a new API.

**Through the pipeline.** Revert the bad commit and push to `main`. This is the safest route when there is time, because the tests run.

**Database.** A code rollback does not undo data changes. Data can only be restored from the daily backups, kept 14 days. This has not been rehearsed yet, so treat it as untested until the drill is done.

**Feature switches.** To stop one feature without a deploy, see `ADMIN_GUIDE.md`.

## What to check after any deploy

- `/api/health` reports the expected commit
- The Operations screen shows a scheduled run in the last 15 minutes
- No alarm email has arrived from the `flacron-sport-alerts` topic

## Alarms

Alarm emails go to the address given as `BudgetEmail`. That subscription must be confirmed from the inbox once.

| Alarm | Meaning |
|---|---|
| `flacron-sport-api-5xx` | The API returned 10 or more server errors in 5 minutes |
| `flacron-sport-api-cpu-high` | CPU stayed above 85% |
| `flacron-sport-webhook-failures` | A Stripe payment notice failed |
| `flacron-sport-job-failures` | A scheduled job failed in two periods running |
| `flacron-sport-score-feed-down` | The score feed was down for three runs |
| `flacron-sport-jobs-stopped` | No job run for an hour |
| `flacron-sport-jobs-undelivered` | A scheduled call could not be delivered after every retry |
