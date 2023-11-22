import { SigFilter } from "@type/sig";
import sig from "@schema/sig";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function list(search: SigFilter) {
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