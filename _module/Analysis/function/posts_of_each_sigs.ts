import schema from "./schema";


export default async function posts_of_each_sigs(
  from: Date | undefined,
  to: Date
) {
  const TITLE = "Posts of each sigs";

  const _sigs = await schema.sig.find();

  const sigs: {
        [key: string]: {
            name?: string;
            count?: number;
        };
    } = {};
  for (const sigObj of _sigs) {
    const sigId = sigObj._id.toString();
    const sigName = sigObj.name!;
    const postCount = await schema.post.countDocuments({
      sig: sigId,
      removed: false,
      createdAt: {
        $gte: from ?? 0,
        $lte: to
      }
    });

    sigs[sigId] = {
      name: sigName,
      count: postCount
    };
  }

  const sortedSigsPosts = Object.values(sigs).sort(
    (a, b) => b.count! - a.count!
  );

  return {
    func: posts_of_each_sigs.name,
    title: TITLE,
    content: sortedSigsPosts
  };
}
