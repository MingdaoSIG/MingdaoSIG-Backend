import { Image, ImageWrite } from "@type/image";
import image from "@schema/image";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function write(dataToSave: ImageWrite) {
  try {
    if (dataToSave.sha256) {
      const data = await image.findOne(
        { sha256: dataToSave.sha256 },
        { _id: 1 }
      );
      if (data) return data as unknown as Image;
    }

    return (await image.create(dataToSave)) as unknown as Image;
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_WRITING_IMAGE_TO_DB, error);
  }
}
