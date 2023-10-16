import mongoose from "mongoose";


const Schema = mongoose.Schema;

const sigSchema = new Schema({
    name: String,
    description: String,
    avatar: String,
    follower: [String],
    customId: String,
    moderator: [String],
    leader: [String],
    removed: { type: Boolean, default: false }
});

export default mongoose.model("sig", sigSchema, "sig");
