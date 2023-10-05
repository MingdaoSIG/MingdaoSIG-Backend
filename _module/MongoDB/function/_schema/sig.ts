import mongoose from "mongoose";


const Schema = mongoose.Schema;

const sigSchema = new Schema({
    name: String,
    description: String,
    avatar: String,
    follower: [String],
    moderator: [String],
    leader: [String],
});

export default mongoose.model("sig", sigSchema, "sig");
