import { RequestHandler } from "express";
import { decode } from "jsonwebtoken";

import CustomError from "@type/customError";
import { GoogleUserData } from "@type/googleUserData";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { HttpStatus } from "@module/HttpStatusCode";
import { getUserData } from "@module/GetUserData";
import { CustomStatus } from "@module/CustomStatusCode";
import signJWT from "@module/SignJWT";


export const login: RequestHandler = async (req, res) => {
    try {
        const checker = new CheckRequestRequirement(req);
        checker.hasBody(["googleToken"]);

        const googleToken: string = req.body.googleToken;

        const decodedToken = decode(googleToken);
        if (!decodedToken || typeof (decodedToken) !== "object") throw new CustomError(CustomStatus.INVALID_JWT, new Error("Invalid JWT"));
        const googleUserData: GoogleUserData = decodedToken! as GoogleUserData;

        const userData = await getUserData(googleUserData.email, googleUserData.picture);

        const jwt = signJWT({ _id: userData._id });
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
