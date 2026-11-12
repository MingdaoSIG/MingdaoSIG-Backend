import { Request, RequestHandler } from "express";

import { UserWrite } from "@type/user";
import { ExtendedRequest } from "@type/request";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { notificationSettingsUpdate } from "@module/NotificationSettings";
import { withOwnUserFields } from "@module/Onboarding";
import { withActiveSuspension } from "@module/Suspension";
// import CheckValidCustomId from "@module/CheckValidCustomId";

const UserDB = new MongoDB.User();

// POST /user: the caller updates their own `description`, `notifyComments`
// (comment notification emails) and/or `notificationSettings` (a partial
// deep merge), or sends `onboarded: true` once the first-login onboarding is
// done or skipped (sets `onboardedAt`; a date already stored is kept).
// Fields left out keep their value. `notifyComments` and
// `notificationSettings.email.comment` are the same setting: writing either
// one updates both, and sending both with different values is 4011. Returns
// the same document as GET /user/me.
export const write: RequestHandler = async (
  req: Request | ExtendedRequest,
  res,
) => {
  try {
    const {
      // customId,
      description,
      notifyComments,
      notificationSettings,
      onboarded,
    } = req.body ?? {};
    const decodedJwt: any = (req as ExtendedRequest).JWT;
    const userId = decodedJwt.id;

    new CheckRequestRequirement(req as Request).onlyIncludesBody(
      // ["customId", "description"],
      ["description", "notifyComments", "notificationSettings", "onboarded"],
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

    if (onboarded !== undefined && onboarded !== true) {
      throw new CustomError(
        CustomStatus.INVALID_BODY,
        new Error("onboarded can only be true"),
      );
    }

    if (notifyComments !== undefined && typeof notifyComments !== "boolean") {
      throw new CustomError(
        CustomStatus.INVALID_BODY,
        new Error("notifyComments must be true or false"),
      );
    }

    const settingsUpdate =
      notificationSettings === undefined
        ? {}
        : notificationSettingsUpdate(notificationSettings);
    const emailComment = settingsUpdate["notificationSettings.email.comment"];
    if (
      notifyComments !== undefined &&
      emailComment !== undefined &&
      notifyComments !== emailComment
    ) {
      throw new CustomError(
        CustomStatus.INVALID_BODY,
        new Error(
          "notifyComments and notificationSettings.email.comment disagree",
        ),
      );
    }

    const dataToSave: UserWrite & Record<string, unknown> = {
      // customId: String(customId ?? userData.customId),
      ...settingsUpdate,
    };
    if (description !== undefined && description !== null)
      dataToSave.description = String(description);
    const commentEmails = notifyComments ?? emailComment;
    if (commentEmails !== undefined) {
      dataToSave.notifyComments = commentEmails;
      dataToSave["notificationSettings.email.comment"] = commentEmails;
    }
    if (onboarded === true && !(req as ExtendedRequest).userData?.onboardedAt)
      dataToSave.onboardedAt = new Date();

    const savedData = await UserDB.write(dataToSave, { id: userId });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      id: savedData._id,
      data: withActiveSuspension(await withOwnUserFields(savedData)),
    });
  } catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
