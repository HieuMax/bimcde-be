import { Schema, model } from "mongoose";
import { IUnit } from "../interfaces/unit.interfaces";
const units = new Schema<IUnit>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: "projects",
    required: true,
  },
  angularunit: {
    type: String,
    default: "deg",
  },
  angularunitformat: {
    type: String,
    default: "0.001",
  },
  areaunit: {
    type: String,
    default: "ft2",
  },
  areaunitformat: {
    type: String,
    default: "0.01",
  },
  lengthmeasurementunit: {
    type: String,
    default: "in",
  },
  lengthmeasurementunitformat: {
    type: String,
    default: "0.1",
  },
  lengthunit: {
    type: String,
    default: "in",
  },
  lengthunitformat: {
    type: String,
    default: "0.1",
  },
  unitsystem: {
    type: String,
    default: "imperial",
  },
  volumeunit: {
    type: String,
    default: "yd3",
  },
  volumeunitformat: {
    type: String,
    default: "0.001",
  },
  weightunit: {
    type: String,
    default: "ton",
  },
  weightunitformat: {
    type: String,
    default: "0.001",
  },
});

const unitModel = model<IUnit>("units", units);

export default unitModel;
