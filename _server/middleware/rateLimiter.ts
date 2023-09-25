import { rateLimit } from "express-rate-limit";


const limiter_1m_10req = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: "Too many requests, please try again later."
});

const limiter_1m_20req = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    message: "Too many requests, please try again later."
});

export default {
    limiter_1m_10req,
    limiter_1m_20req
};