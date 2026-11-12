import { User } from "@type/user";

// What other people may see about a user: what the frontend renders on
// profiles, post bylines and comments. Email, student number (code), class,
// identity, SIG memberships, followers and permission stay private; the user
// gets them from /login, /user/me or /user/:id/full.
export const PUBLIC_USER_FIELDS = [
  "_id",
  "customId",
  "name",
  "avatar",
  "description",
  "badge",
] as const;

export type PublicUser = Pick<User, (typeof PUBLIC_USER_FIELDS)[number]>;

export default function toPublicUser(user: User): PublicUser {
  const publicUser: Partial<PublicUser> = {};
  for (const field of PUBLIC_USER_FIELDS) {
    if (user[field] !== undefined) {
      (publicUser as any)[field] = user[field];
    }
  }
  return publicUser as PublicUser;
}
