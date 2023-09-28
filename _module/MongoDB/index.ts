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
                return await user.read(search.email!);

            case "image":
                return await image.read(search.id!);

            default:
                throw new Error("Invalid database type");
        }
    }

    async write(dataToWrite: any, search?: Search): Promise<Profile | ImageData | any> {
        switch (this.databaseType) {
            case "profile":
                if (!search) throw new Error("Search is required");
                return await user.write(search.email!, dataToWrite);

            case "image":
                return await image.write(dataToWrite);

            default:
                throw new Error("Invalid database type");
        }
    }

    async delete() { }
}