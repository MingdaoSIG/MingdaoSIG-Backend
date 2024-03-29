import { ObjectId } from "mongoose";

import { Comment, CommentWrite } from "@type/comment";
import comment from "@schema/comment";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(
  id: string | ObjectId | null,
  dataToSave: CommentWrite
) {
  try {
    const data = await comment.findOne({ _id: id });
    const code = data ? 1 : 0;

    if (code) {
      return (await comment.findOneAndUpdate({ _id: id }, dataToSave, {
        new: true
      })) as unknown as Comment;
    }
    else {
      return (await comment.create(dataToSave)) as unknown as Comment;
    }
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_WRITING_COMMENT_TO_DB, error);
  }
}
