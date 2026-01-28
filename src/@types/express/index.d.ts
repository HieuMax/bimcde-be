import * as express from "express";
import { Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      userId?: Types.ObjectId;
    }
  }
}

// bimcde-be\src\@types\express\index.d.ts