export type Image = {
    _id?: string;
    image: Buffer;
};

export type ImageWrite = {
    [K in keyof Omit<Image, "_id">]: Image[K];
};

export type ImageSearch = {
    id?: string | null;
};
