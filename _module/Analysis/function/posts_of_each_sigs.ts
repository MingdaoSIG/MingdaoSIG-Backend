import schema from "./schema";


export default async function posts_of_each_sigs(
  from: Date | undefined,
  to: Date
) {
  const TITLE = "Posts of each sigs";

  const posts = await schema.post.find({
    removed: false,
    createdAt: {
      $gte: from ?? 0,
      $lte: to
    }
  });

  const sigList = await schema.sig.find({});

  const sigPosts: Array<{ name: string; count: number }> = [];
  for (const post of posts) {
    const sigId = post.sig;
    const sigName = sigList.find(sig => sig._id?.toString() === sigId)!
      .name!;
    const sigIndex = sigPosts.findIndex(sig => sig.name === sigName);
    if (sigIndex === -1) {
      sigPosts.push({ name: sigName, count: 1 });
    }
    else {
      sigPosts[sigIndex].count += 1;
    }
  }

  const sortedSigsPosts = Object.values(sigPosts).sort(
    (a, b) => b.count! - a.count!
  );

  return {
    func: posts_of_each_sigs.name,
    title: TITLE,
    content: sortedSigsPosts
  };
}
