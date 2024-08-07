import { rateLimit } from "express-rate-limit";


export function rateLimiter(option: RateLimiterOption) {
  switch (option) {
    case "1m_100req":
      return rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 10,
        message: "Too many requests, please try again later."
      });

    case "1m_200req":
      return rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 20,
        message: "Too many requests, please try again later."
      });

    case "1m_1200req":
      return rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 600,
        message: "Too many requests, please try again later."
      });

    default:
      return rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 60,
        message: "Too many requests, please try again later."
      });
  }
}

export enum RateLimiterOption {
    _1m_100req = "1m_100req",
    _1m_200req = "1m_200req",
    _1m_1200req = "1m_1200req",
}
