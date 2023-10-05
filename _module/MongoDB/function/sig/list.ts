import CustomError from "@type/customError";
import { CustomStatus } from "@module/CustomStatusCode";
import sig from "@schema/sig";


export default async function list(search: object) {
    try {
        const data = await sig.find(search);

        if (!data) {
            throw new Error("Sig not found");
        }

        return data;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_READING_SIG_FROM_DB, error);
    }
}