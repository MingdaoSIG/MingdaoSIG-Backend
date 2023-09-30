import { Profile } from "@type/profile";
import { ImageData } from "@type/image";
import { DatabaseType, Search } from "@type/database";
import user from "@DBfunc/user";
import image from "@DBfunc/image";


export default class MongoDB {
    databaseType: DatabaseType;
    constructor(databaseType: DatabaseType) {
        this.databaseType = databaseType;
    }

    async read(search: Search): Promise<Profile | any> {
        switch (this.databaseType) {
            case "profile":
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

            default:
                throw new Error("Invalid database type");
        }
    }

    async write(dataToWrite: any, search?: Search): Promise<Profile | ImageData | any> {
        switch (this.databaseType) {
            case "profile":
                if (search?.email) {
                    return await user.writeByEmail(search.email, dataToWrite);
                }
                else if (search?.id) {
                    return await user.writeById(search.id, dataToWrite);
                }
                else {
                    throw new Error("Search is required");
                }

            case "image":
                return await image.write(dataToWrite);

            default:
                throw new Error("Invalid database type");
        }
    }

    async delete() { }
}