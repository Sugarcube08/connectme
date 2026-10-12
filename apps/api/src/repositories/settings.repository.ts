import { prisma } from "@connectme/database";
import { AppSettings } from "@connectme/contracts";

export class SettingsRepository {
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
