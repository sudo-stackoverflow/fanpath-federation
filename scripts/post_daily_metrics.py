#!/usr/bin/env python3
"""
Daily metrics → Slack post.

Fetches metrics from Fanpath's daily snapshot API and posts a formatted
summary to Slack via incoming webhook. Triggered by GitHub Actions cron
at 7am ET each day.

Env vars required:
  METRICS_API_URL    Full URL with auth key
  SLACK_WEBHOOK_URL  Slack incoming webhook URL
"""
import json
import os
import sys
import urllib.request


def arrow(curr, prev):
    if curr is None or prev is None:
        return ""
    if curr > prev:
        return "↑"
    if curr < prev:
        return "↓"
    return "→"


def fmt(curr, prev):
    a = arrow(curr, prev)
    return f"{curr}   (was {prev})   {a}"


def fmt_pct(curr, prev):
    if curr is None or prev is None:
        return "n/a"
    a = arrow(curr, prev)
    return f"{curr:.2f}%   (was {prev:.2f}%)   {a}"


def fmt_dur(secs):
    if secs is None:
        return "n/a"
    m, s = divmod(secs, 60)
    return f"{m}m {s}s"


def main():
    api_url = os.environ.get("METRICS_API_URL")
    webhook = os.environ.get("SLACK_WEBHOOK_URL")

    if not api_url or not webhook:
        print("ERROR: METRICS_API_URL and SLACK_WEBHOOK_URL must be set", file=sys.stderr)
        sys.exit(1)

    # 1. Fetch metrics from API
    try:
        with urllib.request.urlopen(api_url, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        # If API fails, post a failure notice to Slack anyway
        fail_text = f"⚠️ Daily metrics fetch failed: `{e}`"
        post_to_slack(webhook, fail_text)
        sys.exit(1)

    # 2. Format the message
    text = format_message(data)

    # 3. POST to Slack
    post_to_slack(webhook, text)
    print("Posted to Slack successfully.")


def format_message(data):
    date = data.get("date", "unknown")
    u = data.get("users", {})
    s = data.get("new_signups", {})
    d = data.get("dau", {})
    mau = data.get("mau", "n/a")
    ses = data.get("sessions", {})
    pv = data.get("page_views", {})
    br = data.get("bounce_rate", {})
    sd = data.get("avg_session_duration_seconds", {})
    ts = data.get("traffic_sources_yesterday", []) or []
    r = data.get("retention", {})

    sd_y = sd.get("yesterday")
    sd_d = sd.get("day_before")

    traffic_lines = "\n".join(
        f"   {t.get('source', '?')}: {t.get('pct', 0)}%   ({t.get('sessions', 0)} sessions)"
        for t in ts
    ) or "   (no data)"

    ry = r.get("yesterday", {})
    rw = r.get("week", {})
    rm = r.get("month", {})

    text = f"""*📊 Fanpath Daily Metrics · {date}*

*👥 Users*
   Total: {fmt(u.get('yesterday'), u.get('day_before'))}
   New signups: {fmt(s.get('yesterday'), s.get('day_before'))}
   DAU: {fmt(d.get('yesterday'), d.get('day_before'))}
   MAU: {mau}

*📈 Engagement*
   Sessions: {fmt(ses.get('yesterday'), ses.get('day_before'))}
   Page views: {fmt(pv.get('yesterday'), pv.get('day_before'))}
   Bounce rate: {fmt_pct(br.get('yesterday_pct'), br.get('day_before_pct'))}
   Avg session: {fmt_dur(sd_y)}   (was {fmt_dur(sd_d)})   {arrow(sd_y, sd_d)}

*🔗 Traffic sources (yesterday)*
{traffic_lines}

*🔁 Retention*
   Yesterday: {ry.get('pct', 0)}%   ({ry.get('returning', 0)}/{ry.get('active', 0)})
   Week: {rw.get('pct', 0)}%   ({rw.get('returning', 0)}/{rw.get('active', 0)})
   Month: {rm.get('pct', 0)}%   ({rm.get('returning', 0)}/{rm.get('active', 0)})
"""
    return text


def post_to_slack(webhook, text):
    payload = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        webhook,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        body = resp.read().decode("utf-8")
        if body.strip() != "ok":
            raise RuntimeError(f"Slack returned non-ok: {body}")


if __name__ == "__main__":
    main()
