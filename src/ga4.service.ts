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
const PRIVATE_KEY  = (process.env.GA4_PRIVATE_KEY  ?? "")
  .replace(/\\n/g, "\n")
  .trim();

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

// ── 5-min cache — keyed per window so each filter has its own slot ───────────
type Window = "24h" | "7d" | "30d" | "all";
const _cache: Partial<Record<Window, { data: GA4Stats; ts: number }>> = {};
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Maps window slug → GA4 startDate string */
function startDate(win: Window): string {
  if (win === "24h")  return "1daysAgo";
  if (win === "7d")   return "6daysAgo";
  if (win === "30d")  return "29daysAgo";
  return "89daysAgo"; // "all" → 90 days
}
/** DAU chart needs one extra day so we can show a full bar for today */
function dauStartDate(win: Window): string {
  if (win === "24h")  return "1daysAgo";
  if (win === "7d")   return "6daysAgo";
  if (win === "30d")  return "29daysAgo";
  return "89daysAgo";
}

export interface CustomEvents {
  // Auth / Identity
  signed_up: number;
  logged_in: number;
  logout: number;
  account_deleted: number;
  otp_verified: number;
  password_reset: number;
  profile_completed: number;
  joined_nation: number;
  switched_nation: number;

  // Events
  event_list_viewed: number;
  event_opened: number;
  event_rsvp: number;
  event_created: number;
  event_not_attended: number;
  event_left: number;
  event_edited: number;
  event_deleted: number;

  // Housing
  housing_list_viewed: number;
  housing_opened: number;
  housing_post_created: number;
  housing_contact_clicked: number;
  housing_saved: number;
  housing_post_edited: number;
  housing_post_deleted: number;
  housing_marked_booked: number;

  // Tickets
  ticket_board_viewed: number;
  ticket_opened: number;
  ticket_post_created: number;
  ticket_contact_clicked: number;
  ticket_post_edited: number;
  ticket_post_deleted: number;
  transaction_amount_submitted: number;

  // Reviews
  review_submitted: number;
  review_dismissed: number;

  // Chat / Messaging
  chat_opened: number;
  message_sent: number;
  dm_started: number;
  dm_interest_sent: number;
  p2p_mode_started: number;

  // Social Graph
  profile_viewed: number;
  friend_added: number;
  friend_rejected: number;
  friend_removed: number;
  friend_blocked: number;
  badge_thrown: number;

  // Squads
  squad_builder_opened: number;
  squad_create_started: number;
  squad_created: number;
  squad_invite_accepted: number;
  squad_invite_declined: number;
  squad_confirmed: number;
  squad_left: number;
  squad_message_sent: number;
  squad_size_changed: number;

  // My Path
  my_path_started: number;
  my_path_generated: number;
  my_path_saved: number;
  my_path_team_selected: number;
  my_path_group_size_selected: number;
  my_path_airport_selected: number;
  my_path_housing_clicked: number;
  my_path_tickets_clicked: number;
  my_path_events_clicked: number;
  my_path_listing_opened: number;
  multi_city_plan_created: number;
  trip_intent_set: number;
  mypath_breakdown_parse_failed: number;

  // Simulator / Draw
  simulator_opened: number;
  bracket_started: number;
  bracket_saved: number;
  bracket_shared: number;
  draw_opened: number;
  draw_randomized: number;
  draw_advanced_pot: number;

  // Intel Feed
  intel_feed_viewed: number;
  intel_post_opened: number;
  intel_post_engaged: number;
  intel_reacted: number;
  intel_commented: number;
  intel_reposted: number;

  // Community Feed
  post_reacted: number;
  post_commented: number;
  post_comment_replied: number;
  post_reposted: number;
  post_saved: number;
  post_reported: number;
  post_deleted: number;
  post_copied_link: number;
  post_notification_toggled: number;

  // Monetization
  paywall_viewed: number;
  purchase_started: number;
  purchase_completed: number;
  purchase_cancelled: number;
  subscription_unlocked_feature_used: number;

  // Referrals
  referral_link_shared: number;
  referral_reward_earned: number;

