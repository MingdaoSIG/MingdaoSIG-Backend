import read from "./read";
import write from "./write";
import list from "./list";
import countByPost from "./countByPost";
import { editContent, markRemoved } from "./update";
import { listReplies, listTopLevel } from "./thread";

export default {
  read,
  write,
  list,
  countByPost,
  listTopLevel,
  listReplies,
  editContent,
  markRemoved,
};
