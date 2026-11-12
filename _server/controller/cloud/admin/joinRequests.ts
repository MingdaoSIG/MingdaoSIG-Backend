import { RequestHandler } from "express";

import { Filter } from "@type/database";
import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { canManageSig, isAdmin, managedSigsFilter } from "@module/Permission";
import { recordAudit } from "@module/Audit";
import { decideJoinRequest } from "@controller/cloud/sig/confirm";
import { joinRequestAnswers } from "@module/SigSettings";
import {
  caller,
  callerId,
  exactBody,
  fail,
  pagination,
  pathId,
  queryEnum,
  queryId,
  sendError,
} from "./_shared";

const AdminDB = new MongoDB.Admin();
const SigDB = new MongoDB.Sig();
const JoinRequestDB = new MongoDB.JoinRequest();

const STATUSES = ["pending", "accepted", "rejected", "all"] as const;

// GET /admin/join-requests: every SIG for an admin, the SIGs they manage for
// a SIG manager, 403 for anyone else. Oldest first for pending requests,
// newest first otherwise.
export const listJoinRequests: RequestHandler = async (req, res) => {
  try {
    const sig = queryId(req, "sig");
    const status = queryEnum(req, "status", STATUSES, "pending");
    const { skip, limit } = pagination(req);

    const filter: Filter = { removed: false };
    if (status !== "all") filter.state = status;

    if (isAdmin(caller(req))) {
      if (sig) filter.sig = sig;
    } else {
      const managed = await AdminDB.sigIds(managedSigsFilter(callerId(req)));
      if (managed.length === 0)
        fail(CustomStatus.FORBIDDEN, "Not an admin or SIG manager");
      if (sig && !managed.includes(sig))
        fail(CustomStatus.FORBIDDEN, "Not a manager of this SIG");
      filter.sig = sig ?? { $in: managed };
    }

    const { data, total } = await AdminDB.listJoinRequests(filter, {
      skip,
      limit,
      sort:
        status === "pending"
          ? { createdAt: 1, _id: 1 }
          : { createdAt: -1, _id: -1 },
    });

    const [users, sigs] = await Promise.all([
      AdminDB.usersByIds(
        data.map((request) => request.user),
        { name: 1, customId: 1, class: 1, avatar: 1 },
      ),
      AdminDB.sigsByIds(
        data.map((request) => request.sig),
        { name: 1 },
      ),
    ]);

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: data.map((request) => {
        const user = users.get(String(request.user));
        return {
          _id: String(request._id),
          user: {
            _id: request.user ?? "",
            name: user?.name ?? "",
            customId: user?.customId ?? "",
            class: user?.class ?? "",
            avatar: user?.avatar ?? "",
          },
          sig: {
            _id: request.sig ?? "",
            name: sigs.get(String(request.sig))?.name ?? "",
          },
          // Labelled answers (contract v4 §5.6); older requests get the
          // default labels.
          answers: joinRequestAnswers(request),
          q1: request.q1 ?? "",
          q2: request.q2 ?? "",
          q3: request.q3 ?? "",
          state: request.state,
          createdAt: request.createdAt ?? null,
          updatedAt: request.updatedAt ?? null,
        };
      }),
      total,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /admin/join-requests/:id/decision { accept }: admin, or a manager of
// the request's SIG. Same effect as the email link (decideJoinRequest).
export const decide: RequestHandler = async (req, res) => {
  try {
    const id = pathId(req);
    const { accept } = exactBody(req, ["accept"]);
    if (typeof accept !== "boolean")
      fail(CustomStatus.INVALID_BODY, "accept must be true or false");

    const request = await JoinRequestDB.read({ id }).catch(() => null);
    if (!request) fail(CustomStatus.NOT_FOUND, "Join request not found");

    const sig = await SigDB.read({ id: request.sig }).catch(() => null);
    if (!canManageSig(caller(req), sig))
      fail(CustomStatus.FORBIDDEN, "Not a manager of this SIG");

    const saved = await decideJoinRequest(request, accept);

    const applicant = await AdminDB.usersByIds([request.user], { name: 1 });
    await recordAudit({
      actor: callerId(req),
      action: accept ? "join.accept" : "join.reject",
      target: {
        kind: "join",
        id,
        label: applicant.get(String(request.user))?.name ?? "",
      },
      meta: { sig: request.sig, user: request.user },
    });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: {
        _id: id,
        user: saved.user,
        sig: saved.sig,
        state: saved.state,
        updatedAt: (saved as any).updatedAt ?? null,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
