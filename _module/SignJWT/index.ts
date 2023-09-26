import jwt, { Secret } from "jsonwebtoken";


export default function signJWT(payload: object) {
    console.log(typeof payload);
    const token = jwt.sign(JSON.parse(JSON.stringify(payload)), process.env.JWT_SECRET as Secret);
    return token;
}