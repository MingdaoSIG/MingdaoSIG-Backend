import { RequestHandler, Response } from "express";

import { Sig } from "@type/sig";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const SigDB = new MongoDB("sig");

export const listAll: RequestHandler = async (_, res) => {
    try {
        const postData: Sig[] | null = await SigDB.list({});

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            postData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};