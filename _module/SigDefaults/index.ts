import sig from "@schema/sig";

/**
 * SIG colours and default post covers used to be hardcoded (here, in the
 * frontend editors and in two frontend `sigDefaultColors.ts` files). Since
 * API contract v4 §3.7 they are SIG data (`sig.color`, `sig.defaultCover`)
 * that admins edit. These tables are the old values: the startup backfill
 * copies them into SIGs that have none, and they remain the fallback for a
 * SIG whose field is still empty.
 */

// Image ids (served by GET /image/:id), the same table as the frontend's
// app/new/(new)/apis/postAPI.ts.
export const LEGACY_DEFAULT_COVERS: Readonly<Record<string, string>> = {
  "6529ed87df4ae96f279cd5e3": "653299ff0b891d1f6b5b4460", // 資訊程式設計
  "6529ee3cdf4ae96f279cd5e4": "653297ed0b891d1f6b5b4416", // 機器人
  "6529ee57df4ae96f279cd5e5": "653299f10b891d1f6b5b445c", // 建築設計
  "6529eed9df4ae96f279cd5e6": "6532988f0b891d1f6b5b4432", // 生科動科與環境
  "6529eeeddf4ae96f279cd5e7": "653298e00b891d1f6b5b4446", // 醫學
  "6529efbfdf4ae96f279cd5ec": "6532983d0b891d1f6b5b4422", // 醫學相關
  "6529efe9df4ae96f279cd5ee": "6532982d0b891d1f6b5b441e", // 法政
  "6529effbdf4ae96f279cd5ef": "653298c70b891d1f6b5b4442", // 社心教育
  "6529f011df4ae96f279cd5f0": "65329a0f0b891d1f6b5b4464", // 音樂表藝
  "6529f05ddf4ae96f279cd5f1": "653298fa0b891d1f6b5b444e", // 大眾傳播
  "6529f06edf4ae96f279cd5f2": "653298490b891d1f6b5b4426", // 文史哲
  "6529f094df4ae96f279cd5f4": "653298b00b891d1f6b5b443e", // 無人機
  "6529f0a2df4ae96f279cd5f5": "653298620b891d1f6b5b442e", // 經濟管科
  "6529f0c4df4ae96f279cd5f6": "653298a60b891d1f6b5b443a", // 元宇宙
  "6529f0dbdf4ae96f279cd5f7": "653298570b891d1f6b5b442a", // 直播
  "6529f0eedf4ae96f279cd5f8": "653298110b891d1f6b5b441a", // 科學教育
  "652d60b842cdf6a660c2b778": "653299930b891d1f6b5b4458", // 公告
  "65321d65e226c78161c22807": "653298990b891d1f6b5b4436", // 遊憩運動
  "65321d83e226c78161c22808": "653299040b891d1f6b5b4452", // 電機物理
  "6ad18a858a01ead1f9d558a7": "6ad18a858a01ead1f9d558a8", // 模擬聯合國
  "6ad18a858a01ead1f9d558a9": "6ad18a858a01ead1f9d558aa", // 數學
};

// The frontend's components/Threads/configs/sigDefaultColors.ts, by SIG id.
const LEGACY_RGB_BY_ID: Readonly<Record<string, string>> = {
  "6529ed87df4ae96f279cd5e3": "rgb(35, 135, 200)", // 資訊程式設計
  "6529ee3cdf4ae96f279cd5e4": "rgb(35, 135, 200)", // 機器人設計與製造
  "6529ee57df4ae96f279cd5e5": "rgb(35, 135, 200)", // 建築設計
  "6529eed9df4ae96f279cd5e6": "rgb(0, 170, 115)", // 生科動科與環境
  "6529eeeddf4ae96f279cd5e7": "rgb(0, 170, 115)", // 醫學
  "6529efbfdf4ae96f279cd5ec": "rgb(0, 170, 115)", // 醫學相關
  "6529efe9df4ae96f279cd5ee": "rgb(160, 100, 55)", // 法政
  "6529effbdf4ae96f279cd5ef": "rgb(160, 100, 55)", // 社心教育
  "6529f011df4ae96f279cd5f0": "rgb(250, 170, 190)", // 音樂表藝
  "6529f05ddf4ae96f279cd5f1": "rgb(250, 170, 190)", // 大眾傳播
  "6529f06edf4ae96f279cd5f2": "rgb(250, 170, 190)", // 文史哲
  "6529f094df4ae96f279cd5f4": "rgb(35, 135, 200)", // 無人機
  "6529f0a2df4ae96f279cd5f5": "rgb(250, 170, 190)", // 經濟管科
  "6529f0c4df4ae96f279cd5f6": "rgb(250, 170, 190)", // 元宇宙
  "6529f0dbdf4ae96f279cd5f7": "rgb(250, 170, 190)", // 直播
  "6529f0eedf4ae96f279cd5f8": "rgb(35, 135, 200)", // 科學教育
  "652b851ca1bd096e024475c4": "rgb(35, 135, 200)", // 雲端
  "65321d65e226c78161c22807": "rgb(35, 135, 200)", // 遊憩運動
  "65321d83e226c78161c22808": "rgb(35, 135, 200)", // 電機物理
  "6ad18a858a01ead1f9d558a7": "rgb(160, 100, 55)", // 模擬聯合國
  "6ad18a858a01ead1f9d558a9": "rgb(35, 135, 200)", // 數學
};

// The dashboard's app/dashboard/(Dashboard)/config/sigDefaultColors.ts
// (sigDefaultBorderColors), by SIG name: used for a SIG whose id is not in
// the table above (another database, such as beta, with other ids).
const LEGACY_RGB_BY_NAME: Readonly<Record<string, string>> = {
  資訊程式設計: "rgb(35, 135, 200)",
  機器人設計與製造: "rgb(35, 135, 200)",
  建築設計: "rgb(35, 135, 200)",
  生科動科與環境: "rgb(0, 170, 115)",
  醫學: "rgb(0, 170, 115)",
  醫學相關: "rgb(0, 170, 115)",
  法政: "rgb(160, 100, 55)",
  社心教育: "rgb(160, 100, 55)",
  音樂表藝: "rgb(250, 170, 190)",
  大眾傳播: "rgb(250, 170, 190)",
  文史哲: "rgb(250, 170, 190)",
  無人機: "rgb(35, 135, 200)",
  經濟管科: "rgb(250, 170, 190)",
  元宇宙: "rgb(250, 170, 190)",
  直播: "rgb(250, 170, 190)",
  科學教育: "rgb(35, 135, 200)",
  雲端: "rgb(35, 135, 200)",
  遊憩運動: "rgb(35, 135, 200)",
  電機物理: "rgb(35, 135, 200)",
  模擬聯合國: "rgb(160, 100, 55)",
  數學: "rgb(35, 135, 200)",
};

/** "rgb(35, 135, 200)" → "#2387c8". */
function rgbToHex(rgb: string) {
  const parts = rgb.match(/\d+/g) ?? [];
  return `#${parts
    .slice(0, 3)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** The old hardcoded default cover of a SIG, or "". */
export function legacyDefaultCover(sigId: unknown) {
  return LEGACY_DEFAULT_COVERS[String(sigId ?? "")] ?? "";
}

/** The old hardcoded colour of a SIG as #rrggbb, or "". */
export function legacyColor(sigId: unknown, name?: string | null) {
  const rgb =
    LEGACY_RGB_BY_ID[String(sigId ?? "")] ??
    (name ? LEGACY_RGB_BY_NAME[name] : undefined);
  return rgb ? rgbToHex(rgb) : "";
}

type SigLike = {
  _id?: unknown;
  name?: string | null;
  color?: string | null;
  defaultCover?: string | null;
};

/** The SIG's default post cover: its own, else the old table, else "". */
export function sigDefaultCover(sigData: SigLike | null | undefined) {
  return sigData?.defaultCover || legacyDefaultCover(sigData?._id);
}

/** The SIG's colour: its own, else the old tables, else "". */
export function sigColor(sigData: SigLike | null | undefined) {
  return sigData?.color || legacyColor(sigData?._id, sigData?.name);
}

/**
 * Copies the old default covers and colours into SIGs whose field is empty.
 * Runs at every startup and is idempotent: it only fills a field that is
 * missing, null or "", and the update re-checks that, so a value an admin
 * set (even meanwhile) is never overwritten. Logs each change and a summary.
 */
export async function backfillSigDefaults() {
  const sigs: SigLike[] = await sig
    .find({}, { name: 1, color: 1, defaultCover: 1 })
    .lean();

  let covers = 0;
  let colors = 0;
  for (const doc of sigs) {
    const id = String(doc._id);
    const label = `${doc.name ?? ""} (${id})`;

    const cover = legacyDefaultCover(id);
    if (
      cover &&
      !doc.defaultCover &&
      (await fillIfEmpty(id, "defaultCover", cover))
    ) {
      covers++;
      console.log(`SigDefaults : ${label} defaultCover set to ${cover}`);
    }

    const color = legacyColor(id, doc.name);
    if (color && !doc.color && (await fillIfEmpty(id, "color", color))) {
      colors++;
      console.log(`SigDefaults : ${label} color set to ${color}`);
    }
  }

  console.log(
    `SigDefaults : backfill done (${sigs.length} SIGs checked, defaultCover set on ${covers}, color set on ${colors})`,
  );
  return { checked: sigs.length, covers, colors };
}

async function fillIfEmpty(
  id: string,
  field: "defaultCover" | "color",
  value: string,
) {
  const result = await sig.updateOne(
    { _id: id, [field]: { $in: [null, ""] } },
    { $set: { [field]: value } },
  );
  return result.modifiedCount > 0;
}
