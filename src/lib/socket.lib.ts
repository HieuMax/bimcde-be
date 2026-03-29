import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: "*", // chỉnh lại domain FE nếu cần
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log("⚡ Client connected:", socket.id);

    socket.on("join", (userId: string) => {
      socket.join(`user_${userId}`);
      console.log(`✅ User ${userId} joined room`);
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("❌ Socket.io not initialized!");
  }
  return io;
};
