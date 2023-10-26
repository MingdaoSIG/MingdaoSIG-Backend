import { Request } from "express";

import CustomError from "@type/customError";
import { ExtendedRequest } from "@type/request";
import { CustomStatus } from "@module/CustomStatusCode";


export default function CheckValidPaginationOption(req: Request | ExtendedRequest) {
    const skip = req.query?.skip;
    const limit = req.query?.limit;

    // ! This should be removed once Frontend finish
    if (!skip || !limit) return true;

    if (typeof skip !== "string" || typeof limit !== "string") throw new CustomError(CustomStatus.INVALID_QUERY, new Error("Skip or limit is not a string"));

    if (isNaN(Number(skip)) || isNaN(Number(limit))) throw new CustomError(CustomStatus.INVALID_QUERY, new Error("Skip or limit is not a number"));

    if (Number(skip) < 0) throw new CustomError(CustomStatus.INVALID_QUERY, new Error("Skip should be above or equal to 0"));
    if (Number(limit) <= 0 || Number(limit) > 50) throw new CustomError(CustomStatus.INVALID_QUERY, new Error("Limit should be above 0 and less than 50"));

    return true;
}