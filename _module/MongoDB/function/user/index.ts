import {
  readByCustomId,
  readByEmail,
  readById,
  readByCode,
  readOldestByEmail,
} from "./read";
import { writeByEmail, writeById, upsertByEmail } from "./write";
import list from "./list";

export default {
  readByEmail,
  readById,
  readByCustomId,
  readByCode,
  readOldestByEmail,
  writeById,
  writeByEmail,
  upsertByEmail,
  list,
};
