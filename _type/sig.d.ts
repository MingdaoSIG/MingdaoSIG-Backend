export type Sig = {
    _id: string; // ID
    name: string; // sig 名稱
    description?: string; // 描述
    avatar?: string; // 大頭貼
    follower?: string[]; // 追隨者
    customId?: string; // 自定義ID
    moderator?: string[]; // 管理者
    leader?: string[]; // 領導者
    removed?: boolean; // 刪除
};

export type SigWrite = {
    [K in keyof Omit<Sig, "_id" | "createAt" | "updateAt" | "__v">]?: Sig[K];
};

export type SigSearch = {
    id?: string | null;
    customId?: string | null;
};

export type SigFilter = {
    [key in keyof Sig]?: any;
};
