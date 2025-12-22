import { IAccount } from "../interfaces/account.interface";

import Session from "../interfaces/Session";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import {
  generateRefreshToken,
  generateToken,
  verifyRefreshToken,
} from "../../../utils/authUntil";
import AccountModel from "../schemas/account.schema";

type AccountData = Pick<IAccount, "email" | "password" | "fullName">;

export default class AccountService {
  // Đăng ký tài khoản mới
  async register(accountData: AccountData) {
    try {
      // Kiểm tra dữ liệu đầu vào
      if (
        !accountData.email ||
        !accountData.password ||
        !accountData.fullName
      ) {
        throw new Error("Email, mật khẩu, và họ tên bắt buộc.");
      }

      if (accountData.password.length < 6) {
        throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
      }
      if (accountData.fullName.length > 50) {
        throw new Error("Họ tên phải ít hơn 50 ký tự.");
      }

      //   Kiểm tra email đã tồn tại chưa
      const existingAccount = await AccountModel.findOne({
        email: accountData.email,
      });
      if (existingAccount) {
        throw new Error("Email đã tồn tại.");
      }

      //   Tạo tài khoản mới
      const newAccount = new AccountModel({
        ...accountData,
      });
      newAccount.password = await bcrypt.hash(accountData.password, 10);

      //   Lưu tài khoản và tạo token
      const savedAccount = await newAccount.save();

      //   Trả về thông tin tài khoản và token
      const account = savedAccount.toObject();

      return account;
    } catch (error) {
      throw error;
    }
  }

  // Đăng nhập tài khoản
  async login(userData: AccountData) {
    try {
      // Kiểm tra dữ liệu đầu vào
      if (!userData.email || !userData.password) {
        throw new Error("Email và mật khẩu bắt buộc.");
      }

      if (userData.password.length < 6) {
        throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
      }

      //   Kiểm tra email đã tồn tại chưa
      const user = await AccountModel.findOne({
        email: userData.email,
      });
      if (!user) {
        throw new Error("Tài khoản không tồn tại.");
      }
      const passwordIsValid = await bcrypt.compare(
        userData.password,
        user.password
      );

      if (!passwordIsValid) {
        throw new Error("Mật khẩu không đúng.");
      }

      //   Tạo token
      const accessToken = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // xóa các session cũ của user
      await Session.deleteMany({ userId: user._id });

      // Lưu refresh token vào session
      await Session.create({
        userId: user._id,
        refreshToken: refreshToken,
      });

      //   Trả về thông tin tài khoản và token
      //   const account = savedAccount.toObject();

      return {
        user,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      throw error;
    }
  }

  async refreshToken(token: string | undefined) {
    try {
      if (!token) {
        throw new Error("Refresh token is required.");
      }
      //   kiểm tra refresh token
      const existingSession = await Session.findOne({ refreshToken: token });
      if (!existingSession) {
        throw new Error("Không tìm thấy refresh token.");
      }
      // Xác thực refresh token
      const jwtPayload = verifyRefreshToken(token) as {
        userId: Types.ObjectId;
      };
      const accessToken = generateToken(jwtPayload.userId);
      return {
        accessToken: accessToken,
      };
    } catch (error) {
      throw error;
    }
  }

  async logout(userId: Types.ObjectId | undefined) {
    try {
      await Session.deleteMany({ userId: userId });
      return;
    } catch (error) {
      throw error;
    }
  }

  async getProfile(userId: Types.ObjectId | undefined) {
    try {
      const user = await AccountModel.findById(userId).select("-password");
      if (!user) {
        throw new Error("Tài khoản không tồn tại.");
      }
      return { user };
    } catch (error) {
      throw error;
    }
  }

  async changePassword(
    userId: Types.ObjectId | undefined,
    body: { currentPassword: string; newPassword: string }
  ) {
    try {
      const user = await AccountModel.findById(userId);
      if (!user) {
        throw new Error("Tài khoản không tồn tại.");
      }
      const passwordIsValid = await bcrypt.compare(
        body.currentPassword,
        user.password
      );
      if (!passwordIsValid) {
        throw new Error("Mật khẩu hiện tại không đúng.");
      }
      if (body.newPassword.length < 6) {
        throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
      }
      user.password = await bcrypt.hash(body.newPassword, 10);
      await user.save();
      return { message: "Đổi mật khẩu thành công." };
    } catch (error) {
      throw error;
    }
  }

  async updateProfile(userId: Types.ObjectId | undefined, body: AccountData) {
    try {
      const user = await AccountModel.findById(userId);
      if (!user) {
        throw new Error("Tài khoản không tồn tại.");
      }
      if (body) {
        user.fullName = body.fullName;
      }
      await user.save();
      return { user };
    } catch (error) {
      throw error;
    }
  }
}
