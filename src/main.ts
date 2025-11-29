import express from 'express';
import { env } from './env';
import cors from 'cors';
import { apiRouter } from './routes/router';
import mongoose from 'mongoose';

const app = express();

const bootstrap = async () => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({
    origin: process.env.WHITE_LISTED_DOMAINS?.split(',') || [],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  }));

  app.use('/api', apiRouter);
  connectDB()

  app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
  });
}

const connectDB = async () => {
  try {
      await mongoose.connect(env.MONGODB_URL, {
          serverSelectionTimeoutMS: 1000,
          socketTimeoutMS: 15000,
      });
      console.log('MongoDB connected successfully'); 
  } catch (error: any) {
      console.error(`Error connection to mongoDB: ${error.message}`);
      process.exit(1);
  }
}

bootstrap();
