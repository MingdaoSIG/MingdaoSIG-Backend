export type JoinRequest = {
    _id: string;
    user: string;
    sig: string;
    [q1: string]: string;
    [q2: string]: string;
    [q3: string]: string;
    removed: boolean;
    state: "pending" | "accepted" | "rejected";
    createAt?: string;
    updateAt?: string;
    __v?: number;
}