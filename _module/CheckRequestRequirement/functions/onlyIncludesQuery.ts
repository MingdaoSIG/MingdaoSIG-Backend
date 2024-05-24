import { Request } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default function onlyIncludesQuery(
  request: Request,
  requiredQuery: string[]
) {
  try {
    const query = request.query;

    if (!query || Object.keys(query).length === 0)
      throw new Error("query is empty");

    if (!onlyIncludesRequiredQuery(query, requiredQuery)) {
      throw new Error(
        `Only the following items are allowed for this route: [${requiredQuery.join(
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
  catch (error) {
    throw new CustomError(CustomStatus.INVALID_QUERY, error);
  }
}

function onlyIncludesRequiredQuery(query: object, requiredQuery: string[]) {
  return Object.keys(query).every((item: string) =>
    requiredQuery.includes(item)
  );
}
