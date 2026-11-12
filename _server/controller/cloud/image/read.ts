import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";

import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";


const ImageDB = new MongoDB.Image();

// Images are never changed after upload, so the id identifies the bytes.
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const read: RequestHandler = async (req, res) => {
  try {
    const id: string = req.params.id!;

    if (!id || !isValidObjectId(id))
      throw new CustomError(
        CustomStatus.INVALID_IMAGE_ID,
        new Error("Invalid image id")
      );

    const etag = `"${id.toLowerCase()}"`;
    if (matchesIfNoneMatch(req.get("if-none-match"), etag)) {
      // The client already has these bytes: answer without reading the image.
      return res
        .status(HttpStatus.NOT_MODIFIED)
        .set({ ETag: etag, "Cache-Control": IMMUTABLE_CACHE_CONTROL })
        .end();
    }

    const imageData: Buffer | null = await ImageDB.read({ id }).catch(
      () => null
    );
    if (!imageData)
      throw new CustomError(
        CustomStatus.NOT_FOUND,
        new Error("Image not found")
      );

    // Setting ETag also stops Express from hashing the whole buffer for one.
    return res
      .status(HttpStatus.OK)
      .set({ ETag: etag, "Cache-Control": IMMUTABLE_CACHE_CONTROL })
      .contentType("image/webp")
      .send(imageData);
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

// If-None-Match uses weak comparison (RFC 9110 13.1.2): W/"x" matches "x".
function matchesIfNoneMatch(header: string | undefined, etag: string) {
  if (!header) return false;

  return header
    .split(",")
    .map(tag => tag.trim().replace(/^W\//, ""))
    .some(tag => tag.toLowerCase() === etag);
}
