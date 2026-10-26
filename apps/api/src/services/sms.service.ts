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
      if (url.endsWith("/api/3rdparty/v1")) {
        url = `${url}/messages`;
      } else if (url.endsWith("/3rdparty/v1")) {
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

      // Normalize phone to strict E.164 (+<digits>)
      let cleanPhone = options.recipientPhone.trim().replace(/[^\d+]/g, "");
      if (!cleanPhone.startsWith("+")) {
        cleanPhone = `+${cleanPhone}`;
      }

      // Modern SMS-Gateway spec uses textMessage.text.
      // Mutual exclusivity is strictly enforced by SMS-Gateway; sending both 'message' and 'textMessage' returns HTTP 400.
      const payload: Record<string, unknown> = {
        textMessage: {
          text: options.message,
        },
        phoneNumbers: [cleanPhone],
        priority: 100, // Priority 100 bypasses queue wait and carrier throttle limits
        withDeliveryReport: true,
      };

      console.log(`[SmsService] Dispatching auto-SMS to ${endpoint} for ${cleanPhone}...`);

      const fetchFn = (globalThis as unknown as {
        fetch: (url: string, init?: unknown) => Promise<{
          ok: boolean;
          status: number;
          text: () => Promise<string>;
          json: () => Promise<unknown>;
        }>;
      }).fetch;

      let res = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(payload),
      });

      let activeEndpoint = endpoint;

      // If 404, try alternative path (e.g. /3rdparty/v1/messages vs /api/3rdparty/v1/messages)
      if (res.status === 404) {
        let altEndpoint: string | null = null;
        if (endpoint.includes("/api/3rdparty/v1/messages")) {
          altEndpoint = endpoint.replace("/api/3rdparty/v1/messages", "/3rdparty/v1/messages");
        } else if (endpoint.includes("/3rdparty/v1/messages")) {
          altEndpoint = endpoint.replace("/3rdparty/v1/messages", "/api/3rdparty/v1/messages");
        }

        if (altEndpoint) {
          console.log(`[SmsService] Endpoint 404 on ${endpoint}, trying alternate ${altEndpoint}...`);
          activeEndpoint = altEndpoint;
          res = await fetchFn(activeEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${auth}`,
            },
            body: JSON.stringify(payload),
          });
        }
      }

      // If 400, retry with legacy payload format in case an older gateway only supports 'message'
      if (res.status === 400) {
        const legacyPayload = {
          message: options.message,
          phoneNumbers: [cleanPhone],
          priority: 100,
          withDeliveryReport: true,
        };
        const retryRes = await fetchFn(activeEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify(legacyPayload),
        });
        if (retryRes.ok) {
          res = retryRes;
        }
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[SmsService] Gateway HTTP ${res.status}:`, errText);
        return { success: false, error: `Gateway status ${res.status}: ${errText}` };
      }

      const data = (await res.json().catch(() => ({}))) as { id?: string };
      console.log(`[SmsService] Successfully enqueued SMS to ${cleanPhone}, id:`, data.id || "enqueued");
      return { success: true, messageId: data.id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[SmsService] Failed to send SMS:", msg);
      return { success: false, error: msg };
    }
  }
}
