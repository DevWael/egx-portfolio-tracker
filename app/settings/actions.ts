"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateSettings, type Settings } from "../../lib/core/index.js";

export async function saveSettings(formData: FormData) {
  updateSettings({
    theme: formData.get("theme") as Settings["theme"],
    accentColor: String(formData.get("accentColor")),
    defaultPriceHistoryRange: formData.get("defaultPriceHistoryRange") as Settings["defaultPriceHistoryRange"],
    dateFormat: formData.get("dateFormat") as Settings["dateFormat"],
  });
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}
