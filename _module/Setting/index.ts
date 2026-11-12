import mongoose from "mongoose";

/**
 * Site settings edited by admins, one document per key (contract v4 §5.11):
 * `{ key, value, updatedBy }` with timestamps.
 *
 * Collection: `setting`. Indexes are built at startup by
 * @module/EnsureIndexes once a router imports this module.
 */

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, minimize: false },
);

settingSchema.index({ key: 1 }, { unique: true });

export const SettingModel =
  (mongoose.models.setting as mongoose.Model<any>) ??
  mongoose.model("setting", settingSchema, "setting");

/** The stored setting (plain object), or null. */
export async function readSetting(key: string) {
  return (await SettingModel.findOne({ key }).lean()) as any;
}

/** Creates or replaces the setting's value; returns the stored setting. */
export async function writeSetting(key: string, value: unknown, by: string) {
  return (await SettingModel.findOneAndUpdate(
    { key },
    { $set: { value, updatedBy: by } },
    { upsert: true, returnDocument: "after" },
  ).lean()) as any;
}
