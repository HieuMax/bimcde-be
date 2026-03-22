import { IAttachment } from "../interfaces/attachment.interface";
import { AppError } from "../../../../utils/AppError";
import { Types } from "mongoose";
import AttachmentModel from "../schemas/attachtment.schema";

export default class AttachtmentTodoService {
  // --- GET ALL ATTACHMENTS BY PROJECT ---
  async getAllAttachtment(todoId: string): Promise<IAttachment[]> {
    const query: any = { todoId: new Types.ObjectId(todoId) };

    return await AttachmentModel.find(query).exec();
  }

  // --- Add ATTACHMENT ---
  async AddAttachment(data: IAttachment[]): Promise<IAttachment[]> {
    const attachments = data.map((item) => {
      if (!item.name || !item.todoId || !item.url) {
        throw new AppError("Name, todoId, and url are required", 400);
      }

      return {
        ...item,
        todoId: new Types.ObjectId(item.todoId),
      };
    });

    const newAttachments = await AttachmentModel.insertMany(attachments);

    return newAttachments;
  }

  // --- DELETE ATTACHMENT ---
  async deleteAttachment(id: string, userId: string): Promise<boolean> {
    const attachment = await AttachmentModel.findById(id);

    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }

    // Optional: Check if user has permission to delete (e.g., creator or admin)
    // For now, we'll allow deletion by any authenticated user

    await AttachmentModel.findByIdAndDelete(id);

    return true;
  }
}
