import CustomError from "@type/customError";
import post from "@schema/post";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function list(search: object) {
    try {
        const data = await post.find(search);

        if (!data) {
            throw new Error("Post not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
    }
}