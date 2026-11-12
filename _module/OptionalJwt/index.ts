import { Request } from "express";
import jwt, { Secret } from "jsonwebtoken";

/**
 * The user id in the request's `Authorization: Bearer <JWT>`, or null when
 * there is no header or the token is invalid. For public routes that behave a
 * little differently for a signed-in caller; it does not load the user, so
 * routes that need the user keep using JWTverifier.
 */
export function userIdFromJwt(req: Request): string | null {
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
