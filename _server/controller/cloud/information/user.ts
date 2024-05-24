import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { Analysis } from "@module/Analysis";


const analysis = new Analysis();

export const users: RequestHandler = async (req, res) => {
  try {
    new CheckRequestRequirement(req).onlyIncludesQuery(["date"]);

    const date = req.query.date as string;

    const result = await analysis.users(undefined, new Date(date));
    const { title, content } = result;

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: { title, content } });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const postUsers: RequestHandler = async (req, res) => {
  try {
    new CheckRequestRequirement(req).onlyIncludesQuery(["date"]);

    const date = req.query.date as string;

    const result = await analysis.posted_users(undefined, new Date(date));
    const { title, content } = result;

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: { title, content } });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};

export const usersOfEachSigs: RequestHandler = async (req, res) => {
  try {
    new CheckRequestRequirement(req).onlyIncludesQuery(["date"]);

    const date = req.query.date as string;

    const result = await analysis.sig_users(undefined, new Date(date));
    const { title, content } = result;

    return res
      .status(HttpStatus.OK)
      .json({ status: CustomStatus.OK, data: { title, content } });
  }
  catch (error: any) {
    return res
      .status(HttpStatus.NOT_FOUND)
      .json({ status: error.statusCode || CustomStatus.UNKNOWN_ERROR });
  }
};
