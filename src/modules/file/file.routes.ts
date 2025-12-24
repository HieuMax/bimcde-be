import { Router } from 'express';
import { getFilesByProject, getFileById } from './file.controller';

const router = Router();

router.get('/files/:fileId/pages', getFilesByProject);
router.get('/projects/:projectId/files', getFilesByProject);
router.get('/files/:fileId', getFileById);

export default router;
