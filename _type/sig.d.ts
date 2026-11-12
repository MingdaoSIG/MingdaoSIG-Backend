export type JoinQuestion = {
  label: string; // 題目 (1–60)
  required: boolean; // 必填
};

export type Recruiting = {
  open?: boolean; // 招生中（未設定視為 true）
  message?: string; // 招生說明 (≤200)
  until?: Date | string | null; // 截止時間（null 為不限）
};

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
  featuredPosts?: string[]; // 精選成果（貼文 id，依序）
  discordWebhook?: string; // Discord 公告 webhook（私密，不回傳）
  defaultCover?: string; // 預設封面（圖片 id）
  color?: string; // 主題色 #rrggbb
  previousCustomIds?: string[]; // 舊的自定義ID（會轉址）
  joinQuestions?: JoinQuestion[]; // 入社申請題目（未設定用預設三題）
  recruiting?: Recruiting; // 招生設定
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
