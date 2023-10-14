import { Request, Response, NextFunction } from "express";
import cors from "cors";


const config = {
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://sig.zeabur.app",
        "https://sig-dev.zeabur.app",
        "https://sig.mingdao.edu.tw"
    ],
    headers: ["*"]
};

export default function configuredCors(req: Request, res: Response, next: NextFunction) {
    cors({
        origin: "*",
        allowedHeaders: config.headers
    })(req, res, next);
}