import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { User } from "@type/user";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const ProfileDB = new MongoDB("user");

export const readById: RequestHandler = async (req, res) => {
    try {
        const id: string = req.params.id!;

        if (!id || !isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        const userData: User | null = await ProfileDB.read({ id }).catch(() => null);
        if (!userData) throw new CustomError(CustomStatus.NOT_FOUND, new Error("User not found"));

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: userData._id,
            data: userData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const readByCustomId: RequestHandler = async (req, res) => {
    try {
        const customId: string = req.params.id!;

        const userData: User = await ProfileDB.read({ customId }).catch(() => null);
        if (!userData) throw new CustomError(CustomStatus.NOT_FOUND, new Error("User not found"));

        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            id: userData._id,
            data: userData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};