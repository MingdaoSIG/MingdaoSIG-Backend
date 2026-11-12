import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { isAdmin, managedSigsFilter } from "@module/Permission";
import { sigColor, sigDefaultCover } from "@module/SigDefaults";
import { caller, callerId, fail, queryEnum, sendError } from "./_shared";

const AdminDB = new MongoDB.Admin();

const PERSON_FIELDS = { name: 1, customId: 1, avatar: 1 } as const;

// GET /admin/sigs: every non-removed SIG for an admin, the non-removed SIGs
// they manage for a SIG manager, 403 for anyone else. `?archived=1` (admin
// only) lists the archived SIGs instead.
export const listSigs: RequestHandler = async (req, res) => {
  try {
    const userId = callerId(req);
    const admin = isAdmin(caller(req));
    const archived = queryEnum(req, "archived", ["0", "1"] as const, "0");

    if (!admin) {
      if (archived === "1")
        fail(CustomStatus.FORBIDDEN, "Only an admin can list archived SIGs");
      const managed = await AdminDB.sigIds(managedSigsFilter(userId));
      if (managed.length === 0)
        fail(CustomStatus.FORBIDDEN, "Not an admin or SIG manager");
    }

    const removed = archived === "1";
    const sigs = await AdminDB.listSigs(
      admin ? { removed } : { removed, ...managedSigsFilter(userId) },
    );
    const ids = sigs.map((sig) => String(sig._id));

    const [people, members, pending] = await Promise.all([
      AdminDB.usersByIds(
        sigs.flatMap((sig) => [
          ...(sig.leader ?? []),
          ...(sig.moderator ?? []),
        ]),
        PERSON_FIELDS,
      ),
      AdminDB.memberCounts(ids),
      AdminDB.pendingJoinRequestCounts(ids),
    ]);

    // In the SIG's own order; ids of deleted users are left out.
    const peopleFor = (list: string[] | undefined) =>
      Array.from(new Set(list ?? []))
        .filter((id) => people.has(String(id)))
        .map((id) => {
          const person = people.get(String(id));
          return {
            _id: String(id),
            name: person.name ?? "",
            customId: person.customId ?? "",
            avatar: person.avatar ?? "",
          };
        });

    return res.status(HttpStatus.OK).json({
      status: CustomStatus.OK,
      data: sigs.map((sig) => {
        const id = String(sig._id);
        return {
          _id: id,
          name: sig.name ?? "",
          customId: sig.customId ?? "",
          avatar: sig.avatar ?? "",
          description: sig.description ?? "",
          memberCount: members[id] ?? 0,
          leaders: peopleFor(sig.leader),
          moderators: peopleFor(sig.moderator),
          pendingJoinRequests: pending[id] ?? 0,
          color: sigColor(sig),
          defaultCover: sigDefaultCover(sig),
          archived: Boolean(sig.removed),
          previousCustomIds: sig.previousCustomIds ?? [],
        };
      }),
    });
  } catch (error) {
    return sendError(res, error);
  }
};
