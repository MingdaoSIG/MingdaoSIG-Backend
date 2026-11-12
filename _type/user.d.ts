// Only the keys a user changed (@module/NotificationSettings has the list).
type StoredNotificationSettings = {
  push?: Record<string, boolean | undefined>;
  email?: Record<string, boolean | undefined>;
};

type StoredSuspension = {
  type: "mute" | "ban";
  until: Date | null;
  reason: string;
  by: string;
  createdAt: Date;
};

export type Identity = "teacher" | "student" | "alumni";

export type Permission = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type User = {
  _id: string; // ID
  customId?: string; // 自定義ID
  previousCustomIds?: string[]; // 舊的自定義ID（會轉址）
  email: string; // 帳號
  name: string; // 姓名
  code: string; // 學號
  class: string; // 班級
  identity: Identity; // 老師或學生
  sig?: string[]; // SIG
  displayName?: string; // 顯示名稱
  description?: string; // 描述
  avatar?: string; // 大頭貼
  badge?: string[]; // 徽章（badge collection 的 key）
  follower?: string[]; // 追隨者
  permission?: Permission; // 權限
  notifyComments?: boolean; // 有人留言時寄信通知（未設定視為 true）
  notificationSettings?: StoredNotificationSettings; // 通知設定（未設定的項目用預設值）
  digestLastSentWeek?: string; // 上次寄出每週摘要的 ISO 週，例如 2026-W46
  onboardedAt?: Date | string | null; // 完成（或略過）新手導覽的時間
  suspension?: StoredSuspension; // 停權／禁言（未設定表示沒有）
  sigOrder?: string[]; // 側欄「我的 SIG」的排序（SIG id）
  createAt?: string; // 建立時間
  updateAt?: string; // 更新時間
  __v?: number; // 版本
};

export type UserWrite = {
  [K in keyof Omit<User, "_id" | "createAt" | "updateAt" | "__v">]?: User[K];
};

export type UserSearch = {
  id?: string | null;
  customId?: string | null;
  email?: string | null;
  code?: string | null;
};

export type UserFilter = {
  [key in keyof User]?: any;
};
