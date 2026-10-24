export interface SmsVariables {
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  organization?: string | null;
  role?: string | null;
  adminName?: string | null;
  adminPhone?: string | null;
  adminEmail?: string | null;
}

export function renderSmsTemplate(template: string, vars: SmsVariables): string {
  let text = template;
  text = text.replace(/\{\{\s*fullName\s*\}\}/gi, vars.fullName || "");
  text = text.replace(/\{\{\s*phoneNumber\s*\}\}/gi, vars.phoneNumber || "");
  text = text.replace(/\{\{\s*email\s*\}\}/gi, vars.email || "");
  text = text.replace(/\{\{\s*organization\s*\}\}/gi, vars.organization || "");
  text = text.replace(/\{\{\s*role\s*\}\}/gi, vars.role || "");
  text = text.replace(/\{\{\s*(adminName|displayName)\s*\}\}/gi, vars.adminName || "");
  text = text.replace(/\{\{\s*adminPhone\s*\}\}/gi, vars.adminPhone || "");
  text = text.replace(/\{\{\s*adminEmail\s*\}\}/gi, vars.adminEmail || "");
  return text.trim();
}

export const DEFAULT_SMS_TEMPLATE =
  "Hi {{fullName}}, thanks for connecting! Here are my contact details: {{adminName}} | Phone: {{adminPhone}} | Email: {{adminEmail}}. Looking forward to staying in touch!";

export class SmsService {
  /**
   * Normalizes gateway URL to target the messages endpoint.
   */
  private normalizeGatewayUrl(rawUrl: string): string {
    let url = rawUrl.trim().replace(/\/+$/, "");
    if (!url.endsWith("/messages") && !url.endsWith("/message")) {
      if (url.endsWith("/3rdparty/v1")) {
        url = `${url}/messages`;
      } else if (url.endsWith("/api")) {
        url = `${url}/3rdparty/v1/messages`;
      } else {
        url = `${url}/api/3rdparty/v1/messages`;
      }
    }
    return url;
  }

  async sendContactSms(options: {
    gatewayUrl: string;
    username: string;
    password: string;
    recipientPhone: string;
    message: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const endpoint = this.normalizeGatewayUrl(options.gatewayUrl);
      const auth = Buffer.from(`${options.username}:${options.password}`).toString("base64");

      const payload = {
        message: options.message,
        phoneNumbers: [options.recipientPhone],
        priority: 100, // Priority 100 bypasses queue wait and carrier throttle limits
        withDeliveryReport: true,
      };

      const fetchFn = (globalThis as unknown as {
        fetch: (url: string, init?: unknown) => Promise<{
          ok: boolean;
          status: number;
          text: () => Promise<string>;
          json: () => Promise<unknown>;
        }>;
      }).fetch;

      const res = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[SmsService] Gateway HTTP ${res.status}:`, errText);
        return { success: false, error: `Gateway status ${res.status}: ${errText}` };
      }

      const data = (await res.json()) as { id?: string };
      console.log(`[SmsService] Successfully enqueued SMS to ${options.recipientPhone}, id:`, data.id);
      return { success: true, messageId: data.id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[SmsService] Failed to send SMS:", msg);
      return { success: false, error: msg };
    }
  }
}
