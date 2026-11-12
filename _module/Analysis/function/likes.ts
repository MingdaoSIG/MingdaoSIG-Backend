import schema from "./schema";


export default async function likes(from: Date | undefined, to: Date) {
  const TITLE = "Likes on the platform";

  // Sums in MongoDB; never loads post documents.
  const [result] = await schema.post.aggregate<{ total: number }>([
    {
      $match: {
        removed: false,
        createdAt: {
          $gte: from ?? new Date(0),
          $lte: to
        }
      }
    },
    { $group: { _id: null, total: { $sum: "$likes" } } }
  ]);

  const likesCount: number = result?.total ?? 0;

  return {
    func: likes.name,
    title: TITLE,
    content: likesCount
  };
}
