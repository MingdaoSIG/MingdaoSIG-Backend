export const CustomCode = {
} as const;

export const CustomStatus = {
    OK: 2000,
    NOT_FOUND: 4000,
    INVALID_USER: 4001,
    INVALID_BODY: 4002,
    INVALID_QUERY: 4003,
    INVALID_JWT: 4004,
    ERROR_READING_USER_FROM_DB: 4005,
    ERROR_WRITING_USER_FROM_DB: 4006,
    UNKNOWN_ERROR: 5000
} as const;