import { ObjectId } from "mongoose";

import { Comment } from "@type/comment";
import comment from "@schema/comment";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function read(id: string | ObjectId) {
    try {
        const data = await comment.findOne({ _id: id, removed: false });

        if (!data) {
            throw new Error("Comment not found");
        }

        return data as unknown as Comment;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_COMMENT_FROM_DB, error);
    }
}