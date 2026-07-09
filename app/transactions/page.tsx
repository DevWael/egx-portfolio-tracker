import { data } from "@/lib/data";
import { egp } from "@/lib/format";
import { createTransaction, removeTransaction } from "./actions";

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  const txns = data.transactions();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <div className="page-title">Transactions</div>
        <div className="page-sub">Your buy/sell ledger — holdings and P&amp;L are derived from these.</div>
      </div>
      <form action={createTransaction} className="panel panel-pad formcard">
        <label className="field">Ticker<input name="ticker" placeholder="COMI" required /></label>
        <label className="field">Side<select name="side"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
        <label className="field">Qty<input name="qty" type="number" min="1" required /></label>
        <label className="field">Price (EGP)<input name="price" type="number" step="0.01" min="0" required /></label>
        <label className="field">Fee (EGP)<input name="fee" type="number" step="0.01" min="0" defaultValue="0" /></label>
        <label className="field">Date<input name="tradedAt" type="date" /></label>
        <label className="field field-wide">Note<input name="note" /></label>
        <button className="btn primary" type="submit">Add transaction</button>
      </form>
      <div className="panel">
        <div className="panel-head">Ledger <span className="hint">{txns.length} entr{txns.length === 1 ? "y" : "ies"}</span></div>
        <div className="overflow-x">
          <table>
            <thead><tr><th>Date</th><th>Ticker</th><th>Side</th><th>Qty</th><th>Price</th><th>Fee</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {txns.length === 0 ? (
                <tr><td colSpan={8} className="empty">No transactions yet.</td></tr>
              ) : txns.map((t) => (
                <tr key={t.id}>
                  <td>{t.tradedAt}</td><td>{t.ticker}</td>
                  <td><span className={`tag ${t.side === "buy" ? "crossed" : "off"}`}>{t.side}</span></td>
                  <td>{t.qty.toLocaleString()}</td><td>{egp(t.price)}</td><td>{egp(t.fee)}</td>
                  <td className="dim" style={{ textAlign: "left" }}>{t.note ?? ""}</td>
                  <td><form action={removeTransaction}><input type="hidden" name="id" value={t.id} /><button className="btn" type="submit">Delete</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
