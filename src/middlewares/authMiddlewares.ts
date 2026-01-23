import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/authUntil";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { Types } from "mongoose";
import AccountModel from "../modules/account/schemas/account.schema"; //

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      code: "AuthenticationError",
      message: "Truy cập bị từ chối. Vui lòng đăng nhập.",
    });
    return;
  }

  const [_, token] = authHeader.split(" ");

  try {
    // 1. Verify Token
    const jwtPayload = verifyAccessToken(token) as { userId: Types.ObjectId };

    // 2. Fetch User Info (Quan trọng: Lấy các trường cần thiết cho Audit Log)
    // Dùng lean() để tối ưu tốc độ vì ta không cần save() lại user ở đây
    const user = await AccountModel.findById(jwtPayload.userId)
      .select("fullName email role avatar")
      .lean();

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Người dùng không tồn tại hoặc đã bị xóa.",
      });
      return;
    }

    // 3. Gắn thông tin vào Request
    req.userId = jwtPayload.userId; // Giữ lại để các Controller cũ vẫn chạy
    req.user = user as any; // Gắn object user (có fullName, email) cho AuditLog dùng

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Refresh token đã hết hạn. Vui lòng đăng nhập lại.",
      });
    }
    if (error instanceof JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ. Vui lòng đăng nhập lại.",
      });
    }
    res.status(401).json({
      code: "AuthenticationError",
      message: "Token không hợp lệ hoặc đã hết hạn.",
    });
  }
};
