import axios from "axios";
import { SYSTEM_PROMPT } from "../chatbot.promts"; // Lưu ý: file này hình như bạn gõ sai chính tả (.promts thay vì .prompts.ts), hãy kiểm tra lại nhé!
import { env } from "../../../env";

interface MessagePayload {
  role: "user" | "assistant" | "system";
  content: string;
}

export class AIService {
  async chat(history: MessagePayload[]) {
    // Tạo mảng messages chuẩn bị gửi cho Groq
    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      // Map toàn bộ lịch sử chat từ frontend gửi lên
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: messages,
          temperature: 0.3,
        },
        {
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Groq response status:", response.status);
      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error("Lỗi khi gọi Groq API:", error?.response?.data || error.message);
      throw new Error("Không thể kết nối đến AI Assistant.");
    }
  }
}