export type Sig = {
    _id?: string, // ID
    customId?: string, // 自定義ID
    name: string, // sig 名稱
    description?: string, // 描述
    avatar?: string, // 大頭貼
    follower?: string[], // 追隨者
    moderator?: string[], // 管理者
    leader?: string[], // 領導者
}
