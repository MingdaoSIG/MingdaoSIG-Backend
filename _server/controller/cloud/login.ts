import { RequestHandler } from "express";

import CustomError from "@type/customError";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { HttpStatus } from "@module/HttpStatusCode";
import { getUserData } from "@module/GetUserData";
import { CustomStatus } from "@module/CustomStatusCode";
import signJWT from "@module/SignJWT";


export const login: RequestHandler = async (req, res) => {
    try {
        const checker = new CheckRequestRequirement(req);
        checker.hasBody(["email", "avatar"]);

        const email: string = req.body.email;
        const avatar: string = req.body.avatar;

        if (!avatar || !avatar.startsWith("https://")) throw new CustomError(CustomStatus.INVALID_BODY, new Error("Invalid avatar"));

        const userData = await getUserData(email, avatar);

        const token = signJWT({ _id: userData._id });
        return res.status(HttpStatus.OK).json({
            "status": CustomStatus.OK,
            "authorization": "Bearer " + token,
            "data": userData
        });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};