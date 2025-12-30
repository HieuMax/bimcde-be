import { model, Schema, Types } from "mongoose";

interface ISession {
  refreshToken: string;
  userId: Types.ObjectId;
}

const sessionSchema = new Schema<ISession>({
  refreshToken: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
});

export default model<ISession>("Session", sessionSchema);
