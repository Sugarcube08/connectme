import { prisma } from "@connectme/database";
import { AppSettings } from "@connectme/contracts";

export class SettingsRepository {

  async getPublicOrigin(): Promise<string | null> {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "public-origin" },
    });
    const value = setting?.value as { origin?: unknown } | undefined;
    return typeof value?.origin === "string" ? value.origin : null;
  }

  async setPublicOrigin(origin: string): Promise<void> {
    await prisma.appSetting.upsert({
      where: { key: "public-origin" },
      update: { value: { origin } },
      create: { key: "public-origin", value: { origin } },
    });
  }

  async getGeneral(): Promise<AppSettings> {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "general" },
    });

    const defaults: AppSettings = {
      brandName: "Connect Me",
      privacyNotice:
        "Your contact details are shared privately and directly with the owner for professional follow-up. Connect Me never discloses your information publicly.",
      defaultExpiryDays: 30,
    };

    if (!setting) return defaults;
    return { ...defaults, ...(setting.value as any) };
  }

  async updateGeneral(data: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getGeneral();
    const updated = { ...current, ...data };

    await prisma.appSetting.upsert({
      where: { key: "general" },
      update: { value: updated },
      create: { key: "general", value: updated },
    });

    return updated;
  }
}
