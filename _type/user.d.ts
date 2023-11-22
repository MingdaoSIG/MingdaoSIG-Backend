import { ObjectId } from "mongoose";


export type Identity = "teacher" | "student" | "alumni";

export type Permission = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type User = {
    _id?: string | ObjectId; // ID
    customId?: string; // 自定義ID
    email: string; // 帳號
    name: string; // 姓名
    code: string; // 學號
    class: string; // 班級
    identity: Identity; // 老師或學生
    sig?: string[]; // SIG
    displayName?: string; // 顯示名稱
    description?: string; // 描述
    avatar?: string; // 大頭貼
    badge?: ("developer" | "10.21_user")[]; // 徽章
    follower?: string[]; // 追隨者
    permission?: Permission; // 權限
    createAt?: string; // 建立時間
    updateAt?: string; // 更新時間
    __v?: number; // 版本
}

export type UserWrite = {
    [K in keyof Omit<User,
        | "_id"
        | "createAt"
        | "updateAt"
        | "__v"
    >]?: User[K];
}

export type UserSearch = {
    id?: string | ObjectId | null;
    customId?: string | null;
    email?: string | null;
}

export type UserFilter = {
    [key in keyof User]?: any;
}