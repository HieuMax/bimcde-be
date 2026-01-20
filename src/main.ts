import express from "express";
import { env } from "./env";
import cors from "cors";
import { apiRouter } from "./routes/router";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
const bodyParser = require("body-parser");
import { startCleanupJob } from "./modules/system/services/cleanup.service";

const app = express();

const bootstrap = async () => {
  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
  app.use(cookieParser());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (env.WHITE_LISTED_DOMAINS.includes(origin)) {
          callback(null, true);
        } else {
          console.log("Blocked by CORS:", origin);
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })
  );

  app.use("/api", apiRouter);
  logEnv();
  connectDB();
  startCleanupJob();
  app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
    console.log(`API URL: ${env.APP_URL}`);
  });
};

const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGODB_URL, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 15000,
    });
    console.log("MongoDB connected successfully");
  } catch (error: any) {
    console.error(`Error connection to mongoDB: ${error.message}`);
    process.exit(1);
  }
};

const logEnv = () => {
  console.log(`PORT: ${env.PORT}`);
  console.log(`APP_URL: ${env.APP_URL}`);
  console.log(`APP_TITLE: ${env.APP_TITLE}`);
  console.log(`SWAGGER_VERSION: ${env.SWAGGER_VERSION}`);
  console.log(`SWAGGER_PATH: ${env.SWAGGER_PATH}`);
  console.log(`WHITE_LISTED_DOMAINS: ${env.WHITE_LISTED_DOMAINS}`);
  console.log(`MONGODB_URL: ${env.MONGODB_URL}`);
};

bootstrap();
