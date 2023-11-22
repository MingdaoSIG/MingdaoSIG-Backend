import { UserFilter, UserSearch, UserWrite } from "@type/user";
import { DatabaseType, Option, Search } from "@type/database";
import user from "@DBfunc/user";
import image from "@DBfunc/image";
import post from "@DBfunc/post";
import sig from "@DBfunc/sig";
import comment from "@DBfunc/comment";
import { ImageSearch, ImageWrite } from "@type/image";
import { PostFilter, PostSearch, PostWrite } from "@type/post";
import { SigFilter, SigSearch, SigWrite } from "@type/sig";
import { CommentFilter, CommentSearch, CommentWrite } from "@type/comment";


export class UserDB {
    async read(search: UserSearch) {
        const { email, id, customId } = search;

        if (id) {
            return await user.readById(id);
        }
        else if (customId) {
            return await user.readByCustomId(customId);
        }
        else if (email) {
            return await user.readByEmail(email);
        }
        else {
            throw new Error("Search is required");
        }
    }

    async write(dataToWrite: UserWrite, search?: Omit<UserSearch, "customId">) {
        const { id, email } = search || {};

        if (id) {
            return await user.writeById(id, dataToWrite);
        }
        else if (email) {
            return await user.writeByEmail(email, dataToWrite);
        }
        else {
            throw new Error("Search is required");
        }
    }

    async list(filter: UserFilter) {
        if (filter) {
            return await user.list(filter);
        }
        else {
            throw new Error("Search is required");
        }
    }
}

export class ImageDB {
    async read(search: ImageSearch) {
        const { id } = search;

        if (id) {
            return await image.read(id);
        }
        else {
            throw new Error("Search is required");
        }
    }

    async write(dataToWrite: ImageWrite) {
        if (dataToWrite) {
            return await image.write(dataToWrite);
        }
        else {
            throw new Error("Data to write is required");
        }
    }
}

export class PostDB {
    async read(search: PostSearch) {
        const { id } = search;

        if (id) {
            return await post.read(id);
        }
        else {
            throw new Error("Search is required");
        }
    }

    async write(dataToWrite: PostWrite, search?: PostSearch) {
        const { id } = search || {};

        if (id) {
            return await post.write(id, dataToWrite);
        }
        else if (!id) {
            return await post.write(null, dataToWrite);
        }
        else {
            throw new Error("Search is required");
        }
    }

    async list(filter: PostFilter, option?: Option) {
        if (filter) {
            return await post.list(filter, option);
        }
        else {
            throw new Error("Search is required");
        }
    }
}

export class SigDB {
    async read(search: SigSearch) {
        const { id, customId } = search;

        if (id) {
            return await sig.readById(id);
        }
        else if (customId) {
            return await sig.readByCustomId(customId);
        }
        else {
            throw new Error("Search is required");
        }
    }

    async write(dataToWrite: SigWrite, search?: Omit<SigSearch, "customId">) {
        const { id } = search || {};

        if (id) {
            return await sig.write(id, dataToWrite);
        }
        else {
            throw new Error("Search is required");
        }
    }

    async list(filter: SigFilter) {
        if (filter) {
            return await sig.list(filter);
        }
        else {
            throw new Error("Search is required");
        }
    }
}

export class CommentDB {
    async read(search: CommentSearch) {
        const { id } = search;

        if (id) {
            return await comment.read(id);
        }
        else {
            throw new Error("Search is required");
        }
    }

    async write(dataToWrite: CommentWrite, search?: CommentSearch) {
        const { id } = search || {};

        if (id) {
            return await comment.write(id, dataToWrite);
        }
        else if (!id) {
            return await comment.write(null, dataToWrite);
        }
        else {
            throw new Error("Search is required");
        }
    }

    async list(filter: CommentFilter, option?: Option) {
        if (filter) {
            return await comment.list(filter, option);
        }
        else {
            throw new Error("Search is required");
        }
    }
}

const MongoDB = {
    User: UserDB,
    Image: ImageDB,
    Post: PostDB,
    Sig: SigDB,
    Comment: CommentDB
};
export default MongoDB;

export class _MongoDB {
    databaseType: DatabaseType;
    constructor(databaseType: DatabaseType) {
        this.databaseType = databaseType;
    }

    async read(search: Search): Promise<any> {
        switch (this.databaseType) {
            case "user":
                if (search.email) {
                    return await user.readByEmail(search.email!);
                }
                else if (search.id) {
                    return await user.readById(search.id!);
                }
                else if (search.customId) {
                    return await user.readByCustomId(search.customId!);
                }
                else {
                    throw new Error("Search is required");
                }

            case "image":
                return await image.read(search.id!);

            case "post":
                if (search.id) {
                    return await post.read(search.id!);
                }
                else {
                    throw new Error("Search is required");
                }

            case "sig":
                if (search.id) {
                    return await sig.readById(search.id!);
                }
                else if (search.customId) {
                    return await sig.readByCustomId(search.customId!);
                }
                else {
                    throw new Error("Search is required");
                }

            case "comment":
                if (search.id) {
                    return await comment.read(search.id!);
                }
                else {
                    throw new Error("Search is required");
                }

            default:
                throw new Error("Invalid database type");
        }
    }

    async write(dataToWrite: any, search?: Search): Promise<any> {
        switch (this.databaseType) {
            case "user":
                if (search?.email) {
                    return await user.writeByEmail(search.email!, dataToWrite);
                }
                else if (search?.id) {
                    return await user.writeById(search.id!, dataToWrite);
                }
                else {
                    throw new Error("Search is required");
                }

            case "image":
                return await image.write(dataToWrite);

            case "post":
                if (search?.id) {
                    return await post.write(search.id!, dataToWrite);
                }
                else if (!search?.id) {
                    return await post.write(null, dataToWrite);
                }
                else {
                    throw new Error("Search is required");
                }

            case "sig":
                if (search?.id) {
                    return await sig.write(search.id!, dataToWrite);
                }
                else {
                    throw new Error("Search is required");
                }

            case "comment":
                if (search?.id) {
                    return await comment.write(search.id!, dataToWrite);
                }
                else if (!search?.id) {
                    return await comment.write(null, dataToWrite);
                }
                else {
                    throw new Error("Search is required");
                }

            default:
                throw new Error("Invalid database type");
        }
    }

    async list(search: object, option?: Option): Promise<any> {
        if (!search) throw new Error("Search is required");
        switch (this.databaseType) {
            case "user":
                return await user.list(search);

            case "post":
                return await post.list(search, option);

            case "sig":
                return await sig.list(search);

            case "comment":
                return await comment.list(search, option);

            default:
                throw new Error("Invalid database type");
        }
    }
}