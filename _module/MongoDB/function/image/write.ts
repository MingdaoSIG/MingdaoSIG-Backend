import { Image } from "@type/image";
import image from "@schema/image";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(dataToSave: Image) {
    try {
        const data = await image.findOne({ image: dataToSave.image });
        const code = data ? 1 : 0;

        if (code) {
            return data as unknown as Image;
        }
        else {
            return await image.create(dataToSave) as unknown as Image;
        }
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_WRITING_IMAGE_TO_DB, error);
    }
}
