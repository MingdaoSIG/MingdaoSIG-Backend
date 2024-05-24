import { Request } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default function matchQuery(request: Request, requiredQuery: string[]) {
  try {
    const query = request.query;

    if (!query) throw new Error("Query is empty");

    if (!hasAllRequiredQuery(query, requiredQuery)) {
      throw new Error(
        `The following items are all required for this route: [${requiredQuery.join(
          ", "
        )}]`
      );
    }
  }
  catch (error) {
    throw new CustomError(CustomStatus.INVALID_QUERY, error);
  }
}

function hasAllRequiredQuery(query: object, requiredQuery: string[]) {
  return requiredQuery.every((item: string) =>
    Object.keys(query).includes(item)
  );
}
