import mongoose from "mongoose";

import TTLCache from "@module/TTLCache";

/**
 * Site banners (公告橫幅, contract v4 §5.4): a slim message under the header.
 * The public site shows the newest non-removed banner whose window
 * (startAt ≤ now < endAt, endAt optional) includes now.
 *
 * Collection: `site-banner`. Indexes are built at startup by
 * @module/EnsureIndexes once a router imports this module.
 */

export const BANNER_LEVELS = ["info", "warning", "success"] as const;
export type BannerLevel = (typeof BANNER_LEVELS)[number];

export const BANNER_MESSAGE_MAX = 200;

const bannerSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    // "" (none), a site path ("/post/…") or an https URL
    link: { type: String, default: "" },
    level: { type: String, required: true, enum: BANNER_LEVELS },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    removed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// GET /site/banner and GET /admin/banners (newest first)
bannerSchema.index({ removed: 1, createdAt: -1, _id: -1 });

export const SiteBannerModel =
  (mongoose.models["site-banner"] as mongoose.Model<any>) ??
  mongoose.model("site-banner", bannerSchema, "site-banner");

const CACHE_MS = 60 * 1000;
// Banners that are showing or still to come; small (admins add a few).
const CANDIDATES = 50;
const cache = new TTLCache<any[]>(CACHE_MS, 1);

/** Whether the banner's window includes `now`. */
export function isLive(banner: any, now = Date.now()) {
  if (!banner || banner.removed) return false;
  const start = new Date(banner.startAt).getTime();
  const end = banner.endAt ? new Date(banner.endAt).getTime() : Infinity;
  return start <= now && now < end;
}

/**
 * The banner to show now, or null. The candidates (not removed, not ended)
 * are cached for 60 s; the window is checked on every call, so a banner
 * starts and ends on time.
 */
export async function currentBanner(now = Date.now()) {
  const candidates = await cache.getOrLoad("candidates", () =>
    SiteBannerModel.find({
      removed: false,
      $or: [{ endAt: null }, { endAt: { $gt: new Date() } }],
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(CANDIDATES)
      .lean()
      .exec(),
  );
  return candidates.find((banner) => isLive(banner, now)) ?? null;
}

/** After an admin change, so this replica shows it at once. */
export function clearBannerCache() {
  cache.clear();
}

/** The public shape (GET /site/banner). */
export function publicBanner(banner: any) {
  return {
    _id: String(banner._id),
    message: banner.message ?? "",
    link: banner.link ?? "",
    level: banner.level,
    startAt: banner.startAt ?? null,
    endAt: banner.endAt ?? null,
  };
}
