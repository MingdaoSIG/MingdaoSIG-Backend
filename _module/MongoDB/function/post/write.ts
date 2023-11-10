import { Post } from "@type/post";
import post from "@schema/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(id: string | null, dataToSave: Post) {
    try {
        const data = await post.findOne({ _id: id });
        const code = data ? 1 : 0;

        if (code) {
            return (await post.findOneAndUpdate(
                { _id: id },
                dataToSave,
                {
                    new: true
                }
            ))!;
        }
        else {
            return (await post.create(dataToSave))!;
        }
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_WRITING_POST_TO_DB, error);
    }
}