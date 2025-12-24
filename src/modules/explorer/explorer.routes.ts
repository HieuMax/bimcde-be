import { Router } from 'express';
import { getExplorerItems } from './explorer.controller';

const router = Router();

router.get('/projects/:projectId/explorer', getExplorerItems);

export default router;
