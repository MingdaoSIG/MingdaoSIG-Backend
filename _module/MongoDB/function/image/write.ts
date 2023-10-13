import CustomError from "@type/customError";
import { ImageData } from "@type/image";
import image from "@schema/image";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(dataToSave: ImageData) {
    try {
        const data = await image.findOne({ image: dataToSave.image });
        const code = data ? 1 : 0;

        if (code) {
            return data!;
        }
        else {
            return (await image.create(dataToSave))!;
        }
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_WRITING_IMAGE_TO_DB, error);
    }
}
