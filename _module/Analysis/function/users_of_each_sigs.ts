import schema from "./schema";


export default async function sig_users(from: Date | undefined, to: Date) {
  const TITLE = "Users of each sigs";

  const users = await schema.user.find({
    createdAt: {
      $gte: from ?? 0,
      $lte: to
    }
  });

  const sigList = await schema.sig.find({});

  const sigMembers: Array<{ name: string; count: number }> = [];
  const usersArray: Array<string> = [];
  for (const user of users) {
    const id = user.customId;

    if (!usersArray.includes(id!)) {
      user.sig.forEach(sigId => {
        const sigName = sigList.find(
          sig => sig._id?.toString() === sigId
        )!.name!;

        const sigIndex = sigMembers.findIndex(
          sig => sig.name === sigName
        );
        if (sigIndex === -1) {
          sigMembers.push({ name: sigName, count: 1 });
        }
        else {
          sigMembers[sigIndex].count += 1;
        }
      });
      usersArray.push(id!);
    }
  }

  const sortedSigsUsers = Object.values(sigMembers).sort(
    (a, b) => b.count! - a.count!
  );

  return {
    func: sig_users.name,
    title: TITLE,
    content: sortedSigsUsers
  };
}
