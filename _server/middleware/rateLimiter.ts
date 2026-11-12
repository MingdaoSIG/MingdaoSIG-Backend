import { NextFunction, Request, RequestHandler, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import jwt, { Secret } from "jsonwebtoken";

import { HttpStatus } from "@module/HttpStatusCode";
import { CustomCode, CustomStatus } from "@module/CustomStatusCode";

const WINDOW_MS = 60 * 1000;

// Requests per minute for each tier. Each tier can be raised or lowered with
// an optional env var (read lazily, because .env is loaded after the routers).
const TIER_LIMITS = {
  read: { max: 300, env: "RATE_LIMIT_READ_PER_MIN" },
  write: { max: 60, env: "RATE_LIMIT_WRITE_PER_MIN" },
  upload: { max: 30, env: "RATE_LIMIT_UPLOAD_PER_MIN" },
  login: { max: 120, env: "RATE_LIMIT_LOGIN_PER_MIN" },
} as const;

type Tier = keyof typeof TIER_LIMITS;

function tierLimit(tier: Tier) {
  const { max, env } = TIER_LIMITS[tier];
  const override = Number(process.env[env]);
  return Number.isInteger(override) && override > 0 ? override : max;
}

function userIdFromJwt(req: Request): string | null {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const decoded = jwt.verify(
      authHeader.replace("Bearer ", ""),
      process.env.JWT_SECRET as Secret,
      { algorithms: ["HS256"] },
    );
    if (typeof decoded === "string" || typeof decoded.id !== "string") {
      return null;
    }
    return decoded.id;
  } catch {
    return null;
  }
}

// IPv4 addresses are used as they are. IPv6 addresses are grouped by /56
// (express-rate-limit's default), so a client cannot get a fresh budget by
// rotating addresses inside its own prefix.
function clientIp(req: Request) {
  return ipKeyGenerator(req.ip ?? "");
}

function keyByUserOrIp(req: Request) {
  const userId = userIdFromJwt(req);
  return userId ? `user:${userId}` : `ip:${clientIp(req)}`;
}

function keyByIp(req: Request) {
  return `ip:${clientIp(req)}`;
}

function tooManyRequests(_: Request, res: Response) {
  res.status(HttpStatus.TOO_MANY_REQUESTS).json({
    status: CustomStatus.TOO_MANY_REQUESTS,
    message: CustomCode[CustomStatus.TOO_MANY_REQUESTS],
  });
}

function createLimiter(
  limit: number | (() => number),
  keyGenerator: (req: Request) => string,
) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: tooManyRequests,
  });
}

// One shared limiter per tier, so a key's budget covers every route in the
// tier instead of resetting per router.
const readLimiter = createLimiter(() => tierLimit("read"), keyByUserOrIp);
const writeLimiter = createLimiter(() => tierLimit("write"), keyByUserOrIp);
const uploadLimiter = createLimiter(() => tierLimit("upload"), keyByUserOrIp);
const loginLimiter = createLimiter(() => tierLimit("login"), keyByIp);

function byMethodLimiter(req: Request, res: Response, next: NextFunction) {
  const limiter =
    req.method === "GET" || req.method === "HEAD" ? readLimiter : writeLimiter;
  return limiter(req, res, next);
}

export function rateLimiter(option: RateLimiterOption): RequestHandler {
  switch (option) {
    case RateLimiterOption.READ:
      return readLimiter;

    case RateLimiterOption.WRITE:
      return writeLimiter;

    case RateLimiterOption.BY_METHOD:
      return byMethodLimiter;

    case RateLimiterOption.UPLOAD:
      return uploadLimiter;

    case RateLimiterOption.LOGIN:
      return loginLimiter;

    case RateLimiterOption._1m_100req:
      return createLimiter(100, keyByUserOrIp);

    case RateLimiterOption._1m_200req:
      return createLimiter(200, keyByUserOrIp);

    case RateLimiterOption._1m_1200req:
      return createLimiter(1200, keyByUserOrIp);

    default:
      return createLimiter(60, keyByUserOrIp);
  }
}

export enum RateLimiterOption {
  // 300 requests per minute per user (or IP when there is no valid JWT)
  READ = "read",
  // 60 requests per minute per user (or IP)
  WRITE = "write",
  // READ for GET/HEAD, WRITE for every other method
  BY_METHOD = "byMethod",
  // 30 image uploads per minute per user (or IP)
  UPLOAD = "upload",
  // 120 requests per minute per IP
  LOGIN = "login",
  _1m_100req = "1m_100req",
  _1m_200req = "1m_200req",
  _1m_1200req = "1m_1200req",
}
