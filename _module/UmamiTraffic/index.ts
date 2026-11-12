import { Pool } from "pg";

import TTLCache from "@module/TTLCache";

/**
 * Site traffic from Umami (contract v4 §5.10), read straight from Umami's
 * Postgres database through a read-only role.
 *
 * - Enabled only when UMAMI_DATABASE_URL and UMAMI_WEBSITE_ID (the website's
 *   uuid) are set; otherwise /admin/traffic answers 503/5000.
 * - The queries follow Umami 3.1's own relational queries
 *   (src/queries/sql/getWebsiteStats.ts, pageviews/getPageviewStats.ts,
 *   sessions/getSessionStats.ts, pageviews/getPageviewMetrics.ts) on its
 *   `website_event` table (prisma/schema.prisma, migrations 01–19): page
 *   views are events whose event_type is not 2 (custom event) or 5
 *   (performance); visitors are distinct session_id; visits distinct
 *   visit_id.
 * - Days are Asia/Taipei. Results are cached for 10 minutes per range.
 * - The connection string is never logged.
 */

export const TRAFFIC_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type TrafficRange = keyof typeof TRAFFIC_RANGES;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOP_ITEMS = 10;
const TAIPEI_OFFSET = "+08:00"; // Asia/Taipei has no daylight saving time
const DAY_MS = 24 * 60 * 60 * 1000;

type Config =
  | { enabled: true; url: string; websiteId: string }
  | { enabled: false };
let config: Config | undefined;
let pool: Pool | undefined;

/**
 * Read once on first use (the routers load before index.ts reads .env, so
 * not at import time).
 */
export function umamiConfig(): Config {
  if (config) return config;

  const url = process.env.UMAMI_DATABASE_URL?.trim();
  const websiteId = process.env.UMAMI_WEBSITE_ID?.trim();
  if (!url || !websiteId) {
    config = { enabled: false };
  } else if (!UUID.test(websiteId)) {
    console.warn(
      "Traffic : UMAMI_WEBSITE_ID is not a uuid, /admin/traffic is disabled",
    );
    config = { enabled: false };
  } else {
    config = { enabled: true, url, websiteId: websiteId.toLowerCase() };
  }
  return config;
}

function umamiPool(url: string) {
  if (pool) return pool;
  pool = new Pool({
    connectionString: url,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    query_timeout: 20_000,
    application_name: "mdsig-backend",
    // Belt and braces next to the read-only role.
    options: "-c default_transaction_read_only=on",
  });
  pool.on("error", (error) => {
    console.error(`Traffic : idle Umami connection failed: ${error.message}`);
  });
  return pool;
}

/** Closes the connections (graceful shutdown). */
export async function closeUmami() {
  const current = pool;
  pool = undefined;
  await current?.end();
}

const TAIPEI_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" in Asia/Taipei. */
export function taipeiDate(date: Date) {
  return TAIPEI_DATE.format(date);
}

/** The Taipei days of the range, oldest first, ending today. */
export function rangeDays(days: number, now = new Date()) {
  const today = new Date(`${taipeiDate(now)}T00:00:00${TAIPEI_OFFSET}`);
  return Array.from({ length: days }, (_, index) =>
    taipeiDate(new Date(today.getTime() - (days - 1 - index) * DAY_MS)),
  );
}

// $1 website id, $2 start (inclusive), $3 end (inclusive), like Umami.
const WHERE = `
  where website_id = $1::uuid
    and created_at between $2 and $3
    and event_type not in (2, 5)`;

const TOTALS_SQL = `
  select count(*)::int as pageviews,
         count(distinct session_id)::int as visitors,
         count(distinct visit_id)::int as visits
  from website_event ${WHERE}`;

const SERIES_SQL = `
  select to_char(created_at at time zone 'Asia/Taipei', 'YYYY-MM-DD') as date,
         count(*)::int as pageviews,
         count(distinct session_id)::int as visitors
  from website_event ${WHERE}
  group by 1
  order by 1`;

const TOP_PAGES_SQL = `
  select url_path as path, count(*)::int as views
  from website_event ${WHERE}
    and url_path <> ''
  group by 1
  order by 2 desc, 1
  limit ${TOP_ITEMS}`;

// Umami leaves out empty referrers and the site's own host (without www.).
const TOP_REFERRERS_SQL = `
  select referrer_domain as referrer, count(distinct visit_id)::int as visits
  from website_event ${WHERE}
    and referrer_domain is not null
    and referrer_domain <> ''
    and referrer_domain <> regexp_replace(coalesce(hostname, ''), '^www\\.', '')
  group by 1
  order by 2 desc, 1
  limit ${TOP_ITEMS}`;

export type Traffic = {
  range: TrafficRange;
  pageviews: number;
  visitors: number;
  visits: number;
  series: { date: string; pageviews: number; visitors: number }[];
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; visits: number }[];
};

async function queryTraffic(
  range: TrafficRange,
  url: string,
  websiteId: string,
): Promise<Traffic> {
  const now = new Date();
  const days = rangeDays(TRAFFIC_RANGES[range], now);
  const start = new Date(`${days[0]}T00:00:00${TAIPEI_OFFSET}`);
  const params = [websiteId, start, now];

  const db = umamiPool(url);
  const [totals, series, pages, referrers] = await Promise.all([
    db.query(TOTALS_SQL, params),
    db.query(SERIES_SQL, params),
    db.query(TOP_PAGES_SQL, params),
    db.query(TOP_REFERRERS_SQL, params),
  ]);

  const byDate = new Map(series.rows.map((row) => [row.date, row]));
  return {
    range,
    pageviews: totals.rows[0]?.pageviews ?? 0,
    visitors: totals.rows[0]?.visitors ?? 0,
    visits: totals.rows[0]?.visits ?? 0,
    series: days.map((date) => ({
      date,
      pageviews: byDate.get(date)?.pageviews ?? 0,
      visitors: byDate.get(date)?.visitors ?? 0,
    })),
    topPages: pages.rows.map((row) => ({ path: row.path, views: row.views })),
    topReferrers: referrers.rows.map((row) => ({
      referrer: row.referrer,
      visits: row.visits,
    })),
  };
}

const cache = new TTLCache<Traffic>(10 * 60 * 1000, 3);

/** Throws when Umami is not configured; check umamiConfig() first. */
export function loadTraffic(range: TrafficRange) {
  const current = umamiConfig();
  if (!current.enabled) throw new Error("Umami is not configured");
  return cache.getOrLoad(range, () =>
    queryTraffic(range, current.url, current.websiteId),
  );
}
