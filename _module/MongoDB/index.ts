import { User } from "@type/user";
import { ImageData } from "@type/image";
import { Post } from "@type/post";
import { DatabaseType, Search } from "@type/database";
import user from "@DBfunc/user";
import image from "@DBfunc/image";
import post from "@DBfunc/post";


export default class MongoDB {
    databaseType: DatabaseType;
    constructor(databaseType: DatabaseType) {
        this.databaseType = databaseType;
    }

    async read(search: Search) {
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

            default:
                throw new Error("Invalid database type");
        }
    }

    async write(dataToWrite: any, search?: Search) {
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

            default:
                throw new Error("Invalid database type");
        }
    }

    async list(search: any) {
        if (!search) throw new Error("Search is required");
        switch (this.databaseType) {
            case "post":
                return await post.list(search);
        }
    }
}