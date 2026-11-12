import { Request, RequestHandler, Response } from "express";

// import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import signJWT from "@module/SignJWT";
import getUserData, { getUserDataBySession } from "@module/GetUserData";
import getGoogleUserData from "@module/GetGoogleUserData";
import { withNotificationSettings } from "@module/NotificationSettings";
import {
  activeSuspension,
  clearExpiredSuspension,
  isExpiredSuspension,
  sendSuspended,
  withActiveSuspension,
} from "@module/Suspension";
import { LoginMethod, recordLogin } from "@module/LoginLog";
import { User } from "@type/user";

/**
 * The login response, or 403/4041 for a user with a ban in force (contract
 * v4 §5.1). An expired suspension is cleared. A successful login is
 * recorded in the login log (§5.3).
 */
function loggedIn(
  req: Request,
  res: Response,
  userData: User,
  method: LoginMethod,
) {
  const suspension = activeSuspension(userData.suspension);
  if (suspension?.type === "ban") return sendSuspended(res, suspension);
  if (isExpiredSuspension(userData.suspension))
    clearExpiredSuspension(String(userData._id));

  recordLogin({
    user: String(userData._id),
    method,
    ip: req.ip,
    userAgent: req.header("user-agent"),
  });

  const jwt = signJWT({ id: userData._id });
  return res.status(HttpStatus.OK).json({
    status: CustomStatus.OK,
    authorization: `Bearer ${jwt}`,
    data: withActiveSuspension(withNotificationSettings(userData)),
  });
}

export const login: RequestHandler = async (req, res) => {
  try {
    // const checker = new CheckRequestRequirement(req);
    // checker.matchBody(["googleToken", "session"]);

    const googleToken: string = req.body?.googleToken;
    const session: string = req.body?.session;

    if (!googleToken && !session) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ status: CustomStatus.INVALID_BODY });
    }

    if (googleToken) {
      const googleUserData = await getGoogleUserData(googleToken);
      const userData = await getUserData(
        googleUserData.email,
        googleUserData.picture,
      );

      return loggedIn(req, res, userData, "google");
    } else if (session) {
      const userData = await getUserDataBySession(session);
      if (!userData) {
        return res
          .status(HttpStatus.UNAUTHORIZED)
          .json({ status: CustomStatus.INVALID_SESSION });
      }
      return loggedIn(req, res, userData, "session");
    }
  } catch (error: any) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
