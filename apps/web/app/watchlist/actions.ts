"use server";
import { revalidatePath } from "next/cache";
import { upsertSecurity, addAlert, setAlertActive, deleteAlert } from "@egx/core";
import { getDb } from "@/lib/db";
import { toPiasters } from "@/lib/format";

export async function createAlert(formData: FormData) {
  const db = getDb();
  const ticker = String(formData.get("ticker") || "").trim().toUpperCase();
  if (!ticker) return;
  upsertSecurity(db, { ticker, name: ticker, sector: null, currency: "EGP" });
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
