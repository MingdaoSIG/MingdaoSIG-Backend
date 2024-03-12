import { Request } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default function matchQuery(request: Request, requiredQuery: string[]) {
  try {
    const query = new URL(request.url);

    if (!query) throw new Error("Query is empty");

    if (!hasAllRequiredQuery(query, requiredQuery)) {
      throw new Error(
        `The following items are all required for this route: [${requiredQuery.join(
          ", "
        )}]`
      );
    }

    if (Object.keys(query).length > requiredQuery.length) {
      throw new Error(
        `Only allowed ${
          requiredQuery.length
        } items in the query: [${requiredQuery.join(", ")}]`
      );
    }
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.INVALID_QUERY, error);
  }
}

function hasAllRequiredQuery(query: object, requiredQuery: string[]) {
  return requiredQuery.every((item: string) =>
    Object.keys(query).includes(item)
  );
}
