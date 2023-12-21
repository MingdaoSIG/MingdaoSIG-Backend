import { Request } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default function forbiddenBody(
    request: Request,
    forbiddenKeys: string[]
) {
    try {
        const invalidKeys = Object.keys(request.body).filter(key =>
            forbiddenKeys.includes(key)
        );
        if (invalidKeys.length > 0 || Object.keys(request.body).length === 0)
            throw new Error("Body contains forbidden keys");
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.INVALID_BODY, error);
    }
}
