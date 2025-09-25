export type Post = {
    _id?: string; // ID
    sig: string; // SIG
    title: string; // 標題
    cover: string; // 封面圖
    content: string; // 內容
    user: string; // 發布者
    hashtag: string[]; // 標籤
    like?: string[]; // 按讚者
    likes?: number; // 按讚數
    priority?: number; // 重要性
    pinned?: boolean; // 推薦
    removed?: boolean; // 刪除
    createdAt?: string; // 建立時間
    updatedAt?: string; // 更新時間
    __v?: number; // 版本
};

export type PostWrite = {
    [K in keyof Omit<Post, "_id" | "createdAt" | "updatedAt" | "__v">]?: Post[K];
};

export type PostSearch = {
    id?: string | null;
};

export type PostFilter = {
    [key in keyof Post]?: any;
};
