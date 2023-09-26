import { RequestHandler } from "express";

import CustomError from "@type/customError";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";


export const image: RequestHandler = async (req, res) => {
    try {
        const checker = new CheckRequestRequirement(req);
        checker.hasBody(["image"]);

        const image: string = req.body.image;

        if (!image || !image.startsWith("data:image/")) throw new CustomError(CustomStatus.INVALID_BODY, new Error("Invalid image"));
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};