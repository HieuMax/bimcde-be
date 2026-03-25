import { emailLayout } from "./layout";

/* ================== TYPES ================== */
export interface AssignTodoEmailData {
  fullName: string;
  todoName: string;
  link: string;
}

export interface InviteUserEmailData {
  fullName: string;
  projectName: string;
  inviterName: string;
  link: string;
}



/* ================== TEMPLATES ================== */

// 1. Assign Todo
export const assignTodoTemplate = (data: AssignTodoEmailData): string => {
  const { fullName, todoName, link } = data;

  const content = `
    <h3>Hi ${fullName},</h3>

    <p>You have been assigned a new Todo:</p>

    <p style="font-weight:bold;background:#f0f3f5;padding:10px;border-radius:5px;">
      ${todoName}
    </p>

    <p style="text-align:center;margin:30px 0;">
      ${button(link, "View Todo")}
    </p>

    ${footerText()}
  `;

  return emailLayout(content);
};

// 2. Invite User
export const inviteUserTemplate = (data: InviteUserEmailData): string => {
  const { fullName, projectName, inviterName, link } = data;

  const content = `
    <h3>Hi ${fullName},</h3>

    <p><strong>${inviterName}</strong> has invited you to join the project:</p>

    <p style="font-weight:bold;background:#f0f3f5;padding:10px;border-radius:5px;">
      ${projectName}
    </p>

    <p style="text-align:center;margin:30px 0;">
      ${button(link, "Accept Invitation")}
    </p>

    <p>If you did not expect this invitation, you can ignore this email.</p>

    ${footerText()}
  `;

  return emailLayout(content);
};

export const resetPasswordTemplate = (resetLink: string): string => {
  const content = `
     <div style="font-family: Arial">
    <h3>Reset Password</h3>
    <p>Bạn đã yêu cầu reset mật khẩu</p>
      <p style="text-align:center;margin:30px 0;">
      ${button(resetLink, "Reset Password")}
      </p>
    <p>Link hết hạn sau 15 phút</p>
  </div>

    ${footerText()}
  `;

  return emailLayout(content);
};

/* ================== REUSABLE COMPONENTS ================== */

const button = (link: string, text: string): string => `
  <a href="${link}" 
     style="background:#3498db;color:#fff;padding:12px 20px;
            text-decoration:none;border-radius:5px;display:inline-block;">
    ${text}
  </a>
`;

const footerText = (): string => `
  <p>Thanks,<br/><strong>BIMCDE Team</strong></p>
`;
