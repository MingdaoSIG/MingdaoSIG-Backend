import schema from "./schema";
import { countByNameInFirstSeenOrder, readSigNames } from "./sig_counts";


export default async function sig_users(from: Date | undefined, to: Date) {
  const TITLE = "Users of each sigs";

  // Counts members per sig in MongoDB. Like the previous implementation, a
  // customId is counted once, using the first user document with it in
  // natural (insertion) order; `first` keeps equal counts in the order the
  // previous implementation produced.
  const groups = await schema.user.aggregate<{
    _id: unknown;
    count: number;
    first: { position: number; index: number };
  }>(
    [
      {
        $match: {
          createdAt: {
            $gte: from ?? new Date(0),
            $lte: to
          }
        }
      },
      {
        $group: {
          _id: null,
          users: {
            $push: {
              customId: "$customId",
              // Keeps a missing customId apart from a null one.
              type: { $type: "$customId" },
              sig: "$sig"
            }
          }
        }
      },
      { $unwind: { path: "$users", includeArrayIndex: "position" } },
      {
        $group: {
          _id: { customId: "$users.customId", type: "$users.type" },
          position: { $min: "$position" },
          sig: { $top: { sortBy: { position: 1 }, output: "$users.sig" } }
        }
      },
      { $unwind: { path: "$sig", includeArrayIndex: "index" } },
      {
        $group: {
          _id: "$sig",
          count: { $sum: 1 },
          first: { $min: { position: "$position", index: "$index" } }
        }
      }
    ],
    // A natural-order scan keeps $push in insertion order.
    { hint: { $natural: 1 } }
  );

  // Removed sigs are left out of the chart
  const sigNames = await readSigNames();

  return {
    func: sig_users.name,
    title: TITLE,
    content: countByNameInFirstSeenOrder(groups, sigNames)
  };
}
