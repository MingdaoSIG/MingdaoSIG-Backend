import { RequestHandler } from "express";

import { Sig } from "@type/sig";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import _MongoDB from "@module/MongoDB";


const SigDB = new _MongoDB("sig");

export const listAll: RequestHandler = async (_, res) => {
    try {
        const sigData: Sig[] | null = await SigDB.list({ removed: false });

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            data: sigData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};