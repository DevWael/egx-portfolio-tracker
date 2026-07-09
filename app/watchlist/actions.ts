"use server";
import { revalidatePath } from "next/cache";
import { getSecurity, upsertSecurity, addAlert, setAlertActive, deleteAlert } from "../../lib/core/index.js";
import { getDb } from "@/lib/db";
import { toPiasters, normalizeTicker } from "@/lib/format";

export async function createAlert(formData: FormData) {
  const db = getDb();
  const ticker = normalizeTicker(String(formData.get("ticker") || ""));
  if (!ticker) return;
  if (!getSecurity(db, ticker)) {
    upsertSecurity(db, { ticker, name: ticker, sector: null, currency: "EGP" });
  }
  addAlert(db, {
    ticker,
    targetPrice: toPiasters(String(formData.get("target") || "0")),
    direction: formData.get("direction") === "below" ? "below" : "above",
    note: String(formData.get("note") || "").trim() || null,
  });
  revalidatePath("/watchlist");
}

export async function toggleAlert(formData: FormData) {
  setAlertActive(getDb(), parseInt(String(formData.get("id")), 10), formData.get("active") === "1");
  revalidatePath("/watchlist");
}

export async function removeAlert(formData: FormData) {
  deleteAlert(getDb(), parseInt(String(formData.get("id")), 10));
  revalidatePath("/watchlist");
}
