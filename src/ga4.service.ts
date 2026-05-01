/**
 * GA4 Data API Service — 5-minute cached reads.
 *
 * Env vars required:
 *   GA4_PROPERTY_ID  — numeric GA4 property ID (e.g. "123456789")
 *   GA4_CLIENT_EMAIL — service account email
 *   GA4_PRIVATE_KEY  — service account private key (\n as literal \n in .env)
 */

import { BetaAnalyticsDataClient } from "@google-analytics/data";

const PROPERTY_ID  = process.env.GA4_PROPERTY_ID  ?? "";
const CLIENT_EMAIL = process.env.GA4_CLIENT_EMAIL  ?? "";
const PRIVATE_KEY  = (process.env.GA4_PRIVATE_KEY  ?? "").replace(/\\n/g, "\n");

let _client: BetaAnalyticsDataClient | null = null;
function getClient(): BetaAnalyticsDataClient | null {
  if (!PROPERTY_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return null;
  if (!_client) {
    _client = new BetaAnalyticsDataClient({
      credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
    });
  }
  return _client;
}

// ── 5-min cache ───────────────────────────────────────────────────────────────
let _cache: { data: GA4Stats; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface GA4Stats {
  activeUsers28d: number;
  newUsers28d: number;
  sessions28d: number;
  activeUsers7d: number;
  newUsers7d: number;
  sessions7d: number;
  activeUsersToday: number;
  avgSessionDurationSecs: number;
  bounceRate: number;
  engagementRate: number;
  topCountries: { country: string; users: number }[];
  topPages: { page: string; views: number }[];
  dauLast14d: { date: string; users: number }[];
  deviceBreakdown: { device: string; sessions: number }[];
  capturedAt: string;
  available: boolean;
}

const EMPTY: GA4Stats = {
  activeUsers28d: 0, newUsers28d: 0, sessions28d: 0,
  activeUsers7d: 0, newUsers7d: 0, sessions7d: 0,
  activeUsersToday: 0,
  avgSessionDurationSecs: 0, bounceRate: 0, engagementRate: 0,
  topCountries: [], topPages: [], dauLast14d: [], deviceBreakdown: [],
  capturedAt: new Date().toISOString(),
  available: false,
};

const n = (v: string | null | undefined) => parseFloat(v ?? "0") || 0;

export async function getGA4Stats(): Promise<GA4Stats> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) return _cache.data;

  const client = getClient();
  if (!client) return { ...EMPTY, capturedAt: new Date().toISOString() };

  try {
    const property = `properties/${PROPERTY_ID}`;

    const [ov28, ov7, td, countries, pages, dau, devices] = await Promise.all([
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        metrics: [
          { name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" },
          { name: "averageSessionDuration" }, { name: "bounceRate" }, { name: "engagementRate" },
        ],
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }],
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "today", endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 10,
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 5,
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "13daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
    ]);

    const r28 = ov28[0]?.rows?.[0]?.metricValues ?? [];
    const r7  = ov7[0]?.rows?.[0]?.metricValues  ?? [];
    const rTd = td[0]?.rows?.[0]?.metricValues   ?? [];

    const stats: GA4Stats = {
      activeUsers28d: n(r28[0]?.value),
      newUsers28d:    n(r28[1]?.value),
      sessions28d:    n(r28[2]?.value),
      avgSessionDurationSecs: n(r28[3]?.value),
      bounceRate:     parseFloat((n(r28[4]?.value) * 100).toFixed(1)),
      engagementRate: parseFloat((n(r28[5]?.value) * 100).toFixed(1)),
      activeUsers7d:  n(r7[0]?.value),
      newUsers7d:     n(r7[1]?.value),
      sessions7d:     n(r7[2]?.value),
      activeUsersToday: n(rTd[0]?.value),
      topCountries: (countries[0]?.rows ?? []).map(r => ({
        country: r.dimensionValues?.[0]?.value ?? "",
        users:   n(r.metricValues?.[0]?.value ?? "0"),
      })),
      topPages: (pages[0]?.rows ?? []).map(r => ({
        page:  r.dimensionValues?.[0]?.value ?? "",
        views: n(r.metricValues?.[0]?.value ?? "0"),
      })),
      dauLast14d: (dau[0]?.rows ?? []).map(r => {
        const raw = r.dimensionValues?.[0]?.value ?? "";
        const date = raw.length === 8
          ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`
          : raw;
        return { date, users: n(r.metricValues?.[0]?.value ?? "0") };
      }),
      deviceBreakdown: (devices[0]?.rows ?? []).map(r => ({
        device:   r.dimensionValues?.[0]?.value ?? "",
        sessions: n(r.metricValues?.[0]?.value ?? "0"),
      })),
      capturedAt: new Date().toISOString(),
      available: true,
    };

    _cache = { data: stats, ts: Date.now() };
    return stats;
  } catch (err) {
    console.error("[GA4] fetch failed:", err);
    return { ...EMPTY, capturedAt: new Date().toISOString() };
  }
}
