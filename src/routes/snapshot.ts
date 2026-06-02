/**
 * GET /api/daily-snapshot?key=...
 *
 * Returns a merged daily digest of GA4 + Fanpath DB metrics for yesterday
 * vs. the day before. Intended for the federation dashboard / external monitoring.
 *
 * Env vars:
 *   FEDERATION_KEY   — shared secret, same value as on the fanpath server
 *   FANPATH_API_URL  — base URL of the fanpath server (default: https://www.usefanpath.com)
 */

import { Router } from "express";
import { getDailySnapshotGA4 } from "../ga4.service";

const router = Router();

const FANPATH_API_URL =
  process.env.FANPATH_API_URL ?? "https://www.usefanpath.com";
const FEDERATION_KEY = process.env.FEDERATION_KEY ?? "";

router.get("/api/daily-snapshot", async (req, res) => {
  try {
    const dbUrl = `${FANPATH_API_URL}/api/snapshot/daily?key=${encodeURIComponent(FEDERATION_KEY)}`;
    const [ga4, dbFetch] = await Promise.all([
      getDailySnapshotGA4(),
      fetch(dbUrl, {
        headers: {
          "User-Agent":        "FanpathFederation/1.0",
          "x-federation-key": FEDERATION_KEY,
          "Accept":            "application/json",
        },
      }).catch((e: any) => { console.error("[daily-snapshot] fetch threw:", e.message); return null; }),
    ]);

    let db: Record<string, any> = {};
    let dbStatusCode: number | string = "fetch_failed";
    if (dbFetch) {
      dbStatusCode = dbFetch.status;
      if (dbFetch.ok) {
        db = await dbFetch.json() as Record<string, any>;
      } else {
        const errText = await dbFetch.text().catch(() => "(unreadable)");
        console.error(`[daily-snapshot] fanpath returned ${dbFetch.status} — ${errText}`);
        console.error(`[daily-snapshot] URL: ${dbUrl}`);
      }
    }

    // Compute as_of timestamp (ISO) and date string (yesterday in UTC)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    const yyyy = yesterday.getUTCFullYear();
    const mm   = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
    const dd   = String(yesterday.getUTCDate()).padStart(2, "0");

    res.json({
      as_of: now.toISOString(),
      date:  db.date ?? `${yyyy}-${mm}-${dd}`,

      // Users (DB)
      users: db.users ?? { yesterday: 0, day_before: 0 },

      // New signups (DB)
      new_signups: db.new_signups ?? { yesterday: 0, day_before: 0 },

      // Daily / Monthly active users (GA4)
      dau: ga4.dau,
      mau: ga4.mau,

      // Sessions (GA4)
      sessions: ga4.sessions,

      // Page views (GA4)
      page_views: ga4.page_views,

      // Bounce rate (GA4)
      bounce_rate: ga4.bounce_rate,

      // Avg session duration in seconds (GA4)
      avg_session_duration_seconds: ga4.avg_session_duration_seconds,

      // Traffic sources breakdown for yesterday (GA4)
      traffic_sources_yesterday: ga4.traffic_sources_yesterday,

      // Retention: returningUsers / activeUsers from GA4 (default metric, no config needed)
      retention: ga4.retention,

      // Debug — remove once confirmed working
      _db_status: dbStatusCode,
      _db_url: dbUrl.replace(FEDERATION_KEY, "***"),
    });
  } catch (err: any) {
    console.error("[daily-snapshot]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
