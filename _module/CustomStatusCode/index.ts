export const CustomCode = {
    2000: "OK",
    4000: "Not found",
    4001: "Forbidden",

    4010: "Invalid user",
    4011: "Invalid body",
    4012: "Invalid query",
    4013: "Invalid jwt",
    4015: "Invalid google access token",
    4016: "Invalid image id",
    4017: "Invalid user id",
    4018: "Invalid post id",
    4019: "Invalid sig id",

    4100: "Error reading user from db",
    4101: "Error writing user to db",
    4102: "Error reading image from db",
    4103: "Error writing image to db",
    4104: "Error reading post from db",
    4105: "Error writing post to db",
    4106: "Error reading sig from db",
    4107: "Error writing sig to db",
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
    INVALID_CUSTOM_ID: 4020,
    CUSTOM_ID_ALREADY_EXISTS: 4021,
    INVALID_DESCRIPTION_LENGTH: 4022,

    ERROR_READING_USER_FROM_DB: 4100,
    ERROR_WRITING_USER_TO_DB: 4101,
    ERROR_READING_IMAGE_FROM_DB: 4102,
    ERROR_WRITING_IMAGE_TO_DB: 4103,
    ERROR_READING_POST_FROM_DB: 4104,
    ERROR_WRITING_POST_TO_DB: 4105,
    ERROR_READING_SIG_FROM_DB: 4106,
    ERROR_WRITING_SIG_TO_DB: 4107,

    UNKNOWN_ERROR: 5000
} as const;