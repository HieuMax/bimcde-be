import express from "express";
import { AccountController } from "../modules/account/controller/account.controller";
import { FolderController } from "../modules/folder/controllers/folder.controller";
import { FileController } from "../modules/file/controllers/file.controller";
import { ExplorerController } from "../modules/explorer/controllers/explorer.controller";
import { CleanupController } from "../modules/system/controllers/cleanup.controller";
import { CommentController } from "../modules/comment/controllers/comment.controller";
import TagController from "../modules/tag/controllers/tag.controller";

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

export { apiRouter };
