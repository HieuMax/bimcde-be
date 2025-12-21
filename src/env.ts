import process from "process";
import dotenv from "dotenv";
import ms from "ms";

dotenv.config();

export const env = {
  PORT: process.env.PORT || 4000,
  APP_URL: process?.env.APP_URL,
  APP_TITLE: process?.env.APP_TITLE,
  SWAGGER_VERSION: process?.env.SWAGGER_VERSION,
  SWAGGER_PATH: process?.env.SWAGGER_PATH,
  WHITE_LISTED_DOMAINS: process?.env.WHITE_LISTED_DOMAINS || [
    "https://bimcde-fe.vercel.app/",
  ],
  MONGODB_URL:
    process?.env.MONGODB_CLOUD_URL || "mongodb://localhost:27017/bimcde",
  JWT_ACESS_TOKEN_SECRET: process.env.JWT_ACESS_TOKEN_SECRET,
  JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRES_IN: process.env
    .ACCESS_TOKEN_EXPIRES_IN as ms.StringValue,
  REFRESH_TOKEN_EXPIRES_IN: process.env
    .REFRESH_TOKEN_EXPIRES_IN as ms.StringValue,
};
