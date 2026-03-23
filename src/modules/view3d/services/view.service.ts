import { IView } from "../interfaces/view.interface";
import { AppError } from "../../../utils/AppError";
import { Types } from "mongoose";
import ViewModel from "../schemas/view.schemas";
import groupMemberModel from "../../team/schemas/group-member.schema";

export default class ViewService {

    // --- GET ALL VIEWS BY PROJECT ---
    async getAllViews(projectId: string, filters?: { userIds?: string; groupIds?: string; startDate?: string; endDate?: string }): Promise<IView[]> {
        const query: any = { projectId: new Types.ObjectId(projectId) };

        // --- Users & Groups Filter Logic ---
        let targetUserIds: Types.ObjectId[] = [];

        // 1. Users Filter
        if (filters?.userIds) {
            const ids = filters.userIds.split(",").map(id => new Types.ObjectId(id.trim()));
            targetUserIds.push(...ids);
        }

        // 2. Groups Filter
        if (filters?.groupIds) {
            const groupIds = filters.groupIds.split(",").map(id => new Types.ObjectId(id.trim()));
            const members = await groupMemberModel.find({ groupId: { $in: groupIds } }).select("userId");
            const memberUserIds = members.map(m => m.userId);
            targetUserIds.push(...memberUserIds);
        }

        // Apply User/Group filters to 'createdBy'
        if (targetUserIds.length > 0) {
            query.createdBy = { $in: targetUserIds };
        }

        // Date Modified Filter
        if (filters?.startDate || filters?.endDate) {
            query.updatedAt = {};
            if (filters.startDate) query.updatedAt.$gte = new Date(filters.startDate);
            if (filters.endDate) query.updatedAt.$lte = new Date(filters.endDate);
        }

        return await ViewModel.find(query)
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
    // async updateSnapshot(id: string, snapshotData: { viewState: any, items: any[] }, userId: string): Promise<IView> {
    //     const view = await ViewModel.findById(id);
    //     if (!view) throw new AppError("View not found", 404);

    //     const updatedView = await ViewModel.findByIdAndUpdate(
    //         id,
    //         {
    //             viewState: snapshotData.viewState,
    //             items: snapshotData.items
    //         },
    //         { new: true }
    //     ).populate("createdBy", "fullName email");

    //     return updatedView as IView;
    // }
    async updateSnapshot(
        id: string,
        snapshotData: { viewState: any; items: any[] },
        userId: string
        ): Promise<IView> {

        const view = await ViewModel.findById(id);
        if (!view) throw new AppError("View not found", 404);

        if (!snapshotData.viewState) {
            throw new AppError("viewState is required", 400);
        }

        const updatedView = await ViewModel.findByIdAndUpdate(
            id,
            {
            viewState: snapshotData.viewState,
            items: snapshotData.items || [],
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