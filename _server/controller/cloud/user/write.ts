import { Request, RequestHandler } from "express";

import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
// import CheckValidCustomId from "@module/CheckValidCustomId";

const UserDB = new MongoDB.User();

export const write: RequestHandler = async (
  req: Request | ExtendedRequest,
  res
) => {
  try {
    const {
      // customId,
      description
    } = req.body;
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId = decodedJwt.id;
    const userData = (req as ExtendedRequest).userData;

    new CheckRequestRequirement(req as Request).includesBody(
      // ["customId", "description"],
      ["description"],
      true
    );

    // if (userData.customId !== customId) {
    //   await CheckValidCustomId(customId);
    // }

    if (description && description?.length > 250) {
      throw new CustomError(
        CustomStatus.INVALID_BODY,
        new Error("Invalid description")
      );
    }

    const dataToSave = {
      // customId: String(customId ?? userData.customId),
      description: String(description ?? userData.description)
    };
    const savedData = await UserDB.write(dataToSave, { id: userId });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedData._id,
      data: savedData
    });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
