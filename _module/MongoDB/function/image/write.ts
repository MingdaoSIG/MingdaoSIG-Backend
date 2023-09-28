import CustomError from "@type/customError";
import { ImageData } from "@type/image";
import { CustomStatus } from "@module/CustomStatusCode";
import image from "@schema/image";


export default async function write(dataToSave: ImageData) {
    try {
        const saved = await image.create(dataToSave);
        const savedID = saved._id;

        const newData: ImageData = (await image.findOne({ _id: savedID }))!;
        return newData;
    }
    catch (error: any) {
        throw new CustomError(CustomStatus.ERROR_WRITING_IMAGE_TO_DB, error);
    }
}
