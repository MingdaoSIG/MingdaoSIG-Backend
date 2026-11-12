import schema from "./schema";
import { countByNameInFirstSeenOrder, readSigNames } from "./sig_counts";

export default async function posts_of_each_sigs(
  from: Date | undefined,
  to: Date,
) {
  const TITLE = "Posts of each sigs";

  // Counts posts per sig in MongoDB, without loading post content. `first`
  // is the position of the sig's first post in natural (insertion) order,
  // which is the order the previous implementation walked the posts in, so
  // equal counts stay in the same order on the chart.
  const groups = await schema.post.aggregate<{
    _id: unknown;
    count: number;
    first: number;
  }>(
    [
      {
        $match: {
          removed: false,
          createdAt: {
            $gte: from ?? new Date(0),
            $lte: to,
          },
        },
      },
      { $group: { _id: null, sigs: { $push: "$sig" } } },
      { $unwind: { path: "$sigs", includeArrayIndex: "position" } },
      {
        $group: {
          _id: "$sigs",
          count: { $sum: 1 },
          first: { $min: "$position" },
        },
      },
    ],
    // A natural-order scan keeps $push in insertion order.
    { hint: { $natural: 1 } },
  );

  // Removed sigs are left out of the chart
  const sigNames = await readSigNames();

  return {
    func: posts_of_each_sigs.name,
    title: TITLE,
    content: countByNameInFirstSeenOrder(groups, sigNames),
  };
}
