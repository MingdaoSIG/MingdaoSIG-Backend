import { RequestHandler } from "express";

import { ExtendedRequest } from "@type/request";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { userSigIds } from "@module/UserSigs";
import { pagination, sendError } from "@controller/cloud/admin/_shared";
import { toPostListItems } from "./_listItems";

const PostDB = new MongoDB.Post();

/**
 * GET /post/list/mysig?skip&limit (JWT, contract v4 §2.5, §6.1): non-removed
 * posts of the SIGs the caller is a member of, manages or follows (see
 * userSigIds), newest first, with `total`. Same items as GET /post/list. No
 * SIG means an empty list.
 */
export const listMySig: RequestHandler = async (req, res) => {
  try {
    const { skip, limit } = pagination(req);
    const user = (req as unknown as ExtendedRequest).userData;
    const sigIds = await userSigIds(String(user._id), user.sig ?? [], {
      followed: true,
    });
    if (sigIds.length === 0) {
      return res
        .status(HttpStatus.OK)
        .json({ status: CustomStatus.OK, data: [], total: 0 });
    }

    const filter = { sig: { $in: sigIds }, removed: false };
    const [posts, total] = await Promise.all([
      PostDB.list(filter, {
        skip,
        limit,
        sort: { createdAt: -1, _id: -1 },
      }),
      PostDB.count(filter),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: await toPostListItems(posts),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
