import { JwtPayload } from "jsonwebtoken";

import { User } from "./user";


export interface ExtendedRequest extends Request {
    JWT: string | JwtPayload;
    userData: User;
}