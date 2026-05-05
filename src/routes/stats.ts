import { Router } from "express";
import { requireKey } from "../middleware/auth";
import { getGA4Stats } from "../ga4.service";

const router = Router();

const FANPATH_API_URL =
  process.env.FANPATH_API_URL ?? "https://www.usefanpath.com";
const FEDERATION_KEY = process.env.FEDERATION_KEY ?? "";

// ── /api/stats — combined Fanpath DB + GA4 ───────────────────────────────────
router.get("/api/stats", requireKey, async (req, res) => {
  try {
    const window = (req.query.window as string) || "7d";
    const nation  = (req.query.nation  as string) || "";
    const nationParam = nation ? `&nation=${encodeURIComponent(nation)}` : "";
    const [dbRes, ga4] = await Promise.all([
      fetch(
        `${FANPATH_API_URL}/api/federation/stats?key=${encodeURIComponent(FEDERATION_KEY)}&window=${window}${nationParam}`
      ),
      getGA4Stats(),
    ]);
    const db = (dbRes.ok ? await dbRes.json() : {}) as Record<string, unknown>;
    res.json({ ...db, ga4 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
