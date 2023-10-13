import { RequestHandler } from "express";

import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { HttpStatus } from "@module/HttpStatusCode";
import { CustomStatus } from "@module/CustomStatusCode";
import signJWT from "@module/SignJWT";
import getUserData from "@module/GetUserData";
import getGoogleUserData from "@module/GetGoogleUserData";


export const login: RequestHandler = async (req, res) => {
    try {
        const checker = new CheckRequestRequirement(req);
        checker.matchBody(["googleToken"]);

        const googleToken: string = req.body.googleToken;

        const googleUserData = await getGoogleUserData(googleToken);
        const userData = await getUserData(googleUserData.email, googleUserData.picture);

        const jwt = signJWT({ id: userData._id });
        return res.status(HttpStatus.OK).json({
            status: CustomStatus.OK,
            authorization: "Bearer " + jwt,
            data: userData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};
