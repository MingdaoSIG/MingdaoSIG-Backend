import schema from "./schema";


export default async function likes(from: Date | undefined, to: Date) {
  const TITLE = "Likes on the platform";

  const posts = await schema.post.find({
    removed: false,
    createdAt: {
      $gte: from ?? 0,
      $lte: to
    }
  });

  let likesCount: number = 0;
  for (const post of posts) {
    likesCount += post.likes;
  }

  return {
    func: likes.name,
    title: TITLE,
    content: likesCount
  };
}
