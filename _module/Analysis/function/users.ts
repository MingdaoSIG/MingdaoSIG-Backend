import schema from "./schema";


export default async function users(from: Date | undefined, to: Date) {
  const TITLE = "Users that have sign up";

  const _users = await schema.user.find({
    createdAt: {
      $gte: from ?? 0,
      $lte: to
    }
  });

  const usersArray: Array<string> = [];
  for (const user of _users) {
    const id = user.customId;

    if (!usersArray.includes(id!)) {
      usersArray.push(id!);
    }
  }

  return {
    func: users.name,
    title: TITLE,
    content: usersArray.length
  };
}
