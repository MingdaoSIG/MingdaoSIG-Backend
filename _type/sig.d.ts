export type Sig = {
    _id?: string, // ID
    name: string, // sig 名稱
    description?: string, // 描述
    avatar?: string, // 大頭貼
    follower?: string[], // 追隨者
    customId?: string, // 自定義ID
    moderator?: string[], // 管理者
    leader?: string[], // 領導者
}
