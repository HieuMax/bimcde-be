// modules/view/view.routes.ts
import { Router } from 'express';
import {
  getViewsByProject,
  // getViewById,
  getViewDetail,
  createView,
} from './view.controller';

const router = Router();

router.get('/projects/:projectId/views', getViewsByProject);
router.post('/projects/:projectId/views', createView);
router.get('/views/:viewId', getViewDetail);

export default router;
