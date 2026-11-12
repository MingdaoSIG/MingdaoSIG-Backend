import { Request, Response, NextFunction } from "express";
import cors from "cors";

const config = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://sig.zeabur.app",
    "https://sig-dev.zeabur.app",
    "https://sig.mingdao.edu.tw",
  ],
  // A "*" in Access-Control-Allow-Headers does not cover Authorization, so
  // list every header the frontend sends. Cache-Control is sent by the home
  // page when it fetches /sig/list.
  headers: ["Authorization", "Content-Type", "Cache-Control"],
};

// Built once instead of on every request.
const corsMiddleware = cors({
  origin: "*",
  allowedHeaders: config.headers,
});

export default function configuredCors(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  corsMiddleware(req, res, next);
}
