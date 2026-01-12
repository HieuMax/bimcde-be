import mongoose, { Schema, Model } from "mongoose";
import { IAccount } from "../interfaces/account.interface"; // Import interface vừa tạo

const accountSchema = new Schema<IAccount>(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      maxLength: [50, "Full name must be less than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // Lưu ý: unique trong mảng message validator của Mongoose đôi khi không hoạt động như ý, nên để true đơn giản hoặc xử lý ở index
      maxLength: [50, "Email must be less than 50 characters"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      enum: {
        values: ["admin", "user"],
        message: "Role must be either 'admin' or 'user'",
      },
      default: "user",
    },
    phone: { type: String },
  },
  { timestamps: true }
);

const AccountModel: Model<IAccount> =
  mongoose.models.Account ||
  mongoose.model<IAccount>("Account", accountSchema);

export default AccountModel;
