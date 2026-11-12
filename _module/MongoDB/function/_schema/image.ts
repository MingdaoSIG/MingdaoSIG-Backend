import mongoose from "mongoose";

const Schema = mongoose.Schema;

const imageSchema = new Schema(
  {
    image: Buffer,
    sha256: { type: String, index: true },
    mimeType: String,
  },
  { timestamps: true },
);

export default mongoose.model("image", imageSchema, "image");
