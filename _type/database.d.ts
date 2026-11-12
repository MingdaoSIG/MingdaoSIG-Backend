export type Sort =
  | string
  | { [key: string]: SortOrder | { $meta: any } }
  | [string, SortOrder][]
  | null
  | undefined;

export type Option = {
  skip?: number;
  limit?: number;
  sort?: Sort;
};

// Option plus a projection, for list functions that support one.
export type ListOption = Option & Pick<ReadOption, "projection">;

export type ReadOption = {
  // Return plain objects instead of Mongoose documents (faster, read only).
  lean?: boolean;
  // Only load these fields. Implies a partial result, so schema defaults are
  // not filled in.
  projection?: Record<string, 0 | 1>;
};
