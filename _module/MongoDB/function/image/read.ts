import image from "@schema/image";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function read(id: string) {
  try {
    const data = await image.findOne({ _id: id });

    if (!data) {
      throw new Error("Image not found");
    }

    const imageData: Buffer = data.image!;
    return imageData;
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_IMAGE_FROM_DB, error);
  }
}
