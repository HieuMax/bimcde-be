import { model, Schema } from "mongoose";
import { IResetPasswordStorage } from "../interfaces/account.interface";

const resetPasswordStorageSchema = new Schema<IResetPasswordStorage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "accounts",
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

const resetPasswordStorageModel = model<IResetPasswordStorage>(
  "resetPasswordStorage",
  resetPasswordStorageSchema,
);

export default resetPasswordStorageModel;
