import { RequestHandler } from "express";
import jwt, { Secret } from "jsonwebtoken";

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

        const email = req.body.email;
        const avatar = req.body.avatar;

        console.log(email, avatar);
        if (!avatar || !avatar.includes("https://")) throw new CustomError(CustomStatus.INVALID_BODY, new Error("Invalid avatar"));

        const userData = await getUserData(email, avatar);

        const token = signJWT(userData);
        return res.status(HttpStatus.OK).header({ "Authorization": "Bearer " + token }).json({ status: CustomStatus.OK });
    }
    catch (error: any) {
        return res.status(HttpStatus.BAD_REQUEST).json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
    }
};