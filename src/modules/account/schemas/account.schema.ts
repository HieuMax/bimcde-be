import { IAccount } from "../interfaces/account.interface";
import { time } from "console";
import { model, Schema } from "mongoose";
import bcryp from "bcryptjs";

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
      unique: [true, "Email must be unique"],
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

accountSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    next();
    return;
  }
  this.password = await bcryp.hash(this.password, 10);
  next();
});

const AccountModel = model<IAccount>("Account", accountSchema);
export default AccountModel;
