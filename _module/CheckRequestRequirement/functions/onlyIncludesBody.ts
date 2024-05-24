import { Request } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default function onlyIncludesBody(
  request: Request,
  requiredBody: string[],
  strict: boolean = false
) {
  try {
    const body = request.body;

    if (!body) throw new Error("Body is empty");

    if (strict && !onlyIncludesRequiredBody(body, requiredBody)) {
      throw new Error(
        `Only the following items are allowed for this route: [${requiredBody.join(
          ", "
        )}]`
      );
    }

    if (!includesRequiredBody(body, requiredBody)) {
      throw new Error(
        `Only the following items are allowed for this route: [${requiredBody.join(
          ", "
        )}]`
      );
    }

    if (Object.keys(body).length > requiredBody.length) {
      throw new Error(
        `Only allowed ${
          requiredBody.length
        } items in the body: [${requiredBody.join(", ")}]`
      );
    }
  }
  catch (error) {
    throw new CustomError(CustomStatus.INVALID_BODY, error);
  }
}

function includesRequiredBody(body: object, requiredBody: string[]) {
  return requiredBody.some((item: string) =>
    Object.keys(body).includes(item)
  );
}

function onlyIncludesRequiredBody(body: object, requiredBody: string[]) {
  return Object.keys(body).every((item: string) =>
    requiredBody.includes(item)
  );
}
