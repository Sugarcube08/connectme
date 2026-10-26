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
   * Cleans gateway URL to obtain the base origin/host without endpoint subpaths.
   */
  private getBaseUrl(rawUrl: string): string {
    let url = rawUrl.trim().replace(/\/+$/, "");
    url = url
      .replace(/\/api\/3rdparty\/v1\/messages$/, "")
      .replace(/\/3rdparty\/v1\/messages$/, "")
      .replace(/\/api\/3rdparty\/v1\/devices$/, "")
      .replace(/\/3rdparty\/v1\/devices$/, "")
      .replace(/\/api\/3rdparty\/v1$/, "")
      .replace(/\/3rdparty\/v1$/, "")
      .replace(/\/messages$/, "")
      .replace(/\/message$/, "")
      .replace(/\/+$/, "");
    return url;
  }

  async sendContactSms(options: {
    gatewayUrl: string;
    username: string;
    password: string;
    recipientPhone: string;
    message: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const fetchFn = (globalThis as unknown as {
      fetch: (url: string, init?: unknown) => Promise<{
        ok: boolean;
        status: number;
        text: () => Promise<string>;
        json: () => Promise<unknown>;
      }>;
    }).fetch;

    try {
      const baseUrl = this.getBaseUrl(options.gatewayUrl);
      const auth = Buffer.from(`${options.username}:${options.password}`).toString("base64");

      // Normalize phone to strict E.164 (+<digits>)
      let cleanPhone = options.recipientPhone.trim().replace(/[^\d+]/g, "");
      if (!cleanPhone.startsWith("+")) {
        cleanPhone = `+${cleanPhone}`;
      }

      // 1. First probe the startup/health endpoint (wakes up free Render instances)
      const healthUrl = `${baseUrl}/health/startup`;
      console.log(`\n[SmsService] [1] Pinging startup endpoint: ${healthUrl}`);
      try {
        const healthResp = await fetchFn(healthUrl, {
          method: "GET",
          signal: AbortSignal.timeout(6000),
        });
        console.log(`[SmsService]     Status: ${healthResp.status}`);
      } catch (e: any) {
        console.log(`[SmsService]     Health check note: ${e?.message || e}`);
      }

      // 2. Check registered devices (confirms your phone is connected)
      const devicesUrl = `${baseUrl}/api/3rdparty/v1/devices`;
      console.log(`[SmsService] [2] Checking online devices: ${devicesUrl}`);
      try {
        let devResp = await fetchFn(devicesUrl, {
          method: "GET",
          headers: { Authorization: `Basic ${auth}` },
          signal: AbortSignal.timeout(5000),
        });
        if (devResp.status === 404) {
          devResp = await fetchFn(`${baseUrl}/3rdparty/v1/devices`, {
            method: "GET",
            headers: { Authorization: `Basic ${auth}` },
            signal: AbortSignal.timeout(5000),
          });
        }
        console.log(`[SmsService]     Device check status: ${devResp.status}`);
      } catch (e: any) {
        console.log(`[SmsService]     Device check note: ${e?.message || e}`);
      }

      // 3. Trigger SMS Dispatch
      const endpoint = `${baseUrl}/api/3rdparty/v1/messages`;
      // Note: Modern SMS Gateway expects 'textMessage: {"text": ...}'.
      // Never provide both 'message' and 'textMessage' together, as the gateway
      // strictly enforces mutual exclusivity and will return 400 conflict fields.
      const payload = {
        textMessage: {
          text: options.message,
        },
        phoneNumbers: [cleanPhone],
        priority: 100,
        withDeliveryReport: true,
      };

      console.log(`[SmsService] [3] Triggering SMS Dispatch:`);
      console.log(`    POST ${endpoint}`);
      console.log(`    Auth: HTTP Basic (${options.username}:****)`);
      console.log(`    Recipient: ${cleanPhone}`);

      let resp = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      // Fallback if server mounts at /3rdparty/v1/messages without /api
      if (resp.status === 404) {
        const altEndpoint = `${baseUrl}/3rdparty/v1/messages`;
        console.log(`[SmsService]     404 received, trying alternate: ${altEndpoint}`);
        resp = await fetchFn(altEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });
      }

      const respText = await resp.text();
      console.log(`[SmsService] [4] Result:`);
      console.log(`    HTTP Status: ${resp.status}`);
      console.log(`    Response Body: ${respText}`);

      if (resp.status === 200 || resp.status === 201 || resp.status === 202) {
        console.log("[SmsService] >>> SUCCESS: Gateway accepted the message for sending!");
        let data: any = {};
        try {
          data = JSON.parse(respText);
        } catch {}
        return { success: true, messageId: data?.id || "enqueued" };
      } else if (resp.status === 401) {
        console.error("[SmsService] >>> FAILED: 401 Unauthorized. Check your username and password.");
        return { success: false, error: "401 Unauthorized. Check username and password." };
      } else if (resp.status === 503) {
        console.error("[SmsService] >>> FAILED: 503 Service Unavailable. Your Android phone is OFFLINE.");
        return { success: false, error: "503 Service Unavailable. Your Android phone is OFFLINE." };
      } else {
        console.error(`[SmsService] >>> FAILED: Gateway returned status ${resp.status}`);
        return { success: false, error: `Gateway returned status ${resp.status}: ${respText}` };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[SmsService] Request error:", msg);
      return { success: false, error: msg };
    }
  }
}
