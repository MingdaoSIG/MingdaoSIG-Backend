import { JwtPayload } from "jsonwebtoken";

export interface RequestContainJWT extends Request {
    JWT: string | JwtPayload;
}