export const CustomCode = {
  2000: "OK",

  4000: "Not found",
  4001: "Forbidden",

  4010: "Invalid user",
  4011: "Invalid body",
  4012: "Invalid query",
  4013: "Invalid JWT",
  4015: "Invalid google access token",
  4016: "Invalid image id",
  4017: "Invalid user id",
  4018: "Invalid post id",
  4019: "Invalid sig id",
  4020: "Invalid reply id",
  4021: "Invalid custom id",
  4022: "Custom id already exists",
  4023: "Invalid content length",
  4024: "Empty content",
  4025: "Invalid hashtag",
  4026: "Content size exceeded",
  4027: "Failed to send email",
  4028: "Already joined",
  4029: "Already applied",
  4030: "Not a member",
  4031: "Already confirmed",

  4100: "Error reading user from db",
  4101: "Error writing user to db",
  4102: "Error reading image from db",
  4103: "Error writing image to db",
  4104: "Error reading post from db",
  4105: "Error writing post to db",
  4106: "Error reading sig from db",
  4107: "Error writing sig to db",
  4108: "Error reading comment from db",
  4109: "Error writing comment to db",
  4110: "Error reading join request from db",
  4111: "Error writing join request to db",

  5000: "Unknown error"
} as const;

export const CustomStatus = {
  OK: 2000,

  NOT_FOUND: 4000,
  FORBIDDEN: 4001,

  INVALID_USER: 4010,
  INVALID_BODY: 4011,
  INVALID_QUERY: 4012,
  INVALID_JWT: 4013,
  INVALID_GOOGLE_ACCESS_TOKEN: 4015,
  INVALID_IMAGE_ID: 4016,
  INVALID_USER_ID: 4017,
  INVALID_POST_ID: 4018,
  INVALID_SIG_ID: 4019,
  INVALID_REPLY_ID: 4020,
  INVALID_CUSTOM_ID: 4021,
  CUSTOM_ID_ALREADY_EXISTS: 4022,
  INVALID_CONTENT_LENGTH: 4023,
  EMPTY_CONTENT: 4024,
  INVALID_HASHTAG: 4025,
  CONTENT_SIZE_EXCEEDED: 4026,
  FAILED_TO_SEND_EMAIL: 4027,
  ALREADY_JOINED: 4028,
  ALREADY_APPLIED: 4029,
  NOT_A_MEMBER: 4030,
  ALREADY_CONFIRMED: 4031,
  ALREADY_LEADER: 4032,
  ALREADY_MODERATOR: 4033,
  NOT_LEADER: 4034,
  NOT_MODERATOR: 4035,
  INVALID_SESSION: 4036,

  ERROR_READING_USER_FROM_DB: 4100,
  ERROR_WRITING_USER_TO_DB: 4101,
  ERROR_READING_IMAGE_FROM_DB: 4102,
  ERROR_WRITING_IMAGE_TO_DB: 4103,
  ERROR_READING_POST_FROM_DB: 4104,
  ERROR_WRITING_POST_TO_DB: 4105,
  ERROR_READING_SIG_FROM_DB: 4106,
  ERROR_WRITING_SIG_TO_DB: 4107,
  ERROR_READING_COMMENT_FROM_DB: 4108,
  ERROR_WRITING_COMMENT_TO_DB: 4109,
  ERROR_READING_JOIN_REQUEST_FROM_DB: 4110,
  ERROR_WRITING_JOIN_REQUEST_TO_DB: 4111,

  UNKNOWN_ERROR: 5000
} as const;
