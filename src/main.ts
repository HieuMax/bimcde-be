import express from 'express';
import { env } from './env';
import cors from 'cors';
import { apiRouter } from './routes/router';

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

  app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
  });
}

bootstrap();
