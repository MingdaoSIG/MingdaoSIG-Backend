import mongoose from "mongoose";


const Schema = mongoose.Schema;

const postSchema = new Schema({
    sig: String,
    title: String,
    content: String,
    user: String,
    hashtag: [String],
    like: [String],
    removed: { type: Boolean, default: false }
});

export default mongoose.model("post", postSchema, "post");