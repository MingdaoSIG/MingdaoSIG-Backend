export type Comment = {
    _id?: string, // ID
    post: string, // 文章ID
    content: string, // 內容
    user: string, // 發布者
    like?: string[], // 按讚者
    removed?: boolean, // 刪除
    createAt?: string, // 建立時間
    updateAt?: string, // 更新時間
    __v?: number // 版本
}