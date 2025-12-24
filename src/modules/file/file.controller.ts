// modules/file/file.controller.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { FileModel } from './file.model';
import { Types } from 'mongoose';
export const getFilesByProject = async (req: Request, res: Response) => {
  const { projectId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return res.status(400).json({ message: 'Invalid projectId' });
  }

  const files = await FileModel.find({ projectId });
  res.json(files);
};

export const getFileById = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    
    const file = await FileModel.findById(fileId).lean(); 

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.json(file);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
