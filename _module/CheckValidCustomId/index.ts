import user from "@schema/user";
import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";
import { ANNOUNCEMENT_SIG_ID } from "@module/Permission";

/**
 * customIds are shared by users and SIGs: `/@<id>` (frontend) looks the id up
 * as both. Lowercase a-z, 0-9 and "_", in parts joined by single dots.
 * Users pick at most 25 characters; SIG ids are longer (33 today), so they
 * may use up to 50, the length the frontend route accepts.
 */
export const USER_CUSTOM_ID_MAX_LENGTH = 25;
export const SIG_CUSTOM_ID_MAX_LENGTH = 50;
const CUSTOM_ID_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export default async function CheckValidCustomId(customId: string) {
  CheckPattern(customId);
  await CheckExists(customId);
}

function CheckPattern(customId: string) {
  const regex = /^(?=.{1,25}$)[a-z0-9_]+(\.[a-z0-9_]+)*$/gm;
  if (customId && !regex.test(customId))
    throw new CustomError(
      CustomStatus.INVALID_BODY,
      new Error("Invalid custom id"),
    );
}

async function CheckExists(customId: string) {
  if (await isCustomIdTaken(customId))
    throw new CustomError(
      CustomStatus.CUSTOM_ID_ALREADY_EXISTS,
      new Error("Custom id already exists"),
    );
}

/** Whether `customId` has the customId format and at most `maxLength`. */
export function isCustomIdFormat(customId: unknown, maxLength: number) {
  return (
    typeof customId === "string" &&
    customId.length >= 1 &&
    customId.length <= maxLength &&
    CUSTOM_ID_PATTERN.test(customId)
  );
}

/**
 * Whether a user or SIG other than `except` uses `customId`, as its current
 * id or as an old one that still redirects (`previousCustomIds`).
 */
export async function isCustomIdTaken(
  customId: string,
  except: { user?: string; sig?: string } = {},
) {
  const uses = { $or: [{ customId }, { previousCustomIds: customId }] };
  const [userTaken, sigTaken] = await Promise.all([
    user.exists(except.user ? { ...uses, _id: { $ne: except.user } } : uses),
    sig.exists(except.sig ? { ...uses, _id: { $ne: except.sig } } : uses),
  ]);
  return Boolean(userTaken || sigTaken);
}

/**
 * Checks a customId an admin sets on a user or a SIG: the format (4021)
 * and that nobody else uses it, now or as an old id (4022).
 */
export async function assertCustomIdAvailable(
  customId: unknown,
  target: { kind: "user" | "sig"; id?: string },
): Promise<string> {
  const maxLength =
    target.kind === "user"
      ? USER_CUSTOM_ID_MAX_LENGTH
      : SIG_CUSTOM_ID_MAX_LENGTH;
  if (!isCustomIdFormat(customId, maxLength))
    throw new CustomError(
      CustomStatus.INVALID_CUSTOM_ID,
      new Error(
        `customId must be 1 to ${maxLength} characters: a-z, 0-9 and _, in parts joined by single dots`,
      ),
    );

  const value = customId as string;
  if (await isCustomIdTaken(value, { [target.kind]: target.id }))
    throw new CustomError(
      CustomStatus.CUSTOM_ID_ALREADY_EXISTS,
      new Error("Custom id already exists"),
    );
  return value;
}

// ---- Lookups by customId (current or old) -----------------------------------

/** A SIG counts as active when it is not archived, or is the announcement SIG. */
function isActiveSig(doc: { _id?: unknown; removed?: boolean }) {
  return !doc.removed || String(doc._id) === ANNOUNCEMENT_SIG_ID;
}

/**
 * The SIG for `GET /sig/@:customId`, in this order:
 * 1. an active SIG whose customId it is;
 * 2. an active SIG that used it before (`redirectTo` its current id);
 * 3. an archived SIG whose customId it is (as before contract v4);
 * 4. an archived SIG that used it before (`redirectTo`).
 * A merged SIG is archived and keeps its customId, which the target also
 * lists in `previousCustomIds`; step 2 sends its links to the target.
 * Returns hydrated documents, like the other SIG reads.
 */
export async function findSigByCustomId(customId: string) {
  const [current, previous] = await Promise.all([
    sig.find({ customId }).sort({ _id: 1 }),
    sig.find({ previousCustomIds: customId }).sort({ _id: 1 }),
  ]);
  const activeCurrent = current.find(isActiveSig);
  if (activeCurrent) return { sig: activeCurrent, redirectTo: null };

  const activePrevious = previous.find(isActiveSig);
  if (activePrevious)
    return { sig: activePrevious, redirectTo: activePrevious.customId ?? null };

  if (current[0]) return { sig: current[0], redirectTo: null };
  if (previous[0])
    return { sig: previous[0], redirectTo: previous[0].customId ?? null };
  return null;
}

/**
 * The user who used `customId` before (`GET /user/@:id` when no user has it
 * now), unless an active SIG has it now: the frontend tries the user first,
 * so a redirect here would hide that SIG.
 */
export async function findUserByPreviousCustomId(customId: string) {
  const previous = await user
    .findOne({ previousCustomIds: customId })
    .sort({ _id: 1 });
  if (!previous?.customId) return null;

  const sigsNow = await sig.find({ customId }, { removed: 1 }).lean();
  if (sigsNow.some(isActiveSig)) return null;

  return { user: previous, redirectTo: previous.customId };
}
