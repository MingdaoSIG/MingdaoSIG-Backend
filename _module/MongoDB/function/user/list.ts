import { User, UserFilter } from "@type/user";
import user from "@schema/user";
import CustomError from "@module/CustomError";
import { CustomStatus } from "@module/CustomStatusCode";


export default async function list(search: UserFilter) {
  try {
    const data = await user.find(search);

    if (!data) {
      throw new Error("User not found");
    }

    return data as unknown as User[];
  }
  catch (error: any) {
    throw new CustomError(CustomStatus.ERROR_READING_USER_FROM_DB, error);
  }
}
