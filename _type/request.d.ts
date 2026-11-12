import { JwtPayload } from "jsonwebtoken";
import { Request } from "express";

import { User } from "./user";


export interface ExtendedRequest extends Request<Record<string, string>> {
    JWT: string | JwtPayload;
    userData: User;
}
