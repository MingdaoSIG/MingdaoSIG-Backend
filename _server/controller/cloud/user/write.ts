import { Request, RequestHandler } from "express";

import { UserWrite } from "@type/user";
import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
// import CheckValidCustomId from "@module/CheckValidCustomId";

const UserDB = new MongoDB.User();

// POST /user: the caller updates their own `description` and/or
// `notifyComments` (comment notification emails). Fields left out keep their
// value.
export const write: RequestHandler = async (
  req: Request | ExtendedRequest,
  res,
) => {
  try {
    const {
      // customId,
      description,
      notifyComments,
    } = req.body ?? {};
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId = decodedJwt.id;

    new CheckRequestRequirement(req as Request).onlyIncludesBody(
      // ["customId", "description"],
      ["description", "notifyComments"],
    );

    // if (userData.customId !== customId) {
    //   await CheckValidCustomId(customId);
    // }

    if (description && description?.length > 250) {
      throw new CustomError(
        CustomStatus.INVALID_BODY,
        new Error("Invalid description"),
      );
    }

    if (notifyComments !== undefined && typeof notifyComments !== "boolean") {
      throw new CustomError(
        CustomStatus.INVALID_BODY,
        new Error("notifyComments must be true or false"),
      );
    }

    const dataToSave: UserWrite = {
      // customId: String(customId ?? userData.customId),
    };
    if (description !== undefined && description !== null)
      dataToSave.description = String(description);
    if (notifyComments !== undefined)
      dataToSave.notifyComments = notifyComments;

    const savedData = await UserDB.write(dataToSave, { id: userId });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedData._id,
      data: savedData,
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
