export type Comment = {
    _id?: string, // 評論ID，用於唯一標識每條評論
    user?: string, // 用戶ID，表示發表評論的用戶
    post: string, // 帖子ID，表示該評論所屬的帖子
    content: string, // 評論內容，包含用戶對帖子的觀點或評論
    like?: string[], // 點讚用戶列表，記錄所有點讚該評論的用戶
    reply: string, // 回復內容，表示對該評論的回復
    removed?: boolean, // 是否被刪除，標識該評論是否被刪除
    createAt?: string, // 創建時間，記錄評論的創建時間
    updateAt?: string, // 更新時間，記錄評論的最後更新時間
    __v?: number // 版本，用於記錄評論的版本號
}