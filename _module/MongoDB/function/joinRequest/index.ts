import write, { confirmPending, markRemoved } from "./write";
import {
  readById,
  readByUserIdAndSigId,
  readLatestByUserIdAndSigId,
  readByConfirmId,
} from "./read";

export default {
  write,
  confirmPending,
  markRemoved,
  readById,
  readByUserIdAndSigId,
  readLatestByUserIdAndSigId,
  readByConfirmId,
};
