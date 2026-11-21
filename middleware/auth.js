import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

// public keys served by the Next.js app
const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

// checks the token and puts the user info on req.user
export const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).send({ message: "Unauthorized: token missing." });

    try {
        const { payload } = await jwtVerify(token, JWKS);
        if (!payload.email) throw new Error("No email in token");
        req.user = payload;
        next();
    } catch (err) {
        console.error("Token validation failed:", err.message);
        res.status(401).send({ message: "Unauthorized: invalid token." });
    }
};
