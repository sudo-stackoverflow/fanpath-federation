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
    if secs is None or secs == 0:
        return "n/a"
    m, s = divmod(int(secs), 60)
    return f"{m}m {s}s"


def fmt_ret(r):
    return f"{r.get('pct', 0)}%   ({r.get('returning', 0)}/{r.get('active', 0)})"


PLATFORM_EMOJI = {
    "web":     "🌐",
    "android": "🤖",
    "ios":     "🍎",
}

PLATFORM_ORDER = ["web", "Android", "iOS"]


def format_platform(name, p):
    emoji = PLATFORM_EMOJI.get(name.lower(), "📱")
    dau   = p.get("dau", {})
    ses   = p.get("sessions", {})
    sv    = p.get("screen_views", {})
    br    = p.get("bounce_rate", {})
    er    = p.get("engagement_rate", {})
    sd    = p.get("avg_session_duration_seconds", {})
    ret   = p.get("retention", {})
    ts    = p.get("traffic_sources", []) or []
    mau   = p.get("mau", 0)

    sd_y = sd.get("yesterday")
    sd_d = sd.get("day_before")

    is_web = name.lower() == "web"

    lines = [f"*{emoji} {name}*"]
    lines.append(f"   DAU: {fmt(dau.get('yesterday'), dau.get('day_before'))}   MAU: {mau}")
    lines.append(f"   Sessions: {fmt(ses.get('yesterday'), ses.get('day_before'))}")
    lines.append(f"   {'Page' if is_web else 'Screen'} views: {fmt(sv.get('yesterday'), sv.get('day_before'))}")

    if is_web:
        lines.append(f"   Bounce rate: {fmt_pct(br.get('yesterday_pct'), br.get('day_before_pct'))}")
    else:
        lines.append(f"   Engagement rate: {fmt_pct(er.get('yesterday_pct'), er.get('day_before_pct'))}")

    lines.append(f"   Avg session: {fmt_dur(sd_y)}   (was {fmt_dur(sd_d)})   {arrow(sd_y, sd_d)}")
    lines.append(f"   Retention — Day: {fmt_ret(ret.get('yesterday', {}))}   Week: {fmt_ret(ret.get('week', {}))}   Month: {fmt_ret(ret.get('month', {}))}")

    if is_web and ts:
        lines.append(f"   Traffic sources:")
        for t in ts:
            lines.append(f"      {t.get('source', '?')}: {t.get('pct', 0)}%   ({t.get('sessions', 0)} sessions)")

    return "\n".join(lines)


def main():
    api_url = os.environ.get("METRICS_API_URL")
    webhook = os.environ.get("SLACK_WEBHOOK_URL")

    if not api_url or not webhook:
        print("ERROR: METRICS_API_URL and SLACK_WEBHOOK_URL must be set", file=sys.stderr)
        sys.exit(1)

    try:
        with urllib.request.urlopen(api_url, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        fail_text = f"⚠️ Daily metrics fetch failed: `{e}`"
        post_to_slack(webhook, fail_text)
        sys.exit(1)

    text = format_message(data)

    if webhook == "dry-run":
        print(text)
        return

    post_to_slack(webhook, text)
    print("Posted to Slack successfully.")


def format_message(data):
    date = data.get("date", "unknown")
    u    = data.get("users", {})
    s    = data.get("new_signups", {})
    platforms = data.get("platforms", {}) or {}

    divider = "\n─────────────────────────────\n"

    # Sort platforms: web first, then android, then ios, then others
    def plat_sort_key(name):
        order = {"web": 0, "android": 1, "ios": 2}
        return order.get(name.lower(), 99)

    sorted_platforms = sorted(platforms.items(), key=lambda kv: plat_sort_key(kv[0]))

    platform_sections = divider.join(
        format_platform(name, pdata)
        for name, pdata in sorted_platforms
    )

    text = f"""*📊 Fanpath Daily Metrics · {date}*

*👥 Users (DB)*
   Total: {fmt(u.get('yesterday'), u.get('day_before'))}
   New signups: {fmt(s.get('yesterday'), s.get('day_before'))}

{divider}{platform_sections}
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
