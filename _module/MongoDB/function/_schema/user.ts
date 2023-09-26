import mongoose from "mongoose";


const Schema = mongoose.Schema;

const profileSchema = new Schema({
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

export const profile = mongoose.model("user", profileSchema, "user");
