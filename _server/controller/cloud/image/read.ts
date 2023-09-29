import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { isValidObjectId } from "mongoose";
import CustomError from "@type/customError";


const ImageDB = new MongoDB("image");

export const read: RequestHandler = async (req, res) => {
    try {
        const id: string = req.params.id!;

        if (!id || !isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_IMAGE_ID, new Error("Invalid image id"));

        const imageData = (await ImageDB.read({ id }))!;
        return res.status(HttpStatus.OK).contentType("image/webp").send(imageData);
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};