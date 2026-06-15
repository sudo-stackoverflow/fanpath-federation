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

export interface PlatformData {
  dau:                          { yesterday: number; day_before: number };
  mau:                          number;
  sessions:                     { yesterday: number; day_before: number };
  screen_views:                 { yesterday: number; day_before: number };
  bounce_rate:                  { yesterday_pct: number; day_before_pct: number };
  engagement_rate:              { yesterday_pct: number; day_before_pct: number };
  avg_session_duration_seconds: { yesterday: number; day_before: number };
  retention: {
    yesterday: { pct: number; returning: number; active: number };
    week:      { pct: number; returning: number; active: number };
    month:     { pct: number; returning: number; active: number };
  };
  traffic_sources: TrafficSource[];
}

export interface DailySnapshotGA4 {
  // Cumulative real-user totals since launch → yesterday (latest complete day)
  cumulative: {
    users:               number;
    sessions:            number;
    page_views:          number;
    bounce_rate_pct:     number;
    avg_session_seconds: number;
    since:               string;
    through:             string;
  };
  dau:                          { yesterday: number; day_before: number };
  mau:                          number;
  sessions:                     { yesterday: number; day_before: number };
  page_views:                   { yesterday: number; day_before: number };
  bounce_rate:                  { yesterday_pct: number; day_before_pct: number };
  avg_session_duration_seconds: { yesterday: number; day_before: number };
  traffic_sources_yesterday:    TrafficSource[];
  platforms:                    Record<string, PlatformData>;
  // GA4-native retention (returningUsers / activeUsers) across windows
  retention: {
    yesterday:  { pct: number; returning: number; active: number };
    day_before: { pct: number; returning: number; active: number };
    week:       { pct: number; returning: number; active: number };
    month:      { pct: number; returning: number; active: number };
  };
}

