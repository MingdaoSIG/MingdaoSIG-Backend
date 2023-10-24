import { RequestHandler, Response } from "express";
import { FilterQuery, isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import CustomError from "@type/customError";
import { Sort } from "@type/database";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const PostDB = new MongoDB("post");
const UserDB = new MongoDB("user");
const SigDB = new MongoDB("sig");

export const listAll: RequestHandler = async (req, res) => {
    try {
        const skip = req.query?.skip;
        const limit = req.query?.limit;

        // ! This should be removed once Frontend finish
        if (!skip || !limit) {
            return await listPostBy(res, { pinned: false }, 0, 0, { likes: -1 });
        }

        if (typeof skip !== "string" || typeof limit !== "string") throw new CustomError(CustomStatus.INVALID_QUERY, new Error("Skip or limit is not a string"));

        if (isNaN(Number(skip)) || isNaN(Number(limit))) throw new CustomError(CustomStatus.INVALID_QUERY, new Error("Skip or limit is not a number"));

        if (Number(skip) < 0) throw new CustomError(CustomStatus.INVALID_QUERY, new Error("Skip should be above or equal to 0"));
        if (Number(limit) <= 0 || Number(limit) > 50) throw new CustomError(CustomStatus.INVALID_QUERY, new Error("Limit should be above 0 and less than 50"));

        return await listPostBy(res, { pinned: false }, Number(skip), Number(limit), { likes: -1 });
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

async function listPostBy(res: Response, search: FilterQuery<Post>, skip?: number, limit?: number, sort?: Sort) {
    const postData: Post[] | null = await PostDB.list({
        ...search,
        removed: false
    }, {
        skip: skip || 0,
        limit: limit || 0,
        sort: sort || { createdAt: -1 }
    });

    return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        data: postData
    });
}