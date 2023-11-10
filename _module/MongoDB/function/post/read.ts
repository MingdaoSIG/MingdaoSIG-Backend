import post from "@schema/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function read(id: string) {
    try {
        const data = await post.findOne({ _id: id, removed: false });

        if (!data) {
            throw new Error("Post not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
    }
}