import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ViewModel } from './view.model';
export const getViewsByProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const views = await ViewModel.find({ projectId }).lean();
    res.json(views);
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
};

export const getViewDetail = async (req: Request, res: Response) => {
  try {
    const { viewId } = req.params;
    
    const view = await ViewModel.findById(viewId)
      .populate('fileId', 'fileUrl fileType name') 
      .lean();

    if (!view) return res.status(404).json({ message: 'View not found' });

    res.json(view);
  } catch (error) {
    res.status(500).json({ message: 'Error' });
  }
};

export const createView = async (req: Request, res: Response) => {
  const { projectId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'Invalid projectId' });
  }

  const view = await ViewModel.create({
    ...req.body,
    projectId,
  });

  res.status(201).json(view);
};
