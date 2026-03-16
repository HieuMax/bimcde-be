import { Request, Response, NextFunction } from "express";
import ActivityService from "../modules/activity/services/activity.service";
// import { AppError } from "../utils/AppError"; // Không cần thiết ở đây

const activityService = new ActivityService();

export const auditLog = (
  actionGroup: "FOLDER" | "FILE" | "MEMBER" | "VIEW" | "RELEASE" | "TOPIC",
  actionType: string,
  getTargetInfo: (
    req: Request,
    resBody: any
  ) => { itemId: string; itemName: string; itemModel: string }
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Giữ hàm gốc
    const originalJson = res.json;

    // 2. Override
    res.json = function (body: any): Response {
      const response = originalJson.call(this, body);

      // 3. Fire & Forget Log
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // FIX: Lấy user từ req.user (đã được populate từ authMiddleware mới)
          // Ép kiểu any để tránh TS check gắt gao nếu Type Def chưa nhận kịp
          const currentUser = (req as any).user;

          if (currentUser) {
            // FIX: Xử lý an toàn cho targetInfo (tránh crash nếu resBody khác cấu trúc dự kiến)
            let target;
            try {
              target = getTargetInfo(req, body);
            } catch (e) {
              console.warn("AuditLog: Cannot extract target info", e);
            }

            if (target) {
              activityService
                .logActivity({
                  projectId:
                    req.body?.projectId ||
                    req.query?.projectId ||
                    req.params?.projectId ||
                    (body && body.projectId),
                  actor: {
                    userId: currentUser._id,
                    fullName: currentUser.fullName, // Đã có dữ liệu
                    email: currentUser.email, // Đã có dữ liệu
                  },
                  actionGroup: actionGroup,
                  actionType: actionType,
                  target: {
                    itemId: target.itemId,
                    itemModel: target.itemModel as any,
                    itemName: target.itemName || "Unknown Item",
                  },
                  description: `User ${currentUser.fullName} performed ${actionType} on ${actionGroup}`,
                })
                .catch((err) => console.error("Auto-log write error:", err));
            }
          } else {
            console.warn("AuditLog skipped: No user found in request.");
          }
        } catch (error) {
          console.error("Error generating audit log context:", error);
        }
      }

      return response;
    };

    next();
  };
};
