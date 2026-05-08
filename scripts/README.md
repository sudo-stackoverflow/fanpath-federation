# Fanpath Daily Metrics — Slack Cron

Posts a daily metrics summary to Slack at **7 AM ET** every day.

## How it works

```
GitHub Actions cron (0 11 * * * UTC = 7am EDT)
        ↓
scripts/post_daily_metrics.py
        ↓
GET METRICS_API_URL  →  formatted Slack message  →  POST SLACK_WEBHOOK_URL
        ↓
Slack channel
```

## Required GitHub Secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `METRICS_API_URL` | `https://fanpath-federation-production.up.railway.app/api/daily-snapshot?key=<KEY>` |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/T.../B.../...` |

## Test manually

In the GitHub Actions tab, click **Daily Metrics → Slack** workflow → **Run workflow** → **Run workflow** button.

Or run locally:
```bash
export METRICS_API_URL='https://...'
export SLACK_WEBHOOK_URL='https://...'
python3 scripts/post_daily_metrics.py
```

## Schedule

- `0 11 * * *` (UTC) = **7:00 AM EDT** (March–November)
- During EST (Nov–Mar), this becomes **6:00 AM EST**

To always be 7am ET regardless of DST, you'd need two cron lines or a server with TZ. For now, 1-hour drift in winter is acceptable.

## Output format

```
📊 Fanpath Daily Metrics · 2026-05-07

👥 Users
   Total: 146   (was 144)   ↑
   New signups: 2   (was 1)   ↑
   DAU: 34   (was 24)   ↑
   MAU: 376

📈 Engagement
   Sessions: 74   (was 59)   ↑
   ...
```
