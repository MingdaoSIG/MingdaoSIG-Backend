export type DatabaseType = "user" | "post" | "comment" | "image";

export type Search = {
    email?: string | null,
    id?: string | null,
    customId?: string | null,
}