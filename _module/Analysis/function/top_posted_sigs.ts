import schema from "./schema";


export default async function top_posted_sigs(
  from: Date | undefined,
  to: Date,
  limit: number
) {
  const TITLE = `Top ${limit} post sigs`;

  const topSigsPost = await schema.post
    .aggregate([])
    .match({
      $and: [
        { removed: false },
        {
          createdAt: from
            ? {
              $gte: from,
              $lte: to
            }
            : {
              $lte: to
            }
        }
      ]
    })
    .group({ _id: "$sig", count: { $sum: 1 } })
    .sort({ count: -1 })
    .limit(limit);

  const sigsArray: Array<{ name: string; count: number }> = [];
  for (const sigPost of topSigsPost) {
    const sig = await schema.sig.findOne({ _id: sigPost._id });
    if (sig?.name) {
      sigsArray.push({ name: sig.name, count: sigPost.count });
    }
  }

  return {
    func: top_posted_sigs.name,
    title: TITLE,
    content: sigsArray
  };
}
