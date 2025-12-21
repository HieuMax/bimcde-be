import { Types } from "mongoose";

export interface IUnit {
  projectId: Types.ObjectId;
  angularunit: string;
  angularunitformat: string;
  areaunit: string;
  areaunitformat: string;
  lengthmeasurementunit: string;
  lengthmeasurementunitformat: string;
  lengthunit: string;
  lengthunitformat: string;
  unitsystem: string;
  volumeunit: string;
  volumeunitformat: string;
  weightunit: string;
  weightunitformat: string;
}
