import { RequestHandler, Response } from "express";
import { FilterQuery, isValidObjectId } from "mongoose";

import { Post } from "@type/post";
import { User } from "@type/user";
import { Sig } from "@type/sig";
import { Sort } from "@type/database";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckValidPaginationOption from "@module/CheckValidPaginationOption";


const PostDB = new MongoDB("post");
const UserDB = new MongoDB("user");
const SigDB = new MongoDB("sig");

const sortMethods = {
    mostLikes: { likes: -1 },
    latest: { createdAt: -1 },
    oldest: { createdAt: 1 }
};

export const listAll: RequestHandler = async (req, res) => {
    try {
        const skip = req.query?.skip;
        const limit = req.query?.limit;
        const sort = req.query?.sort;

        CheckValidPaginationOption(req);

        const sortMethod = sort ? (sortMethods[String(sort) as keyof typeof sortMethods] || sortMethods.mostLikes) : sortMethods.mostLikes;

        return await listPostBy(res, { pinned: false }, (skip ? Number(skip) : 0), (limit ? Number(limit) : 0), sortMethod);
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const listAllBySig: RequestHandler = async (req, res) => {
    try {
        const sigId: string = req.params.id!;
        const skip = req.query?.skip;
        const limit = req.query?.limit;

        CheckValidPaginationOption(req);

        if (!isValidObjectId(sigId)) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        const sigData = await SigDB.read({ id: sigId }).catch(() => null);
        if (!sigData) throw new CustomError(CustomStatus.INVALID_SIG_ID, new Error("Invalid sig id"));

        return await listPostBy(res, { sig: sigId }, (skip ? Number(skip) : 0), (limit ? Number(limit) : 0));
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const listAllByUser: RequestHandler = async (req, res) => {
    try {
        const userId: string = req.params.id!;
        const skip = req.query?.skip;
        const limit = req.query?.limit;

        CheckValidPaginationOption(req);

        if (!isValidObjectId(userId)) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        const haveUser = await UserDB.read({ id: userId }).catch(() => null);
        if (!haveUser) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        return await listPostBy(res, { user: userId }, (skip ? Number(skip) : 0), (limit ? Number(limit) : 0));
    }
    catch (error: any) {
        return res.status(HttpStatus.NOT_FOUND).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};

export const listAllByUserLike: RequestHandler = async (req, res) => {
    try {
        const userId: string = req.params.id!;
        const skip = req.query?.skip;
        const limit = req.query?.limit;

        CheckValidPaginationOption(req);

        if (!isValidObjectId(userId)) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        const haveUser = await UserDB.read({ id: userId }).catch(() => null);
        if (!haveUser) throw new CustomError(CustomStatus.INVALID_USER_ID, new Error("Invalid user id"));

        return await listPostBy(res, { like: userId }, (skip ? Number(skip) : 0), (limit ? Number(limit) : 0));
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

    const userIds = new Set<string>();
    postData?.forEach((comment) => {
        userIds.add(comment.user);
    });
    const usersDataMap: Record<string, User> = {};
    const usersData: User[] = await UserDB.list({ _id: { $in: Array.from(userIds) } });
    usersData.forEach((user) => {
        if (user._id) {
            usersDataMap[user._id] = user;
        }
    });

    const sigIds = new Set<string>();
    postData?.forEach((comment) => {
        sigIds.add(comment.sig);
    });
    const sigsDataMap: Record<string, Sig> = {};
    const sigsData: Sig[] = await SigDB.list({ _id: { $in: Array.from(sigIds) } });
    sigsData.forEach((sig) => {
        if (sig._id) {
            sigsDataMap[sig._id] = sig;
        }
    });

    const fullPostData = postData?.map((comment) => {
        comment = JSON.parse(JSON.stringify(comment));
        return {
            ...comment,
            user: {
                _id: usersDataMap[comment.user]?._id,
                name: usersDataMap[comment.user]?.name
            },
            sig: {
                _id: sigsDataMap[comment.sig]?._id,
                name: sigsDataMap[comment.sig]?.name
            }
        };
    });

    return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        data: fullPostData
    });
}