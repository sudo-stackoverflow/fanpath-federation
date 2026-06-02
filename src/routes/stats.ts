import { Router } from "express";
import { getGA4Stats, type GA4Stats } from "../ga4.service";

const router = Router();

const FANPATH_API_URL =
  process.env.FANPATH_API_URL ?? "https://www.usefanpath.com";
const FEDERATION_KEY = process.env.FEDERATION_KEY ?? "";

// ── /api/stats — combined Fanpath DB + GA4 ───────────────────────────────────
router.get("/api/stats", async (req, res) => {
  try {
    const window = (req.query.window as string) || "7d";
    const nation  = (req.query.nation  as string) || "";
    const nationParam = nation ? `&nation=${encodeURIComponent(nation)}` : "";
    const dbUrl = `${FANPATH_API_URL}/api/federation/stats?key=${encodeURIComponent(FEDERATION_KEY)}&window=${window}${nationParam}`;
    const [dbRes, ga4] = await Promise.all([
      fetch(dbUrl, {
        headers: {
          "User-Agent":        "FanpathFederation/1.0",
          "x-federation-key": FEDERATION_KEY,
          "Accept":            "application/json",
        },
      }),
      getGA4Stats(window as "24h" | "7d" | "30d" | "all"),
    ]);

    let db: Record<string, unknown> = {};
    if (dbRes.ok) {
      db = await dbRes.json() as Record<string, unknown>;
    } else {
      const errText = await dbRes.text().catch(() => "(unreadable)");
      console.error(`[stats] fanpath DB fetch failed — ${dbRes.status} ${dbRes.statusText} — ${errText}`);
      console.error(`[stats] URL called: ${dbUrl}`);
    }

    res.json({ ...db, ga4, _dbStatus: dbRes.ok ? "ok" : dbRes.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
