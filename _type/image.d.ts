export type Image = {
  _id?: string;
  image: Buffer;
  sha256?: string; // hex digest of the stored bytes, used to dedupe uploads
  mimeType?: string; // e.g. image/jpeg
};

export type ImageWrite = {
  [K in keyof Omit<Image, "_id">]: Image[K];
};

export type ImageSearch = {
  id?: string | null;
};
