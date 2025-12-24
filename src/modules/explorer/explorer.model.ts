import { Schema, model, Document } from 'mongoose';

const ExplorerSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  parentId: { type: Schema.Types.ObjectId, ref: 'ExplorerItem', default: null },
  name: { type: String, required: true },
  type: { type: String, enum: ['folder', 'file'], required: true },
  fileId: { type: Schema.Types.ObjectId, ref: 'File' },
  previewSrc: String, 
  createdBy: String,
}, { timestamps: true });

ExplorerSchema.index({ projectId: 1, parentId: 1 });

export const ExplorerModel = model('ExplorerItem', ExplorerSchema);