import { isValidObjectId } from "mongoose";

import user from "@schema/user";
import post from "@schema/post";
import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

type Projection = Record<string, 0 | 1>;

function validIds(ids: Iterable<unknown>) {
  return Array.from(new Set(Array.from(ids, (id) => String(id ?? "")))).filter(
    (id) => isValidObjectId(id),
  );
}

async function byId(
  model: typeof user | typeof post | typeof sig,
  ids: Iterable<unknown>,
  projection: Projection,
): Promise<Map<string, any>> {
  const list = validIds(ids);
  const map = new Map<string, any>();
  if (list.length === 0) return map;

  const docs: any[] = await (model as any)
    .find({ _id: { $in: list } }, projection)
    .lean();
  for (const doc of docs) map.set(String(doc._id), doc);
  return map;
}

/** Users by id (only the projected fields), keyed by the id string. */
export async function usersByIds(
  ids: Iterable<unknown>,
  projection: Projection,
) {
  try {
    return await byId(user, ids, projection);
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}

/** Posts by id, removed ones included, keyed by the id string. */
export async function postsByIds(
  ids: Iterable<unknown>,
  projection: Projection,
) {
  try {
    return await byId(post, ids, projection);
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
  }
}

/** SIGs by id, removed ones included, keyed by the id string. */
export async function sigsByIds(
  ids: Iterable<unknown>,
  projection: Projection,
) {
  try {
    return await byId(sig, ids, projection);
  } catch (error) {
    throw new CustomError(CustomStatus.ERROR_READING_SIG_FROM_DB, error);
  }
}
