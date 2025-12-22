import { NextFunction, Request, Response } from "express";
import AccountModel from "../modules/account/schemas/account.schema";

type Role = "admin" | "user";

export const authorize = (roles: Role | Role[]) => {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Không có quyền truy cập. Vui lòng đăng nhập.",
        });
      }

      const user = await AccountModel.findById(userId).select("role");
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "Người dùng không tồn tại." });
      }

      if (!allowed.includes(user.role as Role)) {
        return res.status(403).json({
          success: false,
          message: "Không có quyền. Yêu cầu quyền admin.",
        });
      }

      next();
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Lỗi máy chủ.",
        error: error.message,
      });
    }
  };
};

export default authorize;
