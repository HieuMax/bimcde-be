import express from "express";
import { FolderController } from "../modules/folder/controllers/folder.controller";
import { FileController } from "../modules/file/controllers/file.controller";
import { ExplorerController } from "../modules/explorer/controllers/explorer.controller";
import { CleanupController } from "../modules/system/controllers/cleanup.controller";
import { CommentController } from "../modules/comment/controllers/comment.controller";
import TagController from "../modules/tag/controllers/tag.controller";
import { AccountController } from "../modules/account/controllers/account.controller";
import { ProjectController } from "../modules/project/controllers/project.controller";
import { PermissionsController } from "../modules/permission/controllers/permissions.controller";
import { UnitController } from "../modules/unit/controllers/unit.controller";
import TopicsController from "../modules/topic/controllers/topics.controller";
import { TeamController } from "../modules/team/controllers/team.controllers";
import { TodoController } from "../modules/todo/todo/controllers/todo.controllers";
import TodoCommentController from "../modules/todo/comment/controllers/comment.controller";

const apiRouter = express.Router();

apiRouter.use("/accounts", AccountController);
apiRouter.use("/folders", FolderController);
apiRouter.use("/files", FileController);
apiRouter.use("/explorer", ExplorerController);
apiRouter.use("/cleanup", CleanupController);
apiRouter.use("/comments", CommentController);
apiRouter.use("/tags", (req, res, next) => {
  const router = express.Router();
  router.get("/", TagController.getAllTags);
  router.post("/", TagController.createTag);
  router.put("/:id", TagController.updateTag);
  router.delete("/:id", TagController.deleteTag);
  router(req, res, next);
});
apiRouter.use("/projects", ProjectController);
apiRouter.use("/permissions", PermissionsController);
apiRouter.use("/units", UnitController);
apiRouter.use("/topics", TopicsController);
apiRouter.use("/team", TeamController);
apiRouter.use("/todo", TodoController);
apiRouter.use("/todo/comment", TodoCommentController);

export { apiRouter };