  // Filters
  listing_filter_applied: number;

  // PWA / Push
  app_install_tapped: number;
  push_notification_enabled: number;

  // Community (mobile)
  post_created: number;

  // Marketplace confirmations (mobile)
  ticket_confirmed:  number;
  housing_confirmed: number;

  // Match check-in (mobile)
  match_checkin: number;

  // Hotels (mobile)
  hotel_list_viewed:        number;
  hotel_search_started:     number;
  hotel_opened:             number;
  hotel_booking_started:    number;
  hotel_booking_completed:  number;
  hotel_gold_gate_shown:    number;
  hotel_gold_upgrade_tapped: number;
  hotel_gold_gate_dismissed: number;
}

export interface GA4Stats {
  // Primary window (matches the requested window)
  activeUsers: number;
  newUsers: number;
  sessions: number;
  avgSessionDurationSecs: number;
  bounceRate: number;
  engagementRate: number;
  // Always-fixed reference points
  activeUsersToday: number;
  // Kept for backward-compat labels in dashboard
  activeUsers28d: number;
  newUsers28d: number;
  sessions28d: number;
  activeUsers7d: number;
  newUsers7d: number;
  sessions7d: number;
  topCountries: { country: string; users: number }[];
  topPages: { page: string; views: number }[];
  dauLast14d: { date: string; users: number }[];
  deviceBreakdown: { device: string; sessions: number }[];
  customEvents: CustomEvents;
  window: string; // "24h" | "7d" | "30d" | "all"
  capturedAt: string;
  available: boolean;
}

const EMPTY_EVENTS: CustomEvents = {
  // Auth
  signed_up: 0, logged_in: 0, logout: 0, account_deleted: 0, otp_verified: 0, password_reset: 0,
  profile_completed: 0, joined_nation: 0, switched_nation: 0,
  // Events
  event_list_viewed: 0, event_opened: 0, event_rsvp: 0, event_created: 0,
  event_not_attended: 0, event_left: 0, event_edited: 0, event_deleted: 0,
  // Housing
  housing_list_viewed: 0, housing_opened: 0, housing_post_created: 0,
  housing_contact_clicked: 0, housing_saved: 0, housing_post_edited: 0,
  housing_post_deleted: 0, housing_marked_booked: 0,
  // Tickets
  ticket_board_viewed: 0, ticket_opened: 0, ticket_post_created: 0,
  ticket_contact_clicked: 0, ticket_post_edited: 0, ticket_post_deleted: 0,
  transaction_amount_submitted: 0,
  // Reviews
  review_submitted: 0, review_dismissed: 0,
  // Chat
  chat_opened: 0, message_sent: 0, dm_started: 0, dm_interest_sent: 0, p2p_mode_started: 0,
  // Social
  profile_viewed: 0, friend_added: 0, friend_rejected: 0, friend_removed: 0,
  friend_blocked: 0, badge_thrown: 0,
  // Squads
  squad_builder_opened: 0, squad_create_started: 0, squad_created: 0,
  squad_invite_accepted: 0, squad_invite_declined: 0, squad_confirmed: 0,
  squad_left: 0, squad_message_sent: 0, squad_size_changed: 0,
  // My Path
  my_path_started: 0, my_path_generated: 0, my_path_saved: 0,
  my_path_team_selected: 0, my_path_group_size_selected: 0, my_path_airport_selected: 0,
  my_path_housing_clicked: 0, my_path_tickets_clicked: 0, my_path_events_clicked: 0,
  my_path_listing_opened: 0, multi_city_plan_created: 0, trip_intent_set: 0,
  mypath_breakdown_parse_failed: 0,
  // Simulator
  simulator_opened: 0, bracket_started: 0, bracket_saved: 0, bracket_shared: 0,
  draw_opened: 0, draw_randomized: 0, draw_advanced_pot: 0,
  // Intel
  intel_feed_viewed: 0, intel_post_opened: 0, intel_post_engaged: 0,
  intel_reacted: 0, intel_commented: 0, intel_reposted: 0,
  // Community
  post_reacted: 0, post_commented: 0, post_comment_replied: 0, post_reposted: 0,
  post_saved: 0, post_reported: 0, post_deleted: 0, post_copied_link: 0,
  post_notification_toggled: 0,
  // Monetization
  paywall_viewed: 0, purchase_started: 0, purchase_completed: 0,
  purchase_cancelled: 0, subscription_unlocked_feature_used: 0,
  // Referrals
  referral_link_shared: 0, referral_reward_earned: 0,
  // Filters
  listing_filter_applied: 0,
  // PWA
  app_install_tapped: 0, push_notification_enabled: 0,
  // Community (mobile)
  post_created: 0,
  // Marketplace confirmations (mobile)
  ticket_confirmed: 0, housing_confirmed: 0,
  // Match check-in (mobile)
  match_checkin: 0,
  // Hotels (mobile)
  hotel_list_viewed: 0, hotel_search_started: 0, hotel_opened: 0,
  hotel_booking_started: 0, hotel_booking_completed: 0,
  hotel_gold_gate_shown: 0, hotel_gold_upgrade_tapped: 0, hotel_gold_gate_dismissed: 0,
};

