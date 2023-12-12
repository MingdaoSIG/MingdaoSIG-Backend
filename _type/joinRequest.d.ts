export type JoinRequest = {
    _id: string;
    user: string;
    sig: string;
    q1: string;
    q2: string;
    q3: string;
    state: "pending" | "accepted" | "rejected";
    confirmId?: string;
    removed: boolean;
    createAt?: string;
    updateAt?: string;
    __v?: number;
};

export type JoinRequestWrite = {
    user: string;
    sig: string;
    q1: string;
    q2: string;
    q3: string;
    state: "pending" | "accepted" | "rejected";
};

export type JoinRequestSearch = {
    id?: string;
    user?: string;
    sig?: string;
    confirmId?: string;
};
