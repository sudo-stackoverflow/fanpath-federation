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

export interface CustomEvents {
  // Identity
  signed_up: number;
  logged_in: number;
  profile_completed: number;
  joined_nation: number;
  switched_nation: number;
  // Events
  event_list_viewed: number;
  event_opened: number;
  event_rsvp: number;
  event_created: number;
  // Housing
  housing_list_viewed: number;
  housing_opened: number;
  housing_post_created: number;
  housing_contact_clicked: number;
  housing_saved: number;
  // Tickets
  ticket_board_viewed: number;
  ticket_opened: number;
  ticket_post_created: number;
  ticket_contact_clicked: number;
  // My Path
  my_path_started: number;
  my_path_generated: number;
  my_path_saved: number;
  // Monetization
  paywall_viewed: number;
  purchase_started: number;
  purchase_completed: number;
  // Social
  chat_opened: number;
  message_sent: number;
  dm_started: number;
  friend_added: number;
  profile_viewed: number;
  // Squads
  squad_created: number;
  squad_invite_accepted: number;
  squad_confirmed: number;
  // Simulator
  simulator_opened: number;
  bracket_started: number;
  bracket_saved: number;
  // Intel & Community
  intel_feed_viewed: number;
  intel_post_opened: number;
  post_reacted: number;
  post_commented: number;
  post_reposted: number;
}

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
  customEvents: CustomEvents;
  capturedAt: string;
  available: boolean;
}

const EMPTY_EVENTS: CustomEvents = {
  signed_up: 0, logged_in: 0, profile_completed: 0, joined_nation: 0, switched_nation: 0,
  event_list_viewed: 0, event_opened: 0, event_rsvp: 0, event_created: 0,
  housing_list_viewed: 0, housing_opened: 0, housing_post_created: 0, housing_contact_clicked: 0, housing_saved: 0,
  ticket_board_viewed: 0, ticket_opened: 0, ticket_post_created: 0, ticket_contact_clicked: 0,
  my_path_started: 0, my_path_generated: 0, my_path_saved: 0,
  paywall_viewed: 0, purchase_started: 0, purchase_completed: 0,
  chat_opened: 0, message_sent: 0, dm_started: 0, friend_added: 0, profile_viewed: 0,
  squad_created: 0, squad_invite_accepted: 0, squad_confirmed: 0,
  simulator_opened: 0, bracket_started: 0, bracket_saved: 0,
  intel_feed_viewed: 0, intel_post_opened: 0, post_reacted: 0, post_commented: 0, post_reposted: 0,
};

const EMPTY: GA4Stats = {
  activeUsers28d: 0, newUsers28d: 0, sessions28d: 0,
  activeUsers7d: 0, newUsers7d: 0, sessions7d: 0,
  activeUsersToday: 0,
  avgSessionDurationSecs: 0, bounceRate: 0, engagementRate: 0,
  topCountries: [], topPages: [], dauLast14d: [], deviceBreakdown: [],
  customEvents: { ...EMPTY_EVENTS },
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

    const [ov28, ov7, td, countries, pages, dau, devices, events28] = await Promise.all([
      // Standard metrics — 28d
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        metrics: [
          { name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" },
          { name: "averageSessionDuration" }, { name: "bounceRate" }, { name: "engagementRate" },
        ],
      }),
      // Standard metrics — 7d
      client.runReport({
        property,
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" }],
      }),
      // Today
      client.runReport({
        property,
        dateRanges: [{ startDate: "today", endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      }),
      // Top countries
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 10,
      }),
      // Top pages
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 5,
      }),
      // DAU last 14 days
      client.runReport({
        property,
        dateRanges: [{ startDate: "13daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      // Device breakdown
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
      // ── Custom events — 28d event counts ─────────────────────────────────────
      client.runReport({
        property,
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        limit: 100,
      }),
    ]);

    const r28 = ov28[0]?.rows?.[0]?.metricValues ?? [];
    const r7  = ov7[0]?.rows?.[0]?.metricValues  ?? [];
    const rTd = td[0]?.rows?.[0]?.metricValues   ?? [];

    // Build event count map from GA4 response
    const eventMap: Record<string, number> = {};
    for (const row of events28[0]?.rows ?? []) {
      const name  = row.dimensionValues?.[0]?.value ?? "";
      const count = n(row.metricValues?.[0]?.value);
      if (name) eventMap[name] = count;
    }

    const ev = (key: string) => eventMap[key] ?? 0;

    const customEvents: CustomEvents = {
      signed_up:               ev("signed_up"),
      logged_in:               ev("logged_in"),
      profile_completed:       ev("profile_completed"),
      joined_nation:           ev("joined_nation"),
      switched_nation:         ev("switched_nation"),
      event_list_viewed:       ev("event_list_viewed"),
      event_opened:            ev("event_opened"),
      event_rsvp:              ev("event_rsvp"),
      event_created:           ev("event_created"),
      housing_list_viewed:     ev("housing_list_viewed"),
      housing_opened:          ev("housing_opened"),
      housing_post_created:    ev("housing_post_created"),
      housing_contact_clicked: ev("housing_contact_clicked"),
      housing_saved:           ev("housing_saved"),
      ticket_board_viewed:     ev("ticket_board_viewed"),
      ticket_opened:           ev("ticket_opened"),
      ticket_post_created:     ev("ticket_post_created"),
      ticket_contact_clicked:  ev("ticket_contact_clicked"),
      my_path_started:         ev("my_path_started"),
      my_path_generated:       ev("my_path_generated"),
      my_path_saved:           ev("my_path_saved"),
      paywall_viewed:          ev("paywall_viewed"),
      purchase_started:        ev("purchase_started"),
      purchase_completed:      ev("purchase_completed"),
      chat_opened:             ev("chat_opened"),
      message_sent:            ev("message_sent"),
      dm_started:              ev("dm_started"),
      friend_added:            ev("friend_added"),
      profile_viewed:          ev("profile_viewed"),
      squad_created:           ev("squad_created"),
      squad_invite_accepted:   ev("squad_invite_accepted"),
      squad_confirmed:         ev("squad_confirmed"),
      simulator_opened:        ev("simulator_opened"),
      bracket_started:         ev("bracket_started"),
      bracket_saved:           ev("bracket_saved"),
      intel_feed_viewed:       ev("intel_feed_viewed"),
      intel_post_opened:       ev("intel_post_opened"),
      post_reacted:            ev("post_reacted"),
      post_commented:          ev("post_commented"),
      post_reposted:           ev("post_reposted"),
    };

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
      customEvents,
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