function emptyDailyGA4(): DailySnapshotGA4 {
  return {
    cumulative: {
      users: 0, sessions: 0, page_views: 0, bounce_rate_pct: 0,
      avg_session_seconds: 0, since: "", through: "",
    },
    dau:                          { yesterday: 0, day_before: 0 },
    mau:                          0,
    sessions:                     { yesterday: 0, day_before: 0 },
    page_views:                   { yesterday: 0, day_before: 0 },
    bounce_rate:                  { yesterday_pct: 0, day_before_pct: 0 },
    avg_session_duration_seconds: { yesterday: 0, day_before: 0 },
    traffic_sources_yesterday:    [],
    platforms:                    {},
    retention: {
      yesterday:  { pct: 0, returning: 0, active: 0 },
      day_before: { pct: 0, returning: 0, active: 0 },
      week:       { pct: 0, returning: 0, active: 0 },
      month:      { pct: 0, returning: 0, active: 0 },
    },
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
  if (!client) {
    console.error("[GA4] daily snapshot: client is null — check GA4_PROPERTY_ID / GA4_CLIENT_EMAIL / GA4_PRIVATE_KEY env vars");
    return emptyDailyGA4();
  }

  try {
    const property = `properties/${PROPERTY_ID}`;
    const METRICS_OVERVIEW = [
      { name: "activeUsers"            },
      { name: "sessions"               },
      { name: "screenPageViews"        },
      { name: "bounceRate"             },
      { name: "averageSessionDuration" },
    ];

    // Real users only — every snapshot query is filtered to sessions where
    // setUserId() fired (signedInWithUserId = "yes"), so the digest reflects
    // actual logged-in humans, not the anonymous/bot traffic that dominates
    // unfiltered GA. Injected centrally so all 12 reports below inherit it.
    const REAL_USER_FILTER = {
      filter: { fieldName: "signedInWithUserId", stringFilter: { value: "yes" } },
    };
    // Use separate single-dateRange calls — avoids any ambiguity in multi-range row ordering
    const safe = async (label: string, req: any) => {
      try {
        return await client.runReport({ dimensionFilter: REAL_USER_FILTER, ...req });
      } catch (e: any) {
        console.error(`[GA4] daily snapshot — "${label}" failed:`, e?.message ?? e);
        return [{ rows: [] }];
      }
    };

    const PLATFORM_METRICS = [
      { name: "activeUsers" },
      { name: "newUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "bounceRate" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
    ];

    // App launch — start of the cumulative "All platforms" window.
    const LAUNCH_DATE = "2026-04-13";

    // ── Pick the latest *settled* day ────────────────────────────────────────
    // GA's most-recent day is still collecting, so reporting it shows false
    // drops every morning. Find the latest date with data (all traffic), then
    // report the day BEFORE it (guaranteed complete) vs the day before that.
    // e.g. latest-with-data = Jun 14 → report Jun 13 vs Jun 12.
    const ymd = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const shift = (base: Date, days: number) => { const d = new Date(base); d.setUTCDate(d.getUTCDate() + days); return d; };

    let latestWithData: Date | null = null;
    try {
      const fresh = await client.runReport({
        property,
        dateRanges: [{ startDate: "5daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "eventCount" }],
      });
      const dates = (fresh[0]?.rows ?? [])
        .map((r: any) => r.dimensionValues?.[0]?.value as string)
        .filter((v: string) => v && /^\d{8}$/.test(v))
        .sort();
      const last = dates[dates.length - 1];
      if (last) latestWithData = new Date(Date.UTC(+last.slice(0, 4), +last.slice(4, 6) - 1, +last.slice(6, 8)));
    } catch (e: any) {
      console.error("[GA4] freshness probe failed:", e?.message ?? e);
    }
    // Fallback: if the probe failed, assume today is the still-collecting edge.
    const latest = latestWithData ?? new Date();
    const REPORT      = ymd(shift(latest, -1));   // latest settled day (digest "yesterday")
    const COMPARE     = ymd(shift(latest, -2));   // the day before that (digest "day_before")
    const MONTH_START = ymd(shift(latest, -30));  // 30-day window ending at REPORT
    const WEEK_START  = ymd(shift(latest, -7));   // 7-day window ending at REPORT

    const [yest, dayBefore, sources, mau30, retWeek, retMonth,
           platYest, platDayBefore, platMau, platRetWeek, platRetMonth, platSources, cumulativeRes] = await Promise.all([
      safe("yest",      { property, dateRanges: [{ startDate: REPORT,  endDate: REPORT  }], metrics: METRICS_OVERVIEW }),
      safe("dayBefore", { property, dateRanges: [{ startDate: COMPARE, endDate: COMPARE }], metrics: METRICS_OVERVIEW }),
      safe("sources",   {
        property,
        dateRanges: [{ startDate: REPORT, endDate: REPORT }],
        dimensions: [{ name: "sessionDefaultChannelGrouping" }],
        metrics:    [{ name: "sessions" }],
        orderBys:   [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      safe("mau30",    { property, dateRanges: [{ startDate: MONTH_START, endDate: REPORT }], metrics: [{ name: "activeUsers" }] }),
      safe("retWeek",  { property, dateRanges: [{ startDate: WEEK_START,  endDate: REPORT }], metrics: [{ name: "activeUsers" }, { name: "newUsers" }] }),
      safe("retMonth", { property, dateRanges: [{ startDate: MONTH_START, endDate: REPORT }], metrics: [{ name: "activeUsers" }, { name: "newUsers" }] }),
      // Per-platform queries
      safe("platYest",      { property, dateRanges: [{ startDate: REPORT,  endDate: REPORT  }], dimensions: [{ name: "platform" }], metrics: PLATFORM_METRICS }),
      safe("platDayBefore", { property, dateRanges: [{ startDate: COMPARE, endDate: COMPARE }], dimensions: [{ name: "platform" }], metrics: PLATFORM_METRICS }),
      safe("platMau",       { property, dateRanges: [{ startDate: MONTH_START, endDate: REPORT }], dimensions: [{ name: "platform" }], metrics: [{ name: "activeUsers" }] }),
      safe("platRetWeek",   { property, dateRanges: [{ startDate: WEEK_START,  endDate: REPORT }], dimensions: [{ name: "platform" }], metrics: [{ name: "activeUsers" }, { name: "newUsers" }] }),
      safe("platRetMonth",  { property, dateRanges: [{ startDate: MONTH_START, endDate: REPORT }], dimensions: [{ name: "platform" }], metrics: [{ name: "activeUsers" }, { name: "newUsers" }] }),
      safe("platSources",   {
        property,
        dateRanges: [{ startDate: REPORT, endDate: REPORT }],
        dimensions: [{ name: "platform" }, { name: "sessionDefaultChannelGrouping" }],
        metrics:    [{ name: "sessions" }],
        orderBys:   [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 50,
      }),
      // Cumulative "All platforms" totals since launch → REPORT (latest settled day)
      safe("cumulative",    { property, dateRanges: [{ startDate: LAUNCH_DATE, endDate: REPORT }], metrics: METRICS_OVERVIEW }),
    ]);

    const mv0 = (res: any) => res[0]?.rows?.[0]?.metricValues ?? [];
    const row0 = mv0(yest);      // yesterday metrics
    const row1 = mv0(dayBefore); // day-before metrics

    const totalSourceSessions = (sources[0]?.rows ?? []).reduce(
      (s: number, r: any) => s + n(r.metricValues?.[0]?.value), 0
    );
    const trafficSources: TrafficSource[] = (sources[0]?.rows ?? []).map((r: any) => {
      const sess = n(r.metricValues?.[0]?.value);
      return {
        source:   r.dimensionValues?.[0]?.value ?? "unknown",
        sessions: sess,
        pct:      totalSourceSessions > 0 ? parseFloat(((sess / totalSourceSessions) * 100).toFixed(1)) : 0,
      };
    });

    // retention = (activeUsers - newUsers) / activeUsers — avoids returningUsers metric
    // which is not available on all GA4 property types
    function retData(res: any): { pct: number; returning: number; active: number } {
      const r         = res[0]?.rows?.[0];
      const active    = n(r?.metricValues?.[0]?.value);
      const newU      = n(r?.metricValues?.[1]?.value);
      const returning = Math.max(0, Math.round(active - newU));
      const pct       = active > 0 ? parseFloat((returning / active * 100).toFixed(1)) : 0;
      return { pct, returning, active: Math.round(active) };
    }

    // Build per-platform lookup maps
    const platYestMap: Record<string, any[]> = {};
    for (const row of platYest[0]?.rows ?? []) {
      const p = row.dimensionValues?.[0]?.value ?? "unknown";
      platYestMap[p] = row.metricValues ?? [];
    }
    const platDayBeforeMap: Record<string, any[]> = {};
    for (const row of platDayBefore[0]?.rows ?? []) {
      const p = row.dimensionValues?.[0]?.value ?? "unknown";
      platDayBeforeMap[p] = row.metricValues ?? [];
    }
    const platMauMap: Record<string, number> = {};
    for (const row of platMau[0]?.rows ?? []) {
      const p = row.dimensionValues?.[0]?.value ?? "unknown";
      platMauMap[p] = Math.round(n(row.metricValues?.[0]?.value));
    }
    const platRetWeekMap: Record<string, any[]> = {};
    for (const row of platRetWeek[0]?.rows ?? []) {
      const p = row.dimensionValues?.[0]?.value ?? "unknown";
      platRetWeekMap[p] = row.metricValues ?? [];
    }
    const platRetMonthMap: Record<string, any[]> = {};
    for (const row of platRetMonth[0]?.rows ?? []) {
      const p = row.dimensionValues?.[0]?.value ?? "unknown";
      platRetMonthMap[p] = row.metricValues ?? [];
    }
    const platSourcesMap: Record<string, { source: string; sessions: number }[]> = {};
    for (const row of platSources[0]?.rows ?? []) {
      const p    = row.dimensionValues?.[0]?.value ?? "unknown";
      const src  = row.dimensionValues?.[1]?.value ?? "unknown";
      const sess = Math.round(n(row.metricValues?.[0]?.value));
      if (!platSourcesMap[p]) platSourcesMap[p] = [];
      platSourcesMap[p].push({ source: src, sessions: sess });
    }

    const allPlatforms = new Set([
      ...Object.keys(platYestMap),
      ...Object.keys(platDayBeforeMap),
    ]);

    const platforms: Record<string, PlatformData> = {};
    for (const p of allPlatforms) {
      const y  = platYestMap[p]      ?? [];
      const db = platDayBeforeMap[p] ?? [];
      const rw = platRetWeekMap[p]   ?? [];
      const rm = platRetMonthMap[p]  ?? [];

      const aktYest = n(y[0]?.value); const newYest = n(y[1]?.value);
      const aktDb   = n(db[0]?.value); const newDb   = n(db[1]?.value);
      const aktRw   = n(rw[0]?.value); const newRw   = n(rw[1]?.value);
      const aktRm   = n(rm[0]?.value); const newRm   = n(rm[1]?.value);

      function ret(active: number, newU: number) {
        const returning = Math.max(0, Math.round(active - newU));
        return { pct: active > 0 ? parseFloat((returning / active * 100).toFixed(1)) : 0, returning, active: Math.round(active) };
      }

      const srcList = platSourcesMap[p] ?? [];
      const totalSrc = srcList.reduce((s, r) => s + r.sessions, 0);
      const traffic: TrafficSource[] = srcList.map(r => ({
        source: r.source,
        sessions: r.sessions,
        pct: totalSrc > 0 ? parseFloat(((r.sessions / totalSrc) * 100).toFixed(1)) : 0,
      }));

      platforms[p] = {
        dau:                          { yesterday: Math.round(aktYest), day_before: Math.round(aktDb) },
        mau:                          platMauMap[p] ?? 0,
        sessions:                     { yesterday: Math.round(n(y[2]?.value)), day_before: Math.round(n(db[2]?.value)) },
        screen_views:                 { yesterday: Math.round(n(y[3]?.value)), day_before: Math.round(n(db[3]?.value)) },
        bounce_rate:                  { yesterday_pct: parseFloat((n(y[4]?.value) * 100).toFixed(2)), day_before_pct: parseFloat((n(db[4]?.value) * 100).toFixed(2)) },
        engagement_rate:              { yesterday_pct: parseFloat((n(y[5]?.value) * 100).toFixed(2)), day_before_pct: parseFloat((n(db[5]?.value) * 100).toFixed(2)) },
        avg_session_duration_seconds: { yesterday: Math.round(n(y[6]?.value)), day_before: Math.round(n(db[6]?.value)) },
        retention: {
          yesterday: ret(aktYest, newYest),
          week:      ret(aktRw,   newRw),
          month:     ret(aktRm,   newRm),
        },
        traffic_sources: traffic,
      };
    }

    const cRow = mv0(cumulativeRes);

    const data: DailySnapshotGA4 = {
      cumulative: {
        users:               Math.round(n(cRow[0]?.value)),
        sessions:            Math.round(n(cRow[1]?.value)),
        page_views:          Math.round(n(cRow[2]?.value)),
        bounce_rate_pct:     parseFloat((n(cRow[3]?.value) * 100).toFixed(2)),
        avg_session_seconds: Math.round(n(cRow[4]?.value)),
        since:               LAUNCH_DATE,
        through:             REPORT,
      },
      dau:         { yesterday: n(row0[0]?.value),  day_before: n(row1[0]?.value) },
      mau:         n(mau30[0]?.rows?.[0]?.metricValues?.[0]?.value),
      sessions:    { yesterday: n(row0[1]?.value),  day_before: n(row1[1]?.value) },
      page_views:  { yesterday: n(row0[2]?.value),  day_before: n(row1[2]?.value) },
      bounce_rate: {
        yesterday_pct:  parseFloat((n(row0[3]?.value) * 100).toFixed(2)),
        day_before_pct: parseFloat((n(row1[3]?.value) * 100).toFixed(2)),
      },
      avg_session_duration_seconds: {
        yesterday:  Math.round(n(row0[4]?.value)),
        day_before: Math.round(n(row1[4]?.value)),
      },
      traffic_sources_yesterday: trafficSources,
      platforms,
      retention: {
        yesterday:  retData(yest),
        day_before: retData(dayBefore),
        week:       retData(retWeek),
        month:      retData(retMonth),
      },
    };

    _dailySnapshotCache = { data, ts: Date.now() };
    return data;
  } catch (err: any) {
    console.error("[GA4] daily snapshot fetch failed:", err);
    return emptyDailyGA4();
  }
}
