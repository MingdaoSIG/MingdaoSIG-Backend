import { readByCustomId, readByEmail, readById, readByCode } from "./read";
import { writeByEmail, writeById } from "./write";
import list from "./list";


export default {
  readByEmail,
  readById,
  readByCustomId,
  readByCode,
  writeById,
  writeByEmail,
  list
};
