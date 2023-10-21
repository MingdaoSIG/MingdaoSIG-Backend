import CustomError from "@type/customError";
import comment from "@schema/comment";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function read(id: string) {
    try {
        const data = await comment.findOne({ _id: id, removed: false });

        if (!data) {
            throw new Error("Comment not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_COMMENT_FROM_DB, error);
    }
}