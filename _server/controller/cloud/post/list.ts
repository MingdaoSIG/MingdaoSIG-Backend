import { RequestHandler, Response } from "express";

import { Post } from "@type/post";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { FilterQuery, isValidObjectId } from "mongoose";
import CustomError from "@type/customError";


const PostDB = new MongoDB("post");
const UserDB = new MongoDB("user");
const SigDB = new MongoDB("sig");

export const listAll: RequestHandler = async (_, res) => {
    try {
        return await listPostBy(res, { pinned: false });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const listAllBySig: RequestHandler = async (req, res) => {
    try {
        const sigId: string = req.params.id!;

        if (!isValidObjectId(sigId)) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        const sigData = await SigDB.read({ id: sigId }).catch(() => null);
        if (!sigData) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        return await listPostBy(res, { sig: sigId });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const listAllByUser: RequestHandler = async (req, res) => {
    try {
        const userId: string = req.params.id!;

        if (!isValidObjectId(userId)) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        const haveUser = await UserDB.read({ id: userId }).catch(() => null);
        if (!haveUser) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        return await listPostBy(res, { user: userId });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const listAllByUserLike: RequestHandler = async (req, res) => {
    try {
        const userId: string = req.params.id!;

        if (!isValidObjectId(userId)) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        const haveUser = await UserDB.read({ id: userId }).catch(() => null);
        if (!haveUser) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        return await listPostBy(res, { like: userId });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const listAllByPinned: RequestHandler = async (_, res) => {
    try {
        return await listPostBy(res, { pinned: true });
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

async function listPostBy(res: Response, search: FilterQuery<Post>) {
    const postData: Post[] | null = await PostDB.list({
        ...search,
        removed: false
    });

    return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        data: postData
    });
}