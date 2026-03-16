import { IClashSet } from "../interfaces/clash.interface";
import { AppError } from "../../../utils/AppError";
import { Types } from "mongoose";
import ClashModel from "../schemas/clash.schemas";

export default class ClashService {

    // --- GET ALL CLASH SETS BY PROJECT ---
    async getAll(projectId: string): Promise<IClashSet[]> {
        return await ClashModel.find({ projectId: new Types.ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .select("-items")
            .populate("createdBy", "fullName email")
            .exec();
    }

    // --- GET DETAILS (WITH ITEMS) ---
    async getById(id: string): Promise<IClashSet> {
        const clashSet = await ClashModel.findById(id).populate("createdBy", "fullName email");
        if (!clashSet) throw new AppError("Clash set not found", 404);
        return clashSet;
    }

    // --- CREATE ---
    async create(data: Partial<IClashSet>, userId: string): Promise<IClashSet> {
        const count = data.items ? data.items.length : 0;

        const newClashSet = await ClashModel.create({
            ...data,
            createdBy: userId,
            clashCount: count,
            status: count > 0 ? "Active" : "Resolved"
        });

        return await newClashSet.populate("createdBy", "fullName email");
    }

    // --- UPDATE ---
    async update(id: string, data: Partial<IClashSet>): Promise<IClashSet> {
        const clashSet = await ClashModel.findByIdAndUpdate(
            id,
            data,
            { new: true, runValidators: true }
        ).populate("createdBy", "fullName email");

        if (!clashSet) throw new AppError("Clash set not found", 404);
        return clashSet;
    }

    // --- DELETE ---
    async delete(id: string): Promise<boolean> {
        const clashSet = await ClashModel.findByIdAndDelete(id);
        if (!clashSet) throw new AppError("Clash set not found", 404);
        return true;
    }
}