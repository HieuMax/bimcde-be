import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ProjectModel } from './project.model';

export const getProjects = async (req: Request, res: Response) => {
  const projects = await ProjectModel.find().sort({ updatedAt: -1 });
  res.json(projects);
};

export const getProjectById = async (req: Request, res: Response) => {
  const { projectId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'Invalid projectId' });
  }

  const project = await ProjectModel.findById(projectId);

  if (!project) {
    return res.status(404).json({ message: 'Project not found' });
  }

  res.json(project);
};
