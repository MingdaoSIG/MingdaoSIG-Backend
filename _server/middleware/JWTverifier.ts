import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import MongoDB from "@module/MongoDB";
import { User } from "@type/user";


const UserDB = new MongoDB.User();

export default async function JWTverifier(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const SECRET_KEY: Secret = process.env.JWT_SECRET as Secret;

  try {
    const authHeader = req.header("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new CustomError(
        CustomStatus.INVALID_JWT,
        new Error("Invalid JWT")
      );
    }

    const token = authHeader.replace("Bearer ", "");
    let decoded: JwtPayload;
    try {
      const verifiedJwt = jwt.verify(token, SECRET_KEY, {
        algorithms: ["HS256"]
      });
      if (typeof verifiedJwt === "string") {
        throw new Error("Invalid JWT");
      }
      decoded = verifiedJwt;
    }
    catch (error) {
      throw new CustomError(CustomStatus.INVALID_JWT, error);
    }

    // Tokens issued before expiry was added carry only id and iat.
    checkData(decoded, ["id", "iat"], ["exp"]);

    let userData: User;
    try {
      if (!isValidObjectId(decoded.id))
        throw new Error("Invalid user id");
      userData = await UserDB.read({ id: decoded.id });
    }
    catch (error) {
      throw new CustomError(CustomStatus.INVALID_JWT, error);
    }

    const customReq = req as unknown as ExtendedRequest;
    customReq.JWT = decoded;
    customReq.userData = userData;

    next();
  }
  catch (error) {
    return res
      .status(HttpStatus.UNAUTHORIZED)
      .json({
        status:
                    (error as CustomError).statusCode ||
                    CustomStatus.UNKNOWN_ERROR
      });
  }
}

function checkData(
  data: unknown,
  requiredKeys: string[],
  optionalKeys: string[] = []
) {
  try {
    // Check if input is an object
    if (data !== null && typeof data === "object") {
      // Check if object have all required keys and nothing unexpected
      const keys = Object.keys(data);
      for (const key of requiredKeys) {
        if (!keys.includes(key)) throw new Error("Invalid data");
      }
      for (const key of keys) {
        if (!requiredKeys.includes(key) && !optionalKeys.includes(key))
          throw new Error("Invalid data");
      }
    }
    else {
      throw new Error("Not a object");
    }
  }
  catch (error) {
    throw new CustomError(CustomStatus.INVALID_JWT, error);
  }

  return true;
}
