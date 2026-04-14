export const emailLayout = (content: string): string => {
  return `
  <html>
    <body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
        <tr>
          <td align="center">
            <table width="600" style="background:#ffffff;border-radius:8px;overflow:hidden;">
              
              <!-- Header -->
              <tr>
                <td style="background:#2c3e50;color:#fff;padding:20px;text-align:center;">
                  <h2 style="margin:0;">BIMCDE Notification</h2>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding:30px;">
                  ${content}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f4f6f8;text-align:center;padding:15px;font-size:12px;color:#999;">
                  © ${new Date().getFullYear()} BIMCDE. All rights reserved.
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};
