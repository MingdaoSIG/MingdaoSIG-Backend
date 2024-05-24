import schema from "./schema";


export default async function posted_user(from: Date | undefined, to: Date) {
  const TITLE = "Users that have posted";

  const uniqueUsers = await schema.post.distinct("user", {
    removed: false,
    createdAt: {
      $gte: from ?? 0,
      $lte: to
    }
  });

  return {
    func: posted_user.name,
    title: TITLE,
    content: uniqueUsers.length
  };
}
