import todoModel from "../../todo/schemas/todo.schema";
import Todo2DModel from "../../../todo2d/schemas/todo2d.schema";
import { ICommentTodo } from "../interfaces/comment.interfaces";
import commentTodoModel from "../schemas/comment.schemas";

export default class TodoCommentService {
  async getComment(todoId: string) {
    const result = await commentTodoModel.find({ todoId: todoId });
    return result;
  }

  /**
   * Comment gắn theo `todoId` — có thể là Todo (3D) hoặc Todo2D (PDF), cùng collection CommentTodo.
   */
  async assertTodoExists(todoId: string) {
    const id = String(todoId);
    const in3d = await todoModel.findById(id).select("_id").lean();
    if (in3d) return true;
    const in2d = await Todo2DModel.findById(id).select("_id").lean();
    return Boolean(in2d);
  }

  /** Dùng cho activity log: Todo 3D hoặc Todo2D */
  async resolveTodoMetaForActivity(
    todoId: string,
  ): Promise<{ projectId: unknown; title?: string } | null> {
    const id = String(todoId);
    const t = await todoModel.findById(id).select("projectId title").lean();
    if (t) return { projectId: t.projectId, title: t.title };
    const t2 = await Todo2DModel.findById(id).select("projectId title").lean();
    if (t2) return { projectId: t2.projectId, title: t2.title };
    return null;
  }

  async createComment(data: ICommentTodo) {
    const ok = await this.assertTodoExists(String(data.todoId));
    if (!ok) {
      throw new Error("Todo không tồn tại.");
    }

    const result = await commentTodoModel.create({
      ...data,
    });

    return result;
  }

  async updateComment(commentId: string, updateData: any) {
    const comment = await commentTodoModel.findById(commentId);
    if (!comment) {
      throw new Error("Comment không tồn tại.");
    }

    const result = await commentTodoModel.findByIdAndUpdate(
      commentId,
      updateData,
      {
        new: true,
      },
    );
    return result;
  }

  async deleteComment(commentId: string) {
    const comment = await commentTodoModel.findById(commentId);
    if (!comment) {
      throw new Error("Comment không tồn tại.");
    }

    const result = await commentTodoModel.findByIdAndDelete(commentId);
    return result;
  }
}
