import { Option } from "@type/database";
import { CommentFilter } from "@type/comment";
import comment from "@schema/comment";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function list(search: CommentFilter, option?: Option) {
    try {
        const { skip, limit, sort } = option || {};

        const data = await comment.find(search)
            .sort(sort || { createdAt: -1 })
            .skip(skip || 0)
            .limit(limit || 0);

        if (!data) {
            throw new Error("Comment not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_COMMENT_FROM_DB, error);
    }
}