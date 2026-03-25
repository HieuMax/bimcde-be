import process from "process";
import dotenv from "dotenv";
import ms from "ms";

dotenv.config();

export const env = {
  PORT: process.env.APP_PORT || 4000,
  APP_URL: process.env.APP_URL,
  APP_TITLE: process.env.APP_TITLE,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
  SWAGGER_VERSION: process.env.SWAGGER_VERSION,
  SWAGGER_PATH: process.env.SWAGGER_PATH,
  MONGODB_URL: process.env.MONGODB_URL || 'mongodb://localhost:27017/bimcde',
  WHITE_LISTED_DOMAINS: process.env.WHITE_LISTED_DOMAINS
    ? JSON.parse(process.env.WHITE_LISTED_DOMAINS)
    : [
      "http://localhost:3000"
    ],
  MAIL_USER: process.env.MAIL_USER || "",
  MAIL_PASS: process.env.MAIL_PASS || process.env.PASS_USER || "",

  JWT_ACESS_TOKEN_SECRET: process.env.JWT_ACESS_TOKEN_SECRET,
  JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET,

  ACCESS_TOKEN_EXPIRES_IN: (process.env.ACCESS_TOKEN_EXPIRES_IN) as ms.StringValue,
  REFRESH_TOKEN_EXPIRES_IN: (process.env.REFRESH_TOKEN_EXPIRES_IN) as ms.StringValue,

  // R2
  R2_ENDPOINT: process.env.R2_ENDPOINT,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN || '',

  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
};