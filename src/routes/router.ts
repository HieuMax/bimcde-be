import express from 'express';
import { AccountController } from '../modules/account/controller/account.controller';

const apiRouter = express.Router();

apiRouter.use('/accounts', AccountController);

export { apiRouter };