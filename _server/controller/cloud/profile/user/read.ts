import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import { User } from "@type/user";
import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const ProfileDB = new MongoDB("user");

export const readById: RequestHandler = async (req, res) => {
    try {
        const id: string = req.params.id!;

        if (!id || !isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        const userData: User = (await ProfileDB.read({ id }))!;
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

        const userData: User = (await ProfileDB.read({ customId }))!;
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