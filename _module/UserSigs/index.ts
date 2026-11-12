import MongoDB from "@module/MongoDB";
import { managedSigsFilter } from "@module/Permission";

const AdminDB = new MongoDB.Admin();

/**
 * The SIGs whose posts make up a user's my-SIG feed and weekly digest: the
 * SIGs they are a member of (`user.sig`) and the SIGs they lead or advise
 * (`sig.leader` / `sig.moderator`).
 */
export async function userSigIds(userId: string, memberOf: string[] = []) {
  const managed = await AdminDB.sigIds(managedSigsFilter(userId));
  return Array.from(new Set([...memberOf.map(String), ...managed]));
}
