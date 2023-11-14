import { RequestHandler } from "express";
import sharp from "sharp";

import { ImageData } from "@type/image";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const ImageDB = new MongoDB("image");

export const upload: RequestHandler = async (req, res) => {
    try {
        const rawImage: Buffer = req.body;

        const byteLimit = 5 * 1000 * 1000; // 5 MB
        if (rawImage.byteLength > byteLimit) throw new CustomError(CustomStatus.CONTENT_SIZE_EXCEEDED, new Error("Content size exceeded"));
        if (!rawImage) throw new CustomError(CustomStatus.EMPTY_CONTENT, new Error("Content is empty"));

        const webpImage =
            await sharp(rawImage)
                .webp()
                .toBuffer();

        const dataToSave: ImageData = {
            image: webpImage
        };

        const savedData: ImageData = await ImageDB.write(dataToSave);

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: savedData._id!
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};