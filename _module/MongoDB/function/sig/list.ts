import { Sig, SigFilter } from "@type/sig";
import { ReadOption } from "@type/database";
import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import leanDefaults from "@DBfunc/_helper/leanDefaults";

export default async function list(search: SigFilter, option?: ReadOption) {
  try {
    const { lean, projection } = option || {};
    const query = sig.find(search, projection);

    const data = lean
      ? await query
          .lean()
          .then((docs) =>
            projection ? docs : docs.map((doc) => leanDefaults(sig, doc)),
          )
      : await query;

    if (!data) {
      throw new Error("Sig not found");
    }

    return data as unknown as Sig[];
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_SIG_FROM_DB, error);
  }
}
