"use server";
import { revalidatePath } from "next/cache";
import { getSecurity, upsertSecurity, addTransaction, deleteTransaction } from "../../lib/core/index.js";
import { getDb } from "@/lib/db";
import { toPiasters, normalizeTicker } from "@/lib/format";

export async function createTransaction(formData: FormData) {
  const db = getDb();
  const ticker = normalizeTicker(String(formData.get("ticker") || ""));
  if (!ticker) return;
  if (!getSecurity(db, ticker)) {
    upsertSecurity(db, { ticker, name: ticker, sector: null, currency: "EGP" });
  }
  addTransaction(db, {
    ticker,
    side: formData.get("side") === "sell" ? "sell" : "buy",
    qty: parseInt(String(formData.get("qty") || "0"), 10),
    price: toPiasters(String(formData.get("price") || "0")),
    fee: toPiasters(String(formData.get("fee") || "0")),
    tradedAt: String(formData.get("tradedAt") || "") || undefined,
    note: String(formData.get("note") || "").trim() || null,
  });
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function removeTransaction(formData: FormData) {
  deleteTransaction(getDb(), parseInt(String(formData.get("id")), 10));
  revalidatePath("/transactions");
  revalidatePath("/");
}
