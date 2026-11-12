import { createHash } from "node:crypto";
import mongoose from "mongoose";

/**
 * Login log (contract v4 §5.3): one entry per successful /login. The IP is
 * stored only as sha256(ip + JWT_SECRET), so entries from the same address
 * can be compared without keeping the address. Entries expire after 180
 * days (TTL index). Writing never fails the login: errors are logged and
 * swallowed.
 *
 * Collection: `login-log`. Indexes are built at startup by
 * @module/EnsureIndexes once a router imports this module.
 */

export const LOGIN_METHODS = ["google", "session"] as const;
export type LoginMethod = (typeof LOGIN_METHODS)[number];

const USER_AGENT_MAX = 200;
const TTL_SECONDS = 180 * 24 * 60 * 60;

const loginLogSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    method: { type: String, required: true, enum: LOGIN_METHODS },
    ipHash: { type: String, required: true },
    userAgent: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Expiry, and GET /admin/logins (newest first).
loginLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });
// GET /admin/users/:id/logins
loginLogSchema.index({ user: 1, createdAt: -1, _id: -1 });

export const LoginLogModel =
  (mongoose.models["login-log"] as mongoose.Model<any>) ??
  mongoose.model("login-log", loginLogSchema, "login-log");

export function hashIp(ip: string) {
  return createHash("sha256")
    .update(`${ip}${process.env.JWT_SECRET ?? ""}`)
    .digest("hex");
}

/** Records a successful login. Never throws. */
export async function recordLogin(entry: {
  user: string;
  method: LoginMethod;
  ip: string | undefined;
  userAgent: string | undefined;
}) {
  try {
    await LoginLogModel.create({
      user: entry.user,
      method: entry.method,
      ipHash: hashIp(entry.ip ?? ""),
      userAgent: Array.from(entry.userAgent ?? "")
        .slice(0, USER_AGENT_MAX)
        .join(""),
    });
  } catch (error) {
    console.error(
      "LoginLog : failed to record a login:",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Newest first, with the total for the same filter. */
export async function listLogins(
  filter: { user?: string },
  option: { skip: number; limit: number },
) {
  const query = filter.user ? { user: filter.user } : {};
  const [data, total] = await Promise.all([
    LoginLogModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(option.skip)
      .limit(option.limit)
      .lean(),
    LoginLogModel.countDocuments(query),
  ]);
  return { data: data as any[], total };
}
