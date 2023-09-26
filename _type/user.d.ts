export type Identity = "teacher" | "student";

/*
0:view
1:like, comment, request join
2:add new thread (SIG)
3:add new thread (ALL)
4:delete member
5:review member request
6:delete comment
7:manage member permission
8:manage thread

0:view
1:like, manage own comment
2:manage own thread thread (SIG)
3:manage own thread (ALL)
4:manage SIG member
5:manage others comment
6:manage others thread
7:manage all
*/
export type Permission = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type UserData = {
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
