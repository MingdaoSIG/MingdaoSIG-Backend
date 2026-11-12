import { NextFunction, Request, Response } from "express";

import { ExtendedRequest } from "@type/request";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import { isContentModerator } from "@module/Permission";

// Mount after JWTverifier: lets content moderators (permission 3) and admins
// (permission 2) through (contract v4 §5.2).
export default function contentModeratorOnly(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!isContentModerator((req as unknown as ExtendedRequest).userData)) {
    return res
      .status(HttpStatus.FORBIDDEN)
      .json({ status: CustomStatus.FORBIDDEN });
  }

  next();
}
