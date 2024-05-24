import schema from "./schema";


export default async function top_posted_users(
  from: Date | undefined,
  to: Date,
  limit: number
) {
  const TITLE = `Top ${limit} post users`;

  const topUsersPost = await schema.post
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
    .group({ _id: "$user", count: { $sum: 1 } })
    .sort({ count: -1 })
    .limit(limit);

  const usersArray: Array<{ name: string; count: number }> = [];
  for (const userPost of topUsersPost) {
    const user = await schema.user.findOne({ _id: userPost._id });
    if (user?.name) {
      usersArray.push({ name: user.name, count: userPost.count });
    }
  }

  return {
    func: top_posted_users.name,
    title: TITLE,
    content: usersArray
  };
}
