import express from "express";
import { FolderController } from "../modules/folder/controllers/folder.controller";
import { FileController, PublicFileController } from "../modules/file/controllers/file.controller";
import { ExplorerController } from "../modules/explorer/controllers/explorer.controller";
import { CleanupController } from "../modules/system/controllers/cleanup.controller";
import { CommentController } from "../modules/comment/controllers/comment.controller";
import { TagController } from "../modules/tag/controllers/tag.controller";
import { AccountController } from "../modules/account/controllers/account.controller";
import { ProjectController } from "../modules/project/controllers/project.controller";
import { PermissionsController } from "../modules/permission/controllers/permissions.controller";
import { UnitController } from "../modules/unit/controllers/unit.controller";
import TopicsController from "../modules/topic/controllers/topics.controller";
import ShareRouter from "../modules/file/routes/share.route"
import ViewController from "../modules/view/controllers/view.controller";
import { authenticate } from "../middlewares/authMiddlewares";
import TodoController from "../modules/todo/controllers/todo.controller";

const apiRouter = express.Router();

apiRouter.use("/accounts", AccountController);
apiRouter.use("/folders", FolderController);
apiRouter.use("/files", PublicFileController);
apiRouter.use("/files", authenticate, FileController);
apiRouter.use("/share", ShareRouter );
apiRouter.use("/explorer", ExplorerController);
apiRouter.use("/cleanup", CleanupController);
apiRouter.use("/comments", CommentController);
apiRouter.use("/tags", TagController);
apiRouter.use("/projects", ProjectController);
apiRouter.use("/permissions", PermissionsController);
apiRouter.use("/units", UnitController);
apiRouter.use("/topics", TopicsController);
apiRouter.use("/views", ViewController)
apiRouter.use("/todos", TodoController)
export { apiRouter };
