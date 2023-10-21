import { DatabaseType, Search } from "@type/database";
import user from "@DBfunc/user";
import image from "@DBfunc/image";
import post from "@DBfunc/post";
import sig from "@DBfunc/sig";
import comment from "@DBfunc/comment";


export default class MongoDB {
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

    async list(search: object): Promise<any> {
        if (!search) throw new Error("Search is required");
        switch (this.databaseType) {
            case "user":
                return await user.list(search);

            case "post":
                return await post.list(search);

            case "sig":
                return await sig.list(search);

            case "comment":
                return await comment.list(search);

            default:
                throw new Error("Invalid database type");
        }
    }
}