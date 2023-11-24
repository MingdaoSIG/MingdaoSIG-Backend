export type Sort = string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined;

export type Option = {
    skip?: number,
    limit?: number,
    sort?: Sort
}