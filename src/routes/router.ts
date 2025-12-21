import express from "express";
import { AccountController } from "../modules/account/controllers/account.controller";
import { ProjectController } from "../modules/project/controllers/project.controller";
import { PermissionsController } from "../modules/permission/controllers/permissions.controller";
import { UnitController } from "../modules/unit/controllers/unit.controller";
import TopicsController from "../modules/topic/controllers/topics.controller";

const apiRouter = express.Router();

apiRouter.use("/accounts", AccountController);
apiRouter.use("/projects", ProjectController);
apiRouter.use("/permissions", PermissionsController);
apiRouter.use("/units", UnitController);
apiRouter.use("/topics", TopicsController);

export { apiRouter };
