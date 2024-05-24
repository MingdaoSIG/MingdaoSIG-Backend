import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import CheckRequestRequirement from "@module/CheckRequestRequirement";
import { Analysis } from "@module/Analysis";


const analysis = new Analysis();

export const posts: RequestHandler = async (req, res) => {
  try {
    new CheckRequestRequirement(req).onlyIncludesQuery(["date"]);

    const date = req.query.date as string;

    const result = await analysis.posts(undefined, new Date(date));
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

export const postsOfEachSigs: RequestHandler = async (req, res) => {
  try {
    new CheckRequestRequirement(req).onlyIncludesQuery(["date"]);

    const date = req.query.date as string;

    const result = await analysis.posts_of_each_sigs(
      undefined,
      new Date(date)
    );
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
