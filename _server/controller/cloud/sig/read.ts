import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const SigDB = new MongoDB.Sig();

export const readById: RequestHandler = async (req, res) => {
    try {
        const sigId = req.params.sigId;

        if (!sigId || !isValidObjectId(sigId)) {
            throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));
        }

        const sigData = await SigDB.read({ id: sigId }).catch(() => null);
        if (!sigData) {
            throw new CustomError(CustomStatus.NOT_FOUND, new Error("Sig not found"));
        }

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: sigData._id,
            data: sigData,
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const readByCustomId: RequestHandler = async (req, res) => {
    try {
        const customId: string = req.params.customId;

        const sigData = await SigDB.read({ customId }).catch(() => null);
        if (!sigData) {
            throw new CustomError(CustomStatus.NOT_FOUND, new Error("Sig not found"));
        }

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: sigData._id,
            data: sigData,
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
