import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ViewController } from "./controllers/view.controller";

const router = Router();

router.post("/", asyncHandler(ViewController.create));
router.get("/:id", asyncHandler(ViewController.getDetail));
router.delete("/:id", asyncHandler(ViewController.delete));
router.get("/file/:fileId", asyncHandler(ViewController.getByFile));

export default router;
