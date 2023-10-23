export type DatabaseType = "user" | "post" | "comment" | "image" | "sig";
export type Sort = string | { [key: string]: SortOrder | { $meta: any; }; } | [string, SortOrder][] | null | undefined;

export type Search = {
    email?: string | null,
    id?: string | null,
    customId?: string | null,
}

export type Option = {
    skip?: number,
    limit?: number,
    sort?: Sort
}