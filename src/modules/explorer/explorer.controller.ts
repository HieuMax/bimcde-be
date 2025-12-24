import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ExplorerModel } from './explorer.model';

export const getExplorerItems = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { parentId } = req.query;

    const query = {
      projectId,
      parentId: parentId === 'root' || !parentId ? null : parentId
    };

    const items = await ExplorerModel.find(query)
      .select('name type fileId previewSrc updatedAt') 
      .sort({ type: 1, name: 1 }) 
      .lean();

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching explorer items' });
  }
};