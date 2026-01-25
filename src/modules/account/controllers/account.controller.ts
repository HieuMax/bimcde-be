import { Request, Response } from "express";
import express from "express";
import AccountService from "../services/account.service";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { authenticate } from "../../../middlewares/authMiddlewares";
const AccountController = express.Router();

const accountService = new AccountService();

// Register a new account
AccountController.post("/register", async (req: Request, res: Response) => {
  try {
    const result = await accountService.register(req.body);

    res.status(201).json({
      success: true,
      message: "Tài khoản đã được đăng ký thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi đăng ký tài khoản.",
      error: error.message,
    });
  }
});

AccountController.post("/login", async (req: Request, res: Response) => {
  try {
    const result = await accountService.login(req.body);
    res.status(201).json({
      success: true,
      message: `Tài khoản ${result.user.fullName} đã được đăng nhập thành công.`,
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi đăng nhập tài khoản.",
      error: error.message,
    });
  }
});

AccountController.post(
  "/refresh-token",
  async (req: Request, res: Response) => {
    try {
      const data = req.body;
      const result = await accountService.refreshToken(data.refreshToken);
      res.status(201).json({
        success: true,
        accessToken: result.accessToken,
      });
    } catch (error: any) {
      if (error instanceof TokenExpiredError) {
        return res.status(401).json({
          success: false,
          message: "Refresh token đã hết hạn. Vui lòng đăng nhập lại.",
        });
      }
      if (error instanceof JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          message: "Refresh token không hợp lệ. Vui lòng đăng nhập lại.",
        });
      }
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi làm mới token.",
        error: error.message,
      });
    }
  },
);

AccountController.post(
  "/logout",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (refreshToken) {
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "none",
        });
      }

      const result = await accountService.logout(req.userId);
      res.status(201).json({
        success: true,
        message: `Tài khoản với ID ${result} đã được đăng xuất thành công.`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi làm mới token.",
        error: error.message,
      });
    }
  },
);

AccountController.get(
  "/profile",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const result = await accountService.getProfile(req.userId);
      res.status(200).json({
        success: true,
        message: "Lấy thông tin tài khoản thành công.",
        user: result.user,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi lấy thông tin tài khoản.",
        error: error.message,
      });
    }
  },
);

AccountController.post(
  "/change-password",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const result = await accountService.changePassword(req.userId, req.body);
      res.status(200).json({
        success: true,
        message: "Đổi mật khẩu thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi đổi mật khẩu.",
        error: error.message,
      });
    }
  },
);

AccountController.post(
  "/update-profile",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const result = await accountService.updateProfile(req.userId, req.body);
      res.status(200).json({
        success: true,
        message: "Cập nhật thông tin tài khoản thành công.",
        user: result.user,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi cập nhật thông tin tài khoản.",
        error: error.message,
      });
    }
  },
);

// AccountController.get(
//   "/all",
//   authenticate,
//   async (req: Request, res: Response) => {
//     try {
//       const users = await accountService.getAllUsers();
//       res.status(200).json({
//         success: true,
//         message: "Lấy danh sách người dùng thành công.",
//         users,
//       });
//     } catch (error: any) {
//       res.status(500).json({
//         success: false,
//         message: "Xảy ra lỗi khi lấy danh sách người dùng.",
//         error: error.message,
//       });
//     }
//   },
// );

AccountController.get(
  "/getAllUser",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const result = await accountService.getAllUser(req.userId);
      res.status(200).json({
        success: true,
        message: "Lấy danh sách người dùng thành công.",
        result: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi lấy danh sách người dùng.",
        error: error.message,
      });
    }
  },
);

export { AccountController };
