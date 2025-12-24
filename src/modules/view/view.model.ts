import { Schema, model, Document } from 'mongoose';

const ViewSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true },
  type: { type: String, enum: ['2d', '3d'], required: true },
  name: { type: String, required: true },
  previewSrc: String, 
  
  settings: {
    pageIndex: { type: Number, default: 1 }, 
    camera: { x: Number, y: Number, z: Number }, 
    zoom: { type: Number, default: 1 }
  },
  createdBy: String,
}, { timestamps: true });

export const ViewModel = model('View', ViewSchema);