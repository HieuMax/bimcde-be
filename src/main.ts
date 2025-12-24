import express from 'express';
import { env } from './env';
import cors from 'cors';
import { apiRouter } from './routes/router';
import mongoose from 'mongoose';

import projectRoutes from './modules/projects/project.routes'
import explorerRoutes from './modules/explorer/explorer.routes'
import fileRoutes from './modules/file/file.routes';
import viewRoutes from './modules/view/view.routes';
import todoRoutes from './modules/todo/todo.routes';

const app = express();

  app.use(
    cors({
      origin: ['http://localhost:3000'],
      credentials: true,
    })
  );

  app.use('/api', apiRouter);

  app.use('/api/files', fileRoutes);
  app.use('/api', viewRoutes);
  app.use('/api', todoRoutes);

  app.use('/api', projectRoutes);
  app.use('/api', explorerRoutes);

const bootstrap = async () => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({
    origin: process.env.WHITE_LISTED_DOMAINS?.split(',') || [],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  }));

  app.use('/api', apiRouter);
  logEnv()
  connectDB()

  app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
  });
}
const connectDB = async () => {
  try {
      await mongoose.connect(env.MONGODB_URL, {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 15000,
      });
      console.log('MongoDB connected successfully'); 
  } catch (error: any) {
      console.error(`Error connection to mongoDB: ${error.message}`);
      process.exit(1);
  }
}

const logEnv = () => {
  console.log(`PORT: ${env.PORT}`)
  console.log(`APP_URL: ${env.APP_URL}`)
  console.log(`APP_TITLE: ${env.APP_TITLE}`)
  console.log(`SWAGGER_VERSION: ${env.SWAGGER_VERSION}`)
  console.log(`SWAGGER_PATH: ${env.SWAGGER_PATH}`)
  console.log(`WHITE_LISTED_DOMAINS: ${env.WHITE_LISTED_DOMAINS}`)
  console.log(`MONGODB_URL: ${env.MONGODB_URL}`)
}

bootstrap();
