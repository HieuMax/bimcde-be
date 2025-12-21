import process from "process";
import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.APP_PORT || 4000,
  APP_URL: process?.env.APP_URL,
  APP_TITLE: process?.env.APP_TITLE,
  SWAGGER_VERSION: process?.env.SWAGGER_VERSION,
  SWAGGER_PATH: process?.env.SWAGGER_PATH,
  WHITE_LISTED_DOMAINS: process?.env.WHITE_LISTED_DOMAINS || [
    "https://bimcde-fe.vercel.app/",
  ],
  MONGODB_URL: process?.env.MONGODB_URL || "mongodb://localhost:27017/bimcde",

  R2_ENDPOINT: process?.env.R2_ENDPOINT,
  R2_ACCESS_KEY_ID: process?.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process?.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process?.env.R2_BUCKET_NAME,
  R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN || "",
};
