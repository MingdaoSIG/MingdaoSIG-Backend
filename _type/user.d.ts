export type Identity = "teacher" | "student";
export type Permission = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export interface UserData {
    email: string, // 帳號
    name: string, // 姓名
    code: string, // 學號
    class: string, // 班級
    identity: Identity, // 老師或學生
    displayName?: string, // 顯示名稱
    description?: string, // 描述
    avatar?: string, // 大頭貼
    permission?: Permission, // 權限
}
