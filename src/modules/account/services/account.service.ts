import bcrypt from "bcryptjs";
import AccountModel from "../models/account.model";
import { IAccount } from "../interfaces/account.interface";

export default class AccountService {
  // 1. Tạo Account mới
  async createAccount(data: Partial<IAccount>) {
    const { email, password, fullName, role, phone } = data;

    // Kiểm tra email đã tồn tại chưa
    const existingAccount = await AccountModel.findOne({ email });
    if (existingAccount) {
      throw new Error("Email already exists");
    }

    // Mã hóa mật khẩu (Salt round = 10)
    if (!password) throw new Error("Password is required");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới
    const newAccount = new AccountModel({
      fullName,
      email,
      password: hashedPassword, // Lưu password đã mã hóa
      role: role || "user",
      phone,
    });

    await newAccount.save();

    // Trả về data nhưng loại bỏ password để bảo mật
    const accountResponse = newAccount.toObject();
    // @ts-ignore
    delete accountResponse.password;

    return accountResponse;
  }

  // 2. Lấy danh sách tất cả Account
  async getAllAccounts() {
    // .select('-password') để không trả về trường password
    // .lean() để tối ưu hiệu năng query
    const accounts = await AccountModel.find()
      .select("-password")
      .sort({ createdAt: -1 }) // User mới nhất lên đầu
      .lean();

    return accounts;
  }

  // 3. Xóa Account
  async deleteAccount(id: string) {
    const deletedAccount = await AccountModel.findByIdAndDelete(id);

    if (!deletedAccount) {
      throw new Error("Account not found");
    }

    return deletedAccount;
  }
}
