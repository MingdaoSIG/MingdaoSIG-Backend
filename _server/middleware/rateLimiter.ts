import { rateLimit } from "express-rate-limit";


type limiterOption = "1m_10req" | "1m_20req" | "1m_600req" | undefined;
export default function rateLimiter(option: limiterOption) {
    switch (option) {
        case "1m_10req":
            return rateLimit({
                windowMs: 1 * 60 * 1000,
                max: 10,
                message: "Too many requests, please try again later."
            });

        case "1m_20req":
            return rateLimit({
                windowMs: 1 * 60 * 1000,
                max: 20,
                message: "Too many requests, please try again later."
            });

        case "1m_600req":
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
