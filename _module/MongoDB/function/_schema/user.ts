import mongoose from "mongoose";


const Schema = mongoose.Schema;

const userSchema = new Schema({
    customId: String,
    email: String,
    name: String,
    code: String,
    class: String,
    identity: String,
    sig: [String],
    displayName: String,
    description: String,
    avatar: String,
    follower: [String],
    permission: Number
}, { timestamps: true });

export default mongoose.model("profile", userSchema, "profile");
