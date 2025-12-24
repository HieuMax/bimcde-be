import { Router } from 'express';
import { getProjectById, getProjects } from './project.controller';

const router = Router();

router.get('/projects', getProjects);
router.get('/projects/:projectId', getProjectById);

export default router;
