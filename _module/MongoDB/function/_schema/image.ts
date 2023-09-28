import mongoose from "mongoose";


const Schema = mongoose.Schema;

const imageSchema = new Schema({
    image: Buffer
}, { timestamps: true });

export default mongoose.model("image", imageSchema, "image");
