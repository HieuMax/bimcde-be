import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/authUntil";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { Types } from "mongoose";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
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
    // Xác thực token ở đây (sử dụng verifyAccessToken từ authUtil)
    const jwtPayload = verifyAccessToken(token) as { userId: Types.ObjectId };
    // Gắn thông tin người dùng vào request để sử dụng trong các middleware hoặc controller tiếp theo
    req.userId = jwtPayload.userId;
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
        message: "Refresh token không hợp lệ. Vui lòng đăng nhập lại.",
      });
    }
    res.status(401).json({
      code: "AuthenticationError",
      message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
    });
  }
};
