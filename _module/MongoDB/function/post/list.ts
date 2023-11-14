import { Option } from "@type/database";
import post from "@schema/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function list(search: object, option?: Option) {
    try {
        const { skip, limit, sort } = option || {};

        const data = await post.find(search)
            .sort(sort || { createdAt: -1 })
            .skip(skip || 0)
            .limit(limit || 0);

        if (!data) {
            throw new Error("Post not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
    }
}