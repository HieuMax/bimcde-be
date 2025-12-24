import mongoose, { Schema, Document } from 'mongoose';
import { Project } from './project.interface';

export interface ProjectDocument extends Project, Document {}

const ProjectSchema = new Schema<ProjectDocument>(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
  },
  { timestamps: true }
);

export const ProjectModel =
  mongoose.models.Project ||
  mongoose.model<ProjectDocument>('Project', ProjectSchema);
