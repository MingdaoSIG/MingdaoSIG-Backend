import { Request } from "express";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default function matchBody(request: Request, requiredBody: string[]) {
    try {
        const body = request.body;

        if (!body) throw new Error("Body is empty");

        if (!hasAllRequiredBody(body, requiredBody)) {
            throw new Error(
                `The following items are all required for this route: [${requiredBody.join(
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

function hasAllRequiredBody(body: object, requiredBody: string[]) {
    return requiredBody.every((item: string) =>
        Object.keys(body).includes(item)
    );
}
