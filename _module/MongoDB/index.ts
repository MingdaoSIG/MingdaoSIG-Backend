import { UserData } from "@type/user";
import { DatabaseType } from "@type/database";
import user from "@DBfunc/user";


export default class MongoDB {
    databaseType: DatabaseType;
    constructor(databaseType: DatabaseType) {
        this.databaseType = databaseType;
    }

    async read(email: string): Promise<UserData> {
        switch (this.databaseType) {
            case "user":
                return await user.read(email);

            default:
                throw new Error("Invalid databaseType");
        }
    }

    async write(email: string, dataToWrite: UserData) {
        switch (this.databaseType) {
            case "user":
                return await user.write(email, dataToWrite);

            default:
                throw new Error("Invalid databaseType");
        }
    }

    async delete() { }
}