import * as express from "express";
import { Types } from "mongoose";
import { IAccount } from "../../modules/account/interfaces/account.interface";

declare global {
  namespace Express {
    interface Request {
      userId?: Types.ObjectId;
      user?: IAccount & { _id: Types.ObjectId };
    }
  }
}
