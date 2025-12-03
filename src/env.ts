import process from 'process'
import dotenv from 'dotenv'

dotenv.config()

export const env = {
    PORT: process.env.PORT || 4000,
    APP_URL: process?.env.APP_URL,
    APP_TITLE: process?.env.APP_TITLE,
    SWAGGER_VERSION: process?.env.SWAGGER_VERSION,
    SWAGGER_PATH: process?.env.SWAGGER_PATH,
    WHITE_LISTED_DOMAINS: process?.env.WHITE_LISTED_DOMAINS || ["https://bimcde-fe.vercel.app/"],
    MONGODB_URL: process?.env.MONGODB_CLOUD_URL || 'mongodb://localhost:27017/bimcde',
}