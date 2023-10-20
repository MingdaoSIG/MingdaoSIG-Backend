import CustomError from "@type/customError";
import comment from "@schema/comment";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function list(search: object) {
    try {
        const data = await comment.find(search);

        if (!data) {
            throw new Error("Comment not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_COMMENT_FROM_DB, error);
    }
}