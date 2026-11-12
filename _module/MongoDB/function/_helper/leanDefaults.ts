import { Model } from "mongoose";

/**
 * Fills in schema defaults that a .lean() result lacks, so a lean read returns
 * the same JSON as a hydrated Mongoose document: when a stored document misses
 * a field that has a default (for example `likes` or an array), Mongoose adds
 * it on hydration and puts the defaulted fields first, in schema order.
 */
export default function leanDefaults<T extends object>(
  model: Model<any>,
  doc: T,
): T {
  if (!doc) return doc;

  const defaults: Record<string, unknown> = {};
  let hasDefaults = false;

  for (const [path, schemaType] of Object.entries(model.schema.paths)) {
    if (path === "_id" || path.includes(".")) continue;
    if ((doc as Record<string, unknown>)[path] !== undefined) continue;

    const defaultValue = (schemaType as any).defaultValue;
    if (defaultValue === undefined) continue;

    defaults[path] =
      typeof defaultValue === "function"
        ? defaultValue.call(doc)
        : defaultValue;
    hasDefaults = true;
  }

  return hasDefaults ? ({ ...defaults, ...doc } as T) : doc;
}
