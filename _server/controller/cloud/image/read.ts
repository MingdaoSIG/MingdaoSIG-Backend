import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const ImageDB = new MongoDB.Image();

export const read: RequestHandler = async (req, res) => {
    try {
        const id: string = req.params.id!;

        if (!id || !isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_IMAGE_ID, new Error("Invalid image id"));

        const imageData: Buffer | null = await ImageDB.read({ id }).catch(() => null);
        if (!imageData) throw new CustomError(CustomStatus.NOT_FOUND, new Error("Image not found"));

        return res.status(HttpStatus.OK).contentType("image/webp").send(imageData);
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};