import { model, Schema } from "mongoose";
import { INotification } from "../interfaces/notification.interfaces";

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "accounts",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const notificationModel = model<INotification>(
  "Notification",
  notificationSchema,
);

export default notificationModel;
