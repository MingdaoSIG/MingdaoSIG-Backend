import { ErrorRequestHandler } from "express";

import { HttpStatus } from "@module/HttpStatusCode";
import { CustomCode, CustomStatus } from "@module/CustomStatusCode";


// Turns body-parser errors (and anything else passed to next(error)) into the
// JSON shape the rest of the API uses, instead of Express's HTML error page.
const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error?.type === "entity.too.large") {
    return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      status: CustomStatus.CONTENT_SIZE_EXCEEDED,
      message: CustomCode[CustomStatus.CONTENT_SIZE_EXCEEDED]
    });
  }

  const httpStatus = Number(error?.status ?? error?.statusCode);
  if (httpStatus >= 400 && httpStatus < 500) {
    // entity.parse.failed, charset/encoding errors, aborted requests...
    return res.status(HttpStatus.BAD_REQUEST).json({
      status: CustomStatus.INVALID_BODY,
      message: CustomCode[CustomStatus.INVALID_BODY]
    });
  }

  console.error("Unhandled error:", error?.stack ?? error);
  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    status: CustomStatus.UNKNOWN_ERROR,
    message: CustomCode[CustomStatus.UNKNOWN_ERROR]
  });
};

export default errorHandler;
