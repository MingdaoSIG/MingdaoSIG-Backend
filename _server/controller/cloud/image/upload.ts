import { createHash } from "crypto";
import { RequestHandler } from "express";
import sharp from "sharp";

import CustomError from "@module/CustomError";
import { CustomCode, CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";

const ImageDB = new MongoDB.Image();

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
];
const MAX_INPUT_PIXELS = 40 * 1000 * 1000; // 40 MP
const MAX_EDGE = 2048;

// Every upload is stored as WebP, as it always was: GET /image/:id serves
// every stored image as image/webp, and existing images are all WebP.
const OUTPUT_FORMAT = {
  jpeg: "webp",
  png: "webp",
  webp: "webp",
  tiff: "webp",
} as const;
const OUTPUT_MIME_TYPE = {
  webp: "image/webp",
} as const;

type InputFormat = keyof typeof OUTPUT_FORMAT;

// Runs before the raw body parser, so a wrong type or an oversized declared
// length is refused without reading the body.
export const checkUploadHeaders: RequestHandler = (req, res, next) => {
  const contentType = (req.header("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
      status: CustomStatus.INVALID_BODY,
      message: "Unsupported image type",
    });
  }

  const contentLength = Number(req.header("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    res.set("Connection", "close");
    return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      status: CustomStatus.CONTENT_SIZE_EXCEEDED,
      message: CustomCode[CustomStatus.CONTENT_SIZE_EXCEEDED],
    });
  }

  next();
};

export const upload: RequestHandler = async (req, res) => {
  try {
    const rawImage: unknown = req.body;

    if (!Buffer.isBuffer(rawImage) || rawImage.byteLength === 0)
      throw new CustomError(
        CustomStatus.EMPTY_CONTENT,
        new Error("Content is empty"),
      );
    if (rawImage.byteLength > MAX_UPLOAD_BYTES)
      throw new CustomError(
        CustomStatus.CONTENT_SIZE_EXCEEDED,
        new Error("Content size exceeded"),
      );

    const { data, mimeType } = await processImage(rawImage);
    const sha256 = createHash("sha256").update(data).digest("hex");

    const savedData = await ImageDB.write({ image: data, sha256, mimeType });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedData._id!,
    });
  } catch (error: any) {
    return res
      .status(
        error.statusCode === CustomStatus.CONTENT_SIZE_EXCEEDED
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST,
      )
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

async function processImage(input: Buffer) {
  let metadata: sharp.Metadata;
  try {
    // metadata() only reads the header, so the pixel limit is checked below
    // to answer with 4026 instead of a generic decode error.
    metadata = await sharp(input, { limitInputPixels: false }).metadata();
  } catch (error) {
    throw new CustomError(CustomStatus.INVALID_BODY, error);
  }

  const format = metadata.format as string | undefined;
  if (!format || !(format in OUTPUT_FORMAT)) {
    throw new CustomError(
      CustomStatus.INVALID_BODY,
      new Error("Unsupported image format"),
    );
  }

  const { width = 0, height = 0 } = metadata;
  if (!width || !height || width * height > MAX_INPUT_PIXELS) {
    throw new CustomError(
      CustomStatus.CONTENT_SIZE_EXCEEDED,
      new Error("Image has too many pixels"),
    );
  }

  const outputFormat = OUTPUT_FORMAT[format as InputFormat];
  try {
    // sharp drops all metadata (EXIF, GPS, ICC) unless withMetadata() is
    // called; rotate() applies the EXIF orientation before it is dropped.
    const data = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toFormat(outputFormat)
      .toBuffer();

    return { data, mimeType: OUTPUT_MIME_TYPE[outputFormat] };
  } catch (error) {
    throw new CustomError(CustomStatus.INVALID_BODY, error);
  }
}
