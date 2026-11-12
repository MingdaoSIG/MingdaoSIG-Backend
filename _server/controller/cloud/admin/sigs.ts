import { RequestHandler } from "express";

import { CustomStatus } from "@module/CustomStatusCode";
import { HttpStatus } from "@module/HttpStatusCode";
import MongoDB from "@module/MongoDB";
import { isAdmin, managedSigsFilter } from "@module/Permission";
import { sigIdsWithDiscordWebhook } from "@module/DiscordWebhook";
import { caller, callerId, fail, sendError } from "./_shared";

const AdminDB = new MongoDB.Admin();

const PERSON_FIELDS = { name: 1, customId: 1, avatar: 1 } as const;

// GET /admin/sigs: every non-removed SIG for an admin, the non-removed SIGs
// they manage for a SIG manager, 403 for anyone else.
export const listSigs: RequestHandler = async (req, res) => {
  try {
    const userId = callerId(req);
    const admin = isAdmin(caller(req));

    if (!admin) {
      const managed = await AdminDB.sigIds(managedSigsFilter(userId));
      if (managed.length === 0)
        fail(CustomStatus.FORBIDDEN, "Not an admin or SIG manager");
    }

    const sigs = await AdminDB.listSigs(
      admin
        ? { removed: false }
        : { removed: false, ...managedSigsFilter(userId) },
    );
    const ids = sigs.map((sig) => String(sig._id));

    const [people, members, pending, withWebhook] = await Promise.all([
      AdminDB.usersByIds(
        sigs.flatMap((sig) => [
          ...(sig.leader ?? []),
          ...(sig.moderator ?? []),
        ]),
        PERSON_FIELDS,
      ),
      AdminDB.memberCounts(ids),
      AdminDB.pendingJoinRequestCounts(ids),
      sigIdsWithDiscordWebhook(ids),
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
          // Never the URL itself (contract v4 §3.6)
          discordWebhookSet: withWebhook.has(id),
        };
      }),
    });
  } catch (error) {
    return sendError(res, error);
  }
};
