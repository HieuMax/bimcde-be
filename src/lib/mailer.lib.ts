// lib/mailer.ts

import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import dotenv from "dotenv";

// Tải biến môi trường từ file .env
dotenv.config();

// Khai báo biến cho Nodemailer transporter
const transporter: Transporter = nodemailer.createTransport({
  service: "gmail", // Sử dụng Gmail SMTP server
  auth: {
    user: process.env.EMAIL_USER as string, // Địa chỉ email (từ .env)
    pass: process.env.EMAIL_PASS as string, // App Password hoặc mật khẩu tài khoản Gmail
  },
});

// Định nghĩa hàm gửi email
const sendEmail = async (
  to: string,
  subject: string,
  text: string,
): Promise<void> => {
  const mailOptions: SendMailOptions = {
    from: process.env.EMAIL_USER as string, // Người gửi
    to, // Người nhận
    subject, // Tiêu đề email
    html: `${text}`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email đã được gửi thành công:", info.response);
  } catch (error) {
    console.error("Lỗi khi gửi email:", error);
  }
};

export { sendEmail };
