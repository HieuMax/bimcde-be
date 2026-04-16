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
    console.log("❌ [AUTHENTICATE] Missing or invalid Authorization header");
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
      // Access JWT hết hạn — client nên gọi /accounts/refresh-token (không log full stack).
      console.warn(
        "[AUTHENTICATE] Access token expired",
        error.expiredAt?.toISOString?.() ?? "",
      );
      return res.status(401).json({
        success: false,
        code: "ACCESS_TOKEN_EXPIRED",
        message:
          "Phiên đăng nhập đã hết hạn. Vui lòng làm mới token hoặc đăng nhập lại.",
      });
    }
    if (error instanceof JsonWebTokenError) {
      console.warn("[AUTHENTICATE] Invalid JWT:", error.message);
      return res.status(401).json({
        success: false,
        code: "INVALID_ACCESS_TOKEN",
        message: "Token không hợp lệ. Vui lòng đăng nhập lại.",
      });
    }
    console.error("❌ [AUTHENTICATE] Unexpected error:", error);
    res.status(401).json({
      code: "AuthenticationError",
      message: "Token không hợp lệ hoặc đã hết hạn.",
    });
  }
};

// bimcde-be\src\middlewares\authMiddlewares.ts