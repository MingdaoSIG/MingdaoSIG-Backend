import { NextFunction, Request, Response } from "express";

import { ExtendedRequest } from "@type/request";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import { isAdmin } from "@module/Permission";

// Mount after JWTverifier: lets only admins (permission 2) through.
export default function adminOnly(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!isAdmin((req as unknown as ExtendedRequest).userData)) {
    return res
      .status(HttpStatus.FORBIDDEN)
      .json({ status: CustomStatus.FORBIDDEN });
  }

  next();
}
