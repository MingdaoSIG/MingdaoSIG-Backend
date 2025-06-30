import { RequestHandler } from "express";

// import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import signJWT from "@module/SignJWT";
import getUserData, { getUserDataBySession } from "@module/GetUserData";
import getGoogleUserData from "@module/GetGoogleUserData";


export const login: RequestHandler = async (req, res) => {
  try {
    // const checker = new CheckRequestRequirement(req);
    // checker.matchBody(["googleToken", "session"]);

    const googleToken: string = req.body.googleToken;
    const session: string = req.body.session;

    if (!googleToken && !session) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ status: CustomStatus.INVALID_BODY });
    }

    if (googleToken) {
      const googleUserData = await getGoogleUserData(googleToken);
      const userData = await getUserData(
        googleUserData.email,
        googleUserData.picture
      );

      const jwt = signJWT({ id: userData._id });
      return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        authorization: "Bearer " + jwt,
        data: userData
      });
    }
    else if (session) {
      const userData = await getUserDataBySession(session);
      if (!userData) {
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ status: CustomStatus.INVALID_SESSION });
      }
      const jwt = signJWT({ id: userData._id });
      return res.status(HttpStatus.OK).json({
        status: CustomStatus.OK,
        authorization: "Bearer " + jwt,
        data: userData
      });
    }
  }
  catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
