import { RequestHandler, Response } from "express";

import { Post } from "@type/post";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { isValidObjectId } from "mongoose";
import CustomError from "@type/customError";


const PostDB = new MongoDB("post");
const UserDB = new MongoDB("user");
const SigDB = new MongoDB("sig");

export const listAll: RequestHandler = async (_, res) => {
    try {
        return await _list(res, {});
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const listAllBySig: RequestHandler = async (req, res) => {
    try {
        const id: string = req.params.id!;

        if (!isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        const sigData = await SigDB.read({ id }).catch(() => null);
        if (!sigData) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid user id"));

        return await _list(res, { sig: id });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const listAllByUser: RequestHandler = async (req, res) => {
    try {
        const id: string = req.params.id!;

        if (!isValidObjectId(id)) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        const haveUser = await UserDB.read({ id }).catch(() => null);
        if (!haveUser) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        return await _list(res, { user: id });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

async function _list(res: Response, search: object) {
    const postData: Post[] | null = await PostDB.list({
        ...search,
        removed: false
    });

    return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        postData
    });
}