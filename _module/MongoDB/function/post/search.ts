import post from "@schema/post";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";

const TITLE = 0;
const HASHTAG = 1;
const CONTENT = 2;

/**
 * Non-removed posts whose title, any hashtag or content matches `pattern`
 * (a regular expression source, matched case-insensitively). Title matches
 * come first, then hashtag matches, then content matches; newest first
 * within each group. Returns the ids of one page and the total.
 *
 * A text index is no use here because it does not segment Chinese, so this
 * scans the non-removed posts; only `_id`, `createdAt` and the group are
 * kept after the match, so the sort never carries post bodies.
 */
export default async function search(
  pattern: string,
  option: { skip: number; limit: number },
) {
  try {
    const regex = { $regex: pattern, $options: "i" };
    const matches = (input: unknown) => ({
      $regexMatch: { input, regex: pattern, options: "i" },
    });
    const asString = (value: string) => ({
      $cond: [{ $eq: [{ $type: value }, "string"] }, value, ""],
    });

    const [result] = await post.aggregate([
      {
        $match: {
          removed: false,
          $or: [{ title: regex }, { hashtag: regex }, { content: regex }],
        },
      },
      {
        $project: {
          createdAt: 1,
          group: {
            $cond: [
              matches(asString("$title")),
              TITLE,
              {
                $cond: [
                  {
                    $anyElementTrue: [
                      {
                        $map: {
                          input: {
                            $cond: [{ $isArray: "$hashtag" }, "$hashtag", []],
                          },
                          as: "tag",
                          in: matches(asString("$$tag")),
                        },
                      },
                    ],
                  },
                  HASHTAG,
                  CONTENT,
                ],
              },
            ],
          },
        },
      },
      {
        $facet: {
          page: [
            { $sort: { group: 1, createdAt: -1, _id: -1 } },
            { $skip: option.skip },
            { $limit: option.limit },
            { $project: { _id: 1 } },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]);

    return {
      ids: (result?.page ?? []).map((item: { _id: unknown }) =>
        String(item._id),
      ) as string[],
      total: (result?.total?.[0]?.count ?? 0) as number,
    };
  } catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_POST_FROM_DB, error);
  }
}
