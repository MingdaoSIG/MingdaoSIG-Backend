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
    priority: { type: Number, default: 0 },
    pinned: { type: Boolean, default: false },
    removed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("post", postSchema, "post");