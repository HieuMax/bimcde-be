import process from 'process'

export const env = {
    PORT: process.env.PORT || 4000,
    APP_URL: process?.env.APP_URL,
    APP_TITLE: process?.env.APP_TITLE,
    SWAGGER_VERSION: process?.env.SWAGGER_VERSION,
    SWAGGER_PATH: process?.env.SWAGGER_PATH,
    WHITE_LISTED_DOMAINS: process?.env.WHITE_LISTED_DOMAINS,
    MONGODB_URL: process?.env.MONGODB_URL || 'mongodb://localhost:27017/bimcde',
}