import mongoose from "mongoose";


const Schema = mongoose.Schema;

const commentSchema = new Schema({
    post: String,
    content: String,
    user: String,
    like: [String],
    removed: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("comment", commentSchema, "comment");