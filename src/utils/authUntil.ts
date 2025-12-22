import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "../env";

// Generate JWT Access Token
export const generateToken = (userId: Types.ObjectId): string => {
  return jwt.sign({ userId }, env.JWT_ACESS_TOKEN_SECRET as string, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    subject: "accessToken",
  });
};

// Generate JWT Refresh Token
export const generateRefreshToken = (userId: Types.ObjectId): string => {
  return jwt.sign({ userId }, env.JWT_REFRESH_TOKEN_SECRET as string, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
    subject: "refreshToken",
  });
};

export const verifyAccessToken = (token: string): any => {
  return jwt.verify(token, env.JWT_ACESS_TOKEN_SECRET as string);
};

export const verifyRefreshToken = (token: string): any => {
  return jwt.verify(token, env.JWT_REFRESH_TOKEN_SECRET as string);
};
