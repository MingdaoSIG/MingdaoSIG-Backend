import MongoDB from "@module/MongoDB";
import { managedSigsFilter } from "@module/Permission";
import { followedSigIds } from "@module/SigFollow";

const AdminDB = new MongoDB.Admin();

/**
 * The SIGs whose posts make up a user's weekly digest: the SIGs they are a
 * member of (`user.sig`) and the SIGs they lead or advise (`sig.leader` /
 * `sig.moderator`). With `followed`, also the SIGs they follow
 * (`sig.follower`, contract v4 §6.1), as the my-SIG feed and the "mine"
 * event list use.
 */
export async function userSigIds(
  userId: string,
  memberOf: string[] = [],
  option: { followed?: boolean } = {},
) {
  const [managed, followed] = await Promise.all([
    AdminDB.sigIds(managedSigsFilter(userId)),
    option.followed ? followedSigIds(userId) : Promise.resolve([]),
  ]);
  return Array.from(
    new Set([...memberOf.map(String), ...managed, ...followed]),
  );
}
