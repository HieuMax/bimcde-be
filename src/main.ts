import express from 'express';
import { env } from './env';

const app = express();

app.get('/', (req, res) => {
  res.send('Hello from Express server!');
});

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});
