import nodemailer from "nodemailer";
import crypto from "crypto";

export interface SendOtpOptions {
  to: string;
  otp: string;
  recipientName?: string;
}

export class EmailService {
  // Static registry for inspection in automated tests
  public static lastSentEmail: { to: string; otp: string; timestamp: Date } | null = null;

  public isOtpVerificationEnabled(): boolean {
    const val = (process.env.OTP_VERIFICATION || "").trim().toLowerCase();
    return val === "true" || val === "1" || val === "yes";
  }

  public generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private getTransporter() {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const secure = process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1"
      : port === 465;

    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  /**
   * Generates a proper, luxury dark-themed email template for the OTP verification code.
   */
  private renderOtpEmailHtml(otp: string, recipientName?: string): string {
    const greeting = recipientName ? `Hello <strong>${recipientName}</strong>,` : "Hello,";
    const currentYear = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Connect Me Verification Code</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0b0f19;
      padding: 40px 10px;
    }
    .main {
      background-color: #111827;
      margin: 0 auto;
      width: 100%;
      max-width: 560px;
      border-radius: 16px;
      border: 1px solid #1f293d;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
      overflow: hidden;
    }
    .banner-accent {
      height: 4px;
      background: linear-gradient(90deg, #7c3aed 0%, #a855f7 40%, #e2b150 100%);
    }
    .header {
      padding: 32px 32px 20px 32px;
      text-align: center;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #ffffff;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-tag {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(226, 177, 80, 0.12);
      border: 1px solid rgba(226, 177, 80, 0.3);
      font-size: 11px;
      font-weight: 600;
      color: #e2b150;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .content {
      padding: 20px 36px 36px 36px;
    }
    .lead-text {
      font-size: 15px;
      line-height: 24px;
      color: #94a3b8;
      margin: 0 0 20px 0;
    }
    .otp-container {
      background-color: #090d16;
      border: 1px solid #1e293b;
      border-radius: 14px;
      padding: 24px 16px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 12px;
      color: #fbbf24;
      margin: 0;
      padding-left: 12px; /* balance letter-spacing */
    }
    .otp-expiry {
      margin-top: 10px;
      font-size: 12px;
      color: #64748b;
      letter-spacing: 0.3px;
    }
    .info-card {
      background: rgba(30, 41, 59, 0.4);
      border-left: 3px solid #7c3aed;
      border-radius: 0 8px 8px 0;
      padding: 12px 16px;
      margin: 24px 0 16px 0;
    }
    .info-text {
      font-size: 12px;
      line-height: 18px;
      color: #cbd5e1;
      margin: 0;
    }
    .security-note {
      font-size: 12px;
      line-height: 18px;
      color: #64748b;
      margin: 16px 0 0 0;
    }
    .footer {
      background-color: #0d121d;
      border-top: 1px solid #1e293b;
      padding: 24px 32px;
      text-align: center;
    }
    .footer-text {
      font-size: 11px;
      line-height: 16px;
      color: #475569;
      margin: 0;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 20px 24px 28px 24px;
      }
      .otp-code {
        font-size: 32px;
        letter-spacing: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" width="100%" cellpadding="0" cellspacing="0" align="center">
      <tr>
        <td class="banner-accent"></td>
      </tr>
      <tr>
        <td class="header">
          <h1 class="brand-title">Connect Me</h1>
          <span class="brand-tag">Security Verification</span>
        </td>
      </tr>
      <tr>
        <td class="content">
          <p class="lead-text">${greeting}</p>
          <p class="lead-text">
            You recently initiated registration for an administrator account on <strong>Connect Me</strong>. Please enter the verification code below to verify your email address and activate your account:
          </p>
          
          <div class="otp-container">
            <div class="otp-code">${otp}</div>
            <div class="otp-expiry">Valid for the next 10 minutes</div>
          </div>

          <div class="info-card">
            <p class="info-text">
              🔒 <strong>Security Tip:</strong> Connect Me representatives will never ask for your verification code. Never share this code with anyone.
            </p>
          </div>

          <p class="security-note">
            If you did not make this request, you can safely disregard this email. Your email address will not be registered without entering this code.
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p class="footer-text">
            &copy; ${currentYear} Connect Me. Unified Digital Business Cards &amp; Contact Exchange.<br>
            Automated security dispatch &bull; Please do not reply directly to this email.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
  }

  /**
   * Generates the plain text alternative for clients that do not render HTML.
   */
  private renderOtpEmailText(otp: string, recipientName?: string): string {
    const greeting = recipientName ? `Hello ${recipientName},` : "Hello,";
    return `${greeting}\n\n` +
      `Your Connect Me verification code is: ${otp}\n\n` +
      `This code will expire in 10 minutes.\n\n` +
      `If you did not request this verification code, please ignore this email.\n\n` +
      `Connect Me Security Team`;
  }

  /**
   * Sends the OTP email via Gmail / SMTP protocol.
   */
  async sendOtpEmail(options: SendOtpOptions): Promise<boolean> {
    const { to, otp, recipientName } = options;
    const cleanTo = to.trim().toLowerCase();

    // Record for tests
    EmailService.lastSentEmail = {
      to: cleanTo,
      otp,
      timestamp: new Date(),
    };

    const isTest = process.env.NODE_ENV === "test";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // In automated testing environments or if unconfigured in dev without credentials
    if (isTest || (!user && process.env.NODE_ENV === "development")) {
      console.log(`[EmailService] (Local/Test Mode) Verification OTP for ${cleanTo}: ${otp}`);
      return true;
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      console.warn(`[EmailService] SMTP credentials missing (SMTP_USER / SMTP_PASS). Cannot dispatch live email to ${cleanTo}.`);
      return false;
    }

    const fromAddress = process.env.SMTP_FROM || `"Connect Me" <${user}>`;

    try {
      await transporter.sendMail({
        from: fromAddress,
        to: cleanTo,
        subject: `Your Connect Me Verification Code: ${otp}`,
        text: this.renderOtpEmailText(otp, recipientName),
        html: this.renderOtpEmailHtml(otp, recipientName),
      });

      console.log(`[EmailService] Verification OTP successfully dispatched to ${cleanTo}`);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[EmailService] Failed to send verification email to ${cleanTo}:`, msg);
      throw new Error(`Failed to dispatch verification email: ${msg}`);
    }
  }
}
