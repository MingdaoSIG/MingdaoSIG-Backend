import { User, UserFilter } from "@type/user";
import { ReadOption } from "@type/database";
import user from "@schema/user";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import leanDefaults from "@DBfunc/_helper/leanDefaults";

export default async function list(search: UserFilter, option?: ReadOption) {
  try {
    const { lean, projection } = option || {};
    const query = user.find(search, projection);

    const data = lean
      ? await query
          .lean()
          .then((docs) =>
            projection ? docs : docs.map((doc) => leanDefaults(user, doc)),
          )
      : await query;

    if (!data) {
      throw new Error("User not found");
    }

    return data as unknown as User[];
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}
