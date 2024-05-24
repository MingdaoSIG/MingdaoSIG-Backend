import schema from "./schema";


export default async function top_liked_post(
  from: Date | undefined,
  to: Date,
  limit: number
) {
  const TITLE = `Top ${limit} liked posts`;

  const topLikedPost = await schema.post
    .find({
      removed: false,
      createdAt: {
        $gte: from ?? 0,
        $lte: to
      }
    })
    .sort({ likes: -1 })
    .limit(limit);

  const postArray: Array<{ name: string; likes: number }> = [];
  for (const post of topLikedPost) {
    if (post?.title) {
      postArray.push({ name: post.title, likes: post.likes });
    }
  }

  return {
    func: top_liked_post.name,
    title: TITLE,
    content: postArray
  };
}
