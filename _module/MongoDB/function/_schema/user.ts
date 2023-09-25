import mongoose from "mongoose";


const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: String,
    name: String,
    code: String,
    class: String,
    identity: String,
    displayName: String,
    description: String,
    avatar: String,
    permission: Number
}, { timestamps: true });

export const user = mongoose.model("user", userSchema, "user");
