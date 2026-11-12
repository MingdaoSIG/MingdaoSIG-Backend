import jwt, { Secret } from "jsonwebtoken";


export const JWT_EXPIRES_IN = "30d";

export default function signJWT(payload: object) {
  const token = jwt.sign(
    JSON.parse(JSON.stringify(payload)),
    process.env.JWT_SECRET as Secret,
    { expiresIn: JWT_EXPIRES_IN }
  );
  return token;
}
