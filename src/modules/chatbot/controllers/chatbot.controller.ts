import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AIService } from "../services/chatbot.service";

const ChatbotController = express.Router();
const aiService = new AIService();

ChatbotController.post(
  "/chatbot",
  asyncHandler(async (req: Request, res: Response) => {
    const { history } = req.body;

    // Kiểm tra xem lịch sử có được gửi lên không
    if (!history || !Array.isArray(history)) {
      throw new Error("Lịch sử chat (history) là bắt buộc");
    }

    console.log("Chat request history length:", history.length);

    const reply = await aiService.chat(history);

    res.status(200).json({
      reply,
    });
  })
);

export { ChatbotController as AIController };