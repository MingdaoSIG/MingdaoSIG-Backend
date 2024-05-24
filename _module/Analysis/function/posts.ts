import schema from "./schema";


export default async function post(from: Date | undefined, to: Date) {
  const TITLE = "Posts on the platform";

  const postsCount = await schema.post.countDocuments({
    removed: false,
    createdAt: {
      $gte: from ?? 0,
      $lte: to
    }
  });

  return {
    func: post.name,
    title: TITLE,
    content: postsCount
  };
}
