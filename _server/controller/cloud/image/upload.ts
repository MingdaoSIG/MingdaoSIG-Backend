import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { ImageData } from "@type/image";


const ImageDB = new MongoDB("image");

export const upload: RequestHandler = async (req, res) => {
    try {
        const image: Buffer = req.body;

        const dataToSave: ImageData = {
            image: image
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