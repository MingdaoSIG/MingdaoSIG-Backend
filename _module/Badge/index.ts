import mongoose from "mongoose";

import TTLCache from "@module/TTLCache";

/**
 * Profile badges (API contract v4 §5.9). They used to be a fixed list (the
 * user schema enum and the frontend's app/[userID]/(User)/config/badge.ts);
 * now admins manage them in the `badge` collection. `user.badge` holds
 * badge keys. Retiring a badge (`removed`) hides it from GET /badge/list
 * and from new assignments; users who have it keep it.
 *
 * Collection: `badge`. Indexes are built at startup by @module/EnsureIndexes
 * once a router imports this module.
 */

export const BADGE_KEY_PATTERN = /^[a-z0-9_.-]{1,30}$/;
export const BADGE_NAME_MAX_LENGTH = 20;
export const BADGE_DESCRIPTION_MAX_LENGTH = 100;

const badgeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    // Image id (GET /image/:id), set by an admin.
    icon: { type: String, default: "" },
    // Frontend path of a seeded badge's icon (public/badges/*.svg); used
    // while `icon` is empty.
    iconPath: { type: String, default: "" },
    // "#rrggbb" or "".
    color: { type: String, default: "" },
    removed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

badgeSchema.index({ key: 1 }, { unique: true });

export const BadgeModel =
  (mongoose.models.badge as mongoose.Model<any>) ??
  mongoose.model("badge", badgeSchema, "badge");

/**
 * The badges of the old fixed list, from the frontend's badge.ts: `name` is
 * its `content` (the label it showed) and the icon stays the frontend file.
 * "10/21 Event Participant" is longer than the 20 characters admins may
 * type; it is kept as it was shown.
 */
export const SEED_BADGES = [
  {
    key: "developer",
    name: "Developer",
    iconPath: "/badges/developer.svg",
  },
  {
    key: "10.21_user",
    name: "10/21 Event Participant",
    iconPath: "/badges/10.21_user.svg",
  },
  {
    key: "bug_hunter",
    name: "Bug Hunter",
    iconPath: "/badges/bug_hunter.svg",
  },
] as const;

/**
 * Inserts the seed badges that are missing. Idempotent and safe on every
 * startup: an existing badge (edited or retired by an admin) is never
 * changed. Logs what it inserted.
 */
export async function seedBadges() {
  let inserted = 0;
  for (const seed of SEED_BADGES) {
    try {
      const result = await BadgeModel.updateOne(
        { key: seed.key },
        {
          $setOnInsert: {
            name: seed.name,
            iconPath: seed.iconPath,
            description: "",
            icon: "",
            color: "",
            removed: false,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) {
        inserted++;
        console.log(`Badge : seeded ${seed.key}`);
      }
    } catch (error: any) {
      // Another process inserted it first (unique key).
      if (error?.code !== 11000) throw error;
    }
  }
  console.log(
    `Badge : seed done (${inserted} inserted, ${SEED_BADGES.length - inserted} already there)`,
  );
  if (inserted > 0) clearBadgeCache();
  return { inserted };
}

export type BadgeItem = {
  _id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  iconPath: string;
  color: string;
  removed: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export function toBadgeItem(doc: any): BadgeItem {
  return {
    _id: String(doc._id),
    key: doc.key ?? "",
    name: doc.name ?? "",
    description: doc.description ?? "",
    icon: doc.icon ?? "",
    iconPath: doc.iconPath ?? "",
    color: doc.color ?? "",
    removed: Boolean(doc.removed),
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

const LIST_CACHE_MS = 60 * 1000;
const listCache = new TTLCache<BadgeItem[]>(LIST_CACHE_MS, 1);

/** Badges that are not retired, oldest first (cached for 60 s). */
export function listActiveBadges() {
  return listCache.getOrLoad("active", async () =>
    (
      await BadgeModel.find({ removed: { $ne: true } })
        .sort({ createdAt: 1, _id: 1 })
        .lean()
    ).map(toBadgeItem),
  );
}

/** After an admin change: GET /badge/list reads the collection again. */
export function clearBadgeCache() {
  listCache.clear();
}

/** Every badge, retired ones included, oldest first. */
export async function listAllBadges() {
  return (await BadgeModel.find({}).sort({ createdAt: 1, _id: 1 }).lean()).map(
    toBadgeItem,
  );
}

/** Keys of the badges that are not retired, and of all badges. */
export async function badgeKeys() {
  const docs = await BadgeModel.find({}, { key: 1, removed: 1 }).lean();
  return {
    active: new Set(docs.filter((doc) => !doc.removed).map((doc) => doc.key)),
    all: new Set(docs.map((doc) => doc.key)),
  };
}
