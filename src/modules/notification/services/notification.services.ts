import { getIO } from "../../../lib/socket.lib";
import AccountModel from "../../account/schemas/account.schema";
import { INotification } from "../interfaces/notification.interfaces";
import notificationModel from "../schemas/comment.schemas";

export default class NotificationService {
  async getAllNotification(userId: string) {
    const result = await notificationModel
      .find({ userId: userId })
      .sort({ createOn: 1 });
    return result;
  }

  async createNotification(data: INotification) {
    const user = await AccountModel.findById(data.userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại.");
    }

    const result = await notificationModel.create({
      ...data,
    });

    return result;
  }

  async deleteNotification(notificationId: string) {
    const result = await notificationModel.findByIdAndDelete(notificationId);

    if (!result) {
      throw new Error("Error when delete notification");
    }
    const io = getIO();
    io.to(`user_${result.userId}`).emit("delete_notification", notificationId);

    return result;
  }

  async readNotification(notificationId: string) {
    // Tìm thông báo theo ID
    const ntf = await notificationModel.findById(notificationId);

    if (!ntf) {
      throw new Error("Notification không tồn tại.");
    }

    const result = await notificationModel.findByIdAndUpdate(
      { _id: notificationId },
      { $set: { isRead: true } },
      { new: true },
    );
    if (!result) {
      throw new Error("Error when read notification");
    }
    const io = getIO();
    io.to(`user_${result.userId.toString()}`).emit(
      "read_notification",
      notificationId,
    );

    return result;
  }

  async readAllNotifications(userId: string) {
    const result = await notificationModel.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } },
    );

    const io = getIO();
    io.to(`user_${userId.toString()}`).emit("readAll_notification");

    return result;
  }

  async deleteAllNotifications(userId: string) {
    const result = await notificationModel.deleteMany({ userId });

    const io = getIO();
    io.to(`user_${userId.toString()}`).emit("deleteAll_notification");

    return result;
  }
}
