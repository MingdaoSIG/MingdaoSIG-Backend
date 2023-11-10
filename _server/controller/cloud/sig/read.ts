import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { Sig } from "@type/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const SigDB = new MongoDB("sig");

export const readById: RequestHandler = async (req, res) => {
    try {
        const id: string = req.params.id!;

        if (!id || !isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        const sigData: Sig | null = await SigDB.read({ id }).catch(() => null);
        if (!sigData) throw new CustomError(CustomStatus.NOT_FOUND, new Error("Sig not found"));

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: sigData._id,
            data: sigData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const readByCustomId: RequestHandler = async (req, res) => {
    try {
        const customId: string = req.params.id!;

        const sigData: Sig = await SigDB.read({ customId }).catch(() => null);
        if (!sigData) throw new CustomError(CustomStatus.NOT_FOUND, new Error("Sig not found"));

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: sigData._id,
            data: sigData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};