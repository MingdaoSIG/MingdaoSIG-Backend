import { ObjectId } from "mongoose";

import { Sig, SigWrite } from "@type/sig";
import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

export default async function write(
  id: string | ObjectId,
  dataToSave: SigWrite,
) {
  try {
    const data = await sig.findOne({ _id: id });
    const code = data ? 1 : 0;

    if (code) {
      return (await sig.findOneAndUpdate({ _id: id }, dataToSave, {
        returnDocument: "after",
      })) as unknown as Sig;
    } else {
      return (await sig.create(dataToSave)) as unknown as Sig;
    }
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_WRITING_SIG_TO_DB, error);
  }
}

/**
 * Sets `dataToSet` on the SIG matching `guard` too (for example its current
 * customId, so two renames at once cannot both apply). Returns the updated
 * SIG, or null when nothing matched.
 */
export async function update(
  id: string | ObjectId,
  dataToSet: Record<string, unknown>,
  guard: Record<string, unknown> = {},
) {
  try {
    return (await sig.findOneAndUpdate(
      { ...guard, _id: id },
      { $set: dataToSet },
      { returnDocument: "after" },
    )) as unknown as Sig | null;
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_WRITING_SIG_TO_DB, error);
  }
}

/** Creates a SIG with no members, leaders or moderators. */
export async function create(dataToSave: SigWrite) {
  try {
    return (await sig.create({
      follower: [],
      moderator: [],
      leader: [],
      removed: false,
      ...dataToSave,
    })) as unknown as Sig;
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_WRITING_SIG_TO_DB, error);
  }
}
