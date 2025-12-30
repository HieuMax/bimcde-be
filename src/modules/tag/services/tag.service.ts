import TagModel, { ITag } from "../schemas/tag.schema";
import { AppError } from "../../../utils/AppError";

export default class TagService {
  // --- GET ALL TAGS BY PROJECT ---
  async getAllTags(projectId: string): Promise<ITag[]> {
    return await TagModel.find();
  }

  // --- CREATE TAG ---
  async createTag(data: {
    name: string;
    color: string;
    projectId: string;
  }): Promise<ITag> {
    // Check duplicate name in same project
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

    const newTag = await TagModel.create(data);
    return newTag;
  }

  // --- UPDATE TAG ---
  async updateTag(id: string, data: Partial<ITag>): Promise<ITag> {
    // Check duplication if name changes
    if (data.name) {
      const currentTag = await TagModel.findById(id);
      if (!currentTag) throw new AppError("Tag not found", 404);

      const duplicate = await TagModel.findOne({
        projectId: currentTag.projectId,
        name: data.name,
        _id: { $ne: id },
      });

      if (duplicate) {
        throw new AppError("Tag with this name already exists", 400);
      }
    }

    const updatedTag = await TagModel.findByIdAndUpdate(id, data, {
      new: true,
    });

    if (!updatedTag) throw new AppError("Tag not found", 404);

    return updatedTag;
  }

  // --- DELETE TAG ---
  async deleteTag(id: string): Promise<boolean> {
    const tag = await TagModel.findByIdAndDelete(id);

    if (!tag) throw new AppError("Tag not found", 404);

    // TODO: Consider removing this tag from all files via FileModel
    // await FileModel.updateMany({ tags: id }, { $pull: { tags: id } });

    return true;
  }
}
