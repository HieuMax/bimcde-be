import { IView } from "../interfaces/view.interface";
import { AppError } from "../../../utils/AppError";
import { Types } from "mongoose";
import ViewModel from "../schemas/view.schemas";

export default class ViewService {

    // --- GET ALL VIEWS BY PROJECT ---
    async getAllViews(projectId: string): Promise<IView[]> {
        return await ViewModel.find({ projectId: new Types.ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .populate("createdBy", "fullName email")
            .exec();
    }

    // --- CREATE VIEW ---
    async create(data: Partial<IView>): Promise<IView> {
        const newView = await ViewModel.create(data);
        return await newView.populate("createdBy", "fullName email");
    }

    // --- UPDATE VIEW INFO (Text only) ---
    async updateViewInfo(id: string, data: Partial<IView>, userId: string): Promise<IView> {
        const view = await ViewModel.findById(id);
        if (!view) throw new AppError("View not found", 404);

        const { title, description, shareWith, tags } = data;

        const updatedView = await ViewModel.findByIdAndUpdate(
            id,
            { title, description, shareWith, tags },
            { new: true, runValidators: true }
        ).populate("createdBy", "fullName email");

        return updatedView as IView;
    }

    // --- UPDATE SNAPSHOT (3D State only) ---
    async updateSnapshot(id: string, snapshotData: { viewState: any, items: any[] }, userId: string): Promise<IView> {
        const view = await ViewModel.findById(id);
        if (!view) throw new AppError("View not found", 404);

        const updatedView = await ViewModel.findByIdAndUpdate(
            id,
            {
                viewState: snapshotData.viewState,
                items: snapshotData.items
            },
            { new: true }
        ).populate("createdBy", "fullName email");

        return updatedView as IView;
    }

    // --- DELETE VIEW ---
    async deleteView(id: string, userId: string): Promise<boolean> {
        const view = await ViewModel.findById(id);
        if (!view) throw new AppError("View not found", 404);

        await ViewModel.findByIdAndDelete(id);
        return true;
    }
}