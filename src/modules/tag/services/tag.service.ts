import TagModel, { ITag } from "../schemas/tag.schema";
import { AppError } from "../../../utils/AppError";

export default class TagService {
  async getAllTags(projectId: string): Promise<ITag[]> {
    return await TagModel.find({ projectId }).sort({ name: 1 });
  }

  async createTag(data: Partial<ITag>): Promise<ITag> {
    const existingTag = await TagModel.findOne({
      projectId: data.projectId,
      name: data.name,
    });
    if (existingTag) {
      throw new AppError(
        "Tag with this name already exists in the project",
        400
      );
    }
    return await TagModel.create(data);
  }

  async updateTag(id: string, data: Partial<ITag>): Promise<ITag | null> {
    // Check duplication if name changes
    if (data.name) {
      const tag = await TagModel.findById(id);
      if (tag) {
        const duplicate = await TagModel.findOne({
          projectId: tag.projectId,
          name: data.name,
          _id: { $ne: id },
        });
        if (duplicate) {
          throw new AppError("Tag with this name already exists", 400);
        }
      }
    }
    return await TagModel.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteTag(id: string): Promise<void> {
    await TagModel.findByIdAndDelete(id);
    // TODO: Optionally remove this tag from all files?
    // For now, we leave the reference, it will just point to nothing or we can cleanup later.
    // Ideally, we should pull this tag from all files.
    // import FileModel from ... (circular dependency risk if not careful, but safe here)
    // await FileModel.updateMany({ tags: id }, { $pull: { tags: id } });
  }
}