const emptyStats = (): GA4Stats => ({
  activeUsers: 0, newUsers: 0, sessions: 0,
  activeUsers28d: 0, newUsers28d: 0, sessions28d: 0,
  activeUsers7d: 0, newUsers7d: 0, sessions7d: 0,
  activeUsersToday: 0,
  avgSessionDurationSecs: 0, bounceRate: 0, engagementRate: 0,
  topCountries: [], topPages: [], dauLast14d: [], deviceBreakdown: [],
  customEvents: { ...EMPTY_EVENTS },
  window: "7d",
  capturedAt: new Date().toISOString(),
  available: false,
});

const n = (v: string | null | undefined) => parseFloat(v ?? "0") || 0;

export async function getGA4Stats(win: Window = "7d"): Promise<GA4Stats> {
  const slot = _cache[win];
  if (slot && Date.now() - slot.ts < CACHE_TTL_MS) return slot.data;

  const client = getClient();
  if (!client) return { ...emptyStats(), window: win };

  try {
    const property = `properties/${PROPERTY_ID}`;
    const sd = startDate(win);    // dynamic start for the selected window
    const dauSd = dauStartDate(win);

    const [ovMain, td, countries, pages, dau, devices, eventsMain] = await Promise.all([
      // Primary window metrics (matches the filter the user selected)
      client.runReport({
        property,
        dateRanges: [{ startDate: sd, endDate: "today" }],
        metrics: [
          { name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" },
          { name: "averageSessionDuration" }, { name: "bounceRate" }, { name: "engagementRate" },
        ],
      }),
      // Today — always fixed reference
      client.runReport({
        property,
        dateRanges: [{ startDate: "today", endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      }),
      // Top countries — respects window
      client.runReport({
        property,
        dateRanges: [{ startDate: sd, endDate: "today" }],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 10,
      }),
      // Top pages — respects window
      client.runReport({
        property,
        dateRanges: [{ startDate: sd, endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 5,
      }),
      // DAU per-day — respects window
      client.runReport({
        property,
        dateRanges: [{ startDate: dauSd, endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      // Device breakdown — respects window
      client.runReport({
        property,
        dateRanges: [{ startDate: sd, endDate: "today" }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
      // All custom events — respects window (limit 200 to catch all events)
      client.runReport({
        property,
        dateRanges: [{ startDate: sd, endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        limit: 200,
      }),
    ]);

    const rMain = ovMain[0]?.rows?.[0]?.metricValues ?? [];
    const rTd   = td[0]?.rows?.[0]?.metricValues   ?? [];

    // Build event count map
    const eventMap: Record<string, number> = {};
    for (const row of eventsMain[0]?.rows ?? []) {
      const name  = row.dimensionValues?.[0]?.value ?? "";
      const count = n(row.metricValues?.[0]?.value);
      if (name) eventMap[name] = count;
    }
    const ev = (key: string) => eventMap[key] ?? 0;

    const customEvents: CustomEvents = {
      // Auth
      signed_up:               ev("signed_up"),
      logged_in:               ev("logged_in"),
      logout:                  ev("logout"),
      account_deleted:         ev("account_deleted"),
      otp_verified:            ev("otp_verified"),
      password_reset:          ev("password_reset"),
      profile_completed:       ev("profile_completed"),
      joined_nation:           ev("joined_nation"),
      switched_nation:         ev("switched_nation"),
      // Events
      event_list_viewed:       ev("event_list_viewed"),
      event_opened:            ev("event_opened"),
      event_rsvp:              ev("event_rsvp"),
      event_created:           ev("event_created"),
      event_not_attended:      ev("event_not_attended"),
      event_left:              ev("event_left"),
      event_edited:            ev("event_edited"),
      event_deleted:           ev("event_deleted"),
      // Housing
      housing_list_viewed:     ev("housing_list_viewed"),
      housing_opened:          ev("housing_opened"),
      housing_post_created:    ev("housing_post_created"),
      housing_contact_clicked: ev("housing_contact_clicked"),
      housing_saved:           ev("housing_saved"),
      housing_post_edited:     ev("housing_post_edited"),
      housing_post_deleted:    ev("housing_post_deleted"),
      housing_marked_booked:   ev("housing_marked_booked"),
      // Tickets
      ticket_board_viewed:     ev("ticket_board_viewed"),
      ticket_opened:           ev("ticket_opened"),
      ticket_post_created:     ev("ticket_post_created"),
      ticket_contact_clicked:  ev("ticket_contact_clicked"),
      ticket_post_edited:      ev("ticket_post_edited"),
      ticket_post_deleted:     ev("ticket_post_deleted"),
      transaction_amount_submitted: ev("transaction_amount_submitted"),
      // Reviews
      review_submitted:        ev("review_submitted"),
      review_dismissed:        ev("review_dismissed"),
      // Chat
      chat_opened:             ev("chat_opened"),
      message_sent:            ev("message_sent"),
      dm_started:              ev("dm_started"),
      dm_interest_sent:        ev("dm_interest_sent"),
      p2p_mode_started:        ev("p2p_mode_started"),
      // Social
      profile_viewed:          ev("profile_viewed"),
      friend_added:            ev("friend_added"),
      friend_rejected:         ev("friend_rejected"),
      friend_removed:          ev("friend_removed"),
      friend_blocked:          ev("friend_blocked"),
      badge_thrown:            ev("badge_thrown"),
      // Squads
      squad_builder_opened:    ev("squad_builder_opened"),
      squad_create_started:    ev("squad_create_started"),
      squad_created:           ev("squad_created"),
      squad_invite_accepted:   ev("squad_invite_accepted"),
      squad_invite_declined:   ev("squad_invite_declined"),
      squad_confirmed:         ev("squad_confirmed"),
      squad_left:              ev("squad_left"),
      squad_message_sent:      ev("squad_message_sent"),
      squad_size_changed:      ev("squad_size_changed"),
      // My Path
      my_path_started:         ev("my_path_started"),
      my_path_generated:       ev("my_path_generated"),
      my_path_saved:           ev("my_path_saved"),
      my_path_team_selected:   ev("my_path_team_selected"),
      my_path_group_size_selected: ev("my_path_group_size_selected"),
      my_path_airport_selected: ev("my_path_airport_selected"),
      my_path_housing_clicked: ev("my_path_housing_clicked"),
      my_path_tickets_clicked: ev("my_path_tickets_clicked"),
      my_path_events_clicked:  ev("my_path_events_clicked"),
      my_path_listing_opened:  ev("my_path_listing_opened"),
      multi_city_plan_created: ev("multi_city_plan_created"),
      trip_intent_set:         ev("trip_intent_set"),
      mypath_breakdown_parse_failed: ev("mypath_breakdown_parse_failed"),
      // Simulator
      simulator_opened:        ev("simulator_opened"),
      bracket_started:         ev("bracket_started"),
      bracket_saved:           ev("bracket_saved"),
      bracket_shared:          ev("bracket_shared"),
      draw_opened:             ev("draw_opened"),
      draw_randomized:         ev("draw_randomized"),
      draw_advanced_pot:       ev("draw_advanced_pot"),
      // Intel
      intel_feed_viewed:       ev("intel_feed_viewed"),
      intel_post_opened:       ev("intel_post_opened"),
      intel_post_engaged:      ev("intel_post_engaged"),
      intel_reacted:           ev("intel_reacted"),
      intel_commented:         ev("intel_commented"),
      intel_reposted:          ev("intel_reposted"),
      // Community
      post_reacted:            ev("post_reacted"),
      post_commented:          ev("post_commented"),
      post_comment_replied:    ev("post_comment_replied"),
      post_reposted:           ev("post_reposted"),
      post_saved:              ev("post_saved"),
      post_reported:           ev("post_reported"),
      post_deleted:            ev("post_deleted"),
      post_copied_link:        ev("post_copied_link"),
      post_notification_toggled: ev("post_notification_toggled"),
      // Monetization
      paywall_viewed:          ev("paywall_viewed"),
      purchase_started:        ev("purchase_started"),
      purchase_completed:      ev("purchase_completed"),
      purchase_cancelled:      ev("purchase_cancelled"),
      subscription_unlocked_feature_used: ev("subscription_unlocked_feature_used"),
      // Referrals
      referral_link_shared:    ev("referral_link_shared"),
      referral_reward_earned:  ev("referral_reward_earned"),
      // Filters
      listing_filter_applied:  ev("listing_filter_applied"),
      // PWA
      app_install_tapped:      ev("app_install_tapped"),
      push_notification_enabled: ev("push_notification_enabled"),
      // Community (mobile)
      post_created:            ev("post_created"),
      // Marketplace confirmations (mobile)
      ticket_confirmed:        ev("ticket_confirmed"),
      housing_confirmed:       ev("housing_confirmed"),
      // Match check-in (mobile)
      match_checkin:           ev("match_checkin"),
      // Hotels (mobile)
      hotel_list_viewed:         ev("hotel_list_viewed"),
      hotel_search_started:      ev("hotel_search_started"),
      hotel_opened:              ev("hotel_opened"),
      hotel_booking_started:     ev("hotel_booking_started"),
      hotel_booking_completed:   ev("hotel_booking_completed"),
      hotel_gold_gate_shown:     ev("hotel_gold_gate_shown"),
      hotel_gold_upgrade_tapped: ev("hotel_gold_upgrade_tapped"),
      hotel_gold_gate_dismissed: ev("hotel_gold_gate_dismissed"),
    };

    const stats: GA4Stats = {
      // Primary window values (reflect the selected filter)
      activeUsers:    n(rMain[0]?.value),
      newUsers:       n(rMain[1]?.value),
      sessions:       n(rMain[2]?.value),
      avgSessionDurationSecs: n(rMain[3]?.value),
      bounceRate:     parseFloat((n(rMain[4]?.value) * 100).toFixed(1)),
      engagementRate: parseFloat((n(rMain[5]?.value) * 100).toFixed(1)),
      // Backward-compat aliases — point to the same primary values
      activeUsers28d: n(rMain[0]?.value),
      newUsers28d:    n(rMain[1]?.value),
      sessions28d:    n(rMain[2]?.value),
      activeUsers7d:  n(rMain[0]?.value),
      newUsers7d:     n(rMain[1]?.value),
      sessions7d:     n(rMain[2]?.value),
      activeUsersToday: n(rTd[0]?.value),
      window: win,
      topCountries: (countries[0]?.rows ?? []).map(r => ({
        country: r.dimensionValues?.[0]?.value ?? "",
        users:   n(r.metricValues?.[0]?.value ?? "0"),
      })),
      topPages: (() => {
        // Collapse all /profile/* paths into a single "Profile" entry
        const raw = (pages[0]?.rows ?? []).map(r => ({
          page:  r.dimensionValues?.[0]?.value ?? "",
          views: n(r.metricValues?.[0]?.value ?? "0"),
        }));
        const merged: { page: string; views: number }[] = [];
        let profileTotal = 0;
        for (const p of raw) {
          if (p.page.startsWith("/profile/") || p.page === "/profile") {
            profileTotal += p.views;
          } else {
            merged.push(p);
          }
        }
        if (profileTotal > 0) {
          merged.push({ page: "/profile", views: profileTotal });
        }
        // Re-sort by views descending after merging, keep top 5
        return merged.sort((a, b) => b.views - a.views).slice(0, 5);
      })(),
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

    _cache[win] = { data: stats, ts: Date.now() };
    return stats;
  } catch (err) {
    console.error("[GA4] fetch failed:", err);
    return { ...emptyStats(), window: win };
  }
}

// ── Daily snapshot cache (separate from the windowed cache) ──────────────────
let _dailySnapshotCache: { data: DailySnapshotGA4; ts: number } | null = null;

export interface TrafficSource {
  source:   string;
  sessions: number;
  pct:      number;
}

export interface DailySnapshotGA4 {
  dau:                          { yesterday: number; day_before: number };
  mau:                          number;
  sessions:                     { yesterday: number; day_before: number };
  page_views:                   { yesterday: number; day_before: number };
  bounce_rate:                  { yesterday_pct: number; day_before_pct: number };
  avg_session_duration_seconds: { yesterday: number; day_before: number };
  traffic_sources_yesterday:    TrafficSource[];
  // GA4-native retention (returningUsers / activeUsers) across windows
  retention: {
    yesterday_pct:  number;
    day_before_pct: number;
    week_pct:       number;
    month_pct:      number;
  };
}

function emptyDailyGA4(): DailySnapshotGA4 {
  return {
    dau:                          { yesterday: 0, day_before: 0 },
    mau:                          0,
    sessions:                     { yesterday: 0, day_before: 0 },
    page_views:                   { yesterday: 0, day_before: 0 },
    bounce_rate:                  { yesterday_pct: 0, day_before_pct: 0 },
    avg_session_duration_seconds: { yesterday: 0, day_before: 0 },
    traffic_sources_yesterday:    [],
    retention: { yesterday_pct: 0, day_before_pct: 0, week_pct: 0, month_pct: 0 },
  };
}

/**
 * Fetches GA4 metrics shaped for the /api/daily-snapshot federation endpoint.
 * Returns yesterday vs day-before comparisons for all key metrics.
 * Results are cached for 10 minutes (stale data is fine for a daily digest).
 */
export async function getDailySnapshotGA4(): Promise<DailySnapshotGA4> {
  const CACHE_TTL = 10 * 60 * 1000;
  if (_dailySnapshotCache && Date.now() - _dailySnapshotCache.ts < CACHE_TTL) {
    return _dailySnapshotCache.data;
  }

  const client = getClient();
  if (!client) return emptyDailyGA4();

  try {
    const property = `properties/${PROPERTY_ID}`;

    // Two date ranges in one runReport call: yesterday and day_before
    const twoDay = {
      dateRanges: [
        { startDate: "yesterday", endDate: "yesterday", name: "yesterday"   },
        { startDate: "2daysAgo",  endDate: "2daysAgo",  name: "day_before"  },
      ],
    };

    // GA4 allows a max of 4 dateRanges per request.
    // Retention needs 5 windows, so we split into two calls (4 + 1).
    const [overview, sources, mau30, retPart1, retPart2] = await Promise.all([
      // Overview: activeUsers, sessions, screenPageViews, bounceRate, avgSessionDuration,
      //           newUsers, returningUsers
      client.runReport({
        property,
        ...twoDay,
        metrics: [
          { name: "activeUsers"            },  // [0]
          { name: "sessions"               },  // [1]
          { name: "screenPageViews"        },  // [2]
          { name: "bounceRate"             },  // [3]
          { name: "averageSessionDuration" },  // [4]
          { name: "newUsers"               },  // [5]
          { name: "returningUsers"         },  // [6]
        ],
      }),
      // Traffic sources — yesterday only
      client.runReport({
        property,
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        dimensions: [{ name: "sessionDefaultChannelGrouping" }],
        metrics:    [{ name: "sessions" }],
        orderBys:   [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      // MAU — active users over the past 30 days
      client.runReport({
        property,
        dateRanges: [{ startDate: "29daysAgo", endDate: "today" }],
        metrics:    [{ name: "activeUsers" }],
      }),
      // Retention windows 1-3: yesterday, day_before, week
      client.runReport({
        property,
        dateRanges: [
          { startDate: "yesterday",  endDate: "yesterday", name: "day1"  },
          { startDate: "2daysAgo",   endDate: "2daysAgo",  name: "day2"  },
          { startDate: "6daysAgo",   endDate: "today",     name: "week"  },
        ],
        metrics: [
          { name: "activeUsers"    },
          { name: "returningUsers" },
        ],
      }),
      // Retention window 5: month (separate call — GA4 cap of 4 ranges)
      client.runReport({
        property,
        dateRanges: [{ startDate: "29daysAgo", endDate: "today" }],
        metrics: [
          { name: "activeUsers"    },
          { name: "returningUsers" },
        ],
      }),
    ]);

    // overview returns two rows when two dateRanges are used — row index matches range index
    const row0 = overview[0]?.rows?.[0]?.metricValues ?? []; // yesterday
    const row1 = overview[0]?.rows?.[1]?.metricValues ?? []; // day_before

    const totalSourceSessions = (sources[0]?.rows ?? []).reduce(
      (s: number, r: any) => s + n(r.metricValues?.[0]?.value),
      0
    );

    const trafficSources: TrafficSource[] = (sources[0]?.rows ?? []).map((r: any) => {
      const sess = n(r.metricValues?.[0]?.value);
      return {
        source:   r.dimensionValues?.[0]?.value ?? "unknown",
        sessions: sess,
        pct:      totalSourceSessions > 0
          ? parseFloat(((sess / totalSourceSessions) * 100).toFixed(1))
          : 0,
      };
    });

    const data: DailySnapshotGA4 = {
      dau: {
        yesterday:  n(row0[0]?.value),
        day_before: n(row1[0]?.value),
      },
      mau: n(mau30[0]?.rows?.[0]?.metricValues?.[0]?.value),
      sessions: {
        yesterday:  n(row0[1]?.value),
        day_before: n(row1[1]?.value),
      },
      page_views: {
        yesterday:  n(row0[2]?.value),
        day_before: n(row1[2]?.value),
      },
      bounce_rate: {
        yesterday_pct:  parseFloat((n(row0[3]?.value) * 100).toFixed(2)),
        day_before_pct: parseFloat((n(row1[3]?.value) * 100).toFixed(2)),
      },
      avg_session_duration_seconds: {
        yesterday:  Math.round(n(row0[4]?.value)),
        day_before: Math.round(n(row1[4]?.value)),
      },
      traffic_sources_yesterday: trafficSources,
      // Retention: returningUsers / activeUsers per window — GA4 default metrics, no setup needed
      retention: (() => {
        function retPctFromRow(row: any): number {
          const active    = n(row?.metricValues?.[0]?.value);
          const returning = n(row?.metricValues?.[1]?.value);
          return active > 0 ? parseFloat((returning / active * 100).toFixed(1)) : 0;
        }
        // retPart1 rows: [yesterday, day_before, week]
        // retPart2 rows: [month]
        return {
          yesterday_pct:  retPctFromRow(retPart1[0]?.rows?.[0]),
          day_before_pct: retPctFromRow(retPart1[0]?.rows?.[1]),
          week_pct:       retPctFromRow(retPart1[0]?.rows?.[2]),
          month_pct:      retPctFromRow(retPart2[0]?.rows?.[0]),
        };
      })(),
    };

    _dailySnapshotCache = { data, ts: Date.now() };
    return data;
  } catch (err) {
    console.error("[GA4] daily snapshot fetch failed:", err);
    return emptyDailyGA4();
  }
}
