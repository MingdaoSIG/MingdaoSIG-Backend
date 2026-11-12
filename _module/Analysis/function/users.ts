import schema from "./schema";

export default async function users(from: Date | undefined, to: Date) {
  const TITLE = "Users that have sign up";

  // Number of distinct customIds (a missing customId and a null one count as
  // two values, as before), counted in MongoDB.
  const [result] = await schema.user.aggregate<{ count: number }>([
    {
      $match: {
        createdAt: {
          $gte: from ?? new Date(0),
          $lte: to,
        },
      },
    },
    {
      $group: {
        _id: { customId: "$customId", type: { $type: "$customId" } },
      },
    },
    { $count: "count" },
  ]);

  return {
    func: users.name,
    title: TITLE,
    content: result?.count ?? 0,
  };
}
