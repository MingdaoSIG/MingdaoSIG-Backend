import mongoose from "mongoose";


const Schema = mongoose.Schema;

const postSchema = new Schema({
    sig: String,
    title: String,
    cover: String,
    content: String,
    user: String,
    hashtag: [String],
    like: [String],
    removed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("post", postSchema, "post");