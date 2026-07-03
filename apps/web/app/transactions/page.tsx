import { data } from "@/lib/data";
import { egp } from "@/lib/format";
import { createTransaction, removeTransaction } from "./actions";

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  const txns = data.transactions();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <h1>Transactions</h1>
      <form action={createTransaction} className="panel row">
        <label>Ticker<input name="ticker" placeholder="COMI.EGX" required /></label>
        <label>Name<input name="name" placeholder="Commercial International Bank" /></label>
        <label>Sector<input name="sector" placeholder="Banks" /></label>
        <label>Side<select name="side"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
        <label>Qty<input name="qty" type="number" min="1" required /></label>
        <label>Price (EGP)<input name="price" type="number" step="0.01" min="0" required /></label>
        <label>Fee (EGP)<input name="fee" type="number" step="0.01" min="0" defaultValue="0" /></label>
        <label>Date<input name="tradedAt" type="date" /></label>
        <label>Note<input name="note" /></label>
        <button className="btn" type="submit">Add</button>
      </form>
      <div className="panel overflow-x">
        <table>
          <thead><tr><th>Date</th><th>Ticker</th><th>Side</th><th>Qty</th><th>Price</th><th>Fee</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {txns.length === 0 ? (
              <tr><td colSpan={8} className="dim">No transactions yet.</td></tr>
            ) : txns.map((t) => (
              <tr key={t.id}>
                <td>{t.tradedAt}</td><td>{t.ticker}</td>
                <td className={t.side === "buy" ? "gain" : "loss"}>{t.side}</td>
                <td>{t.qty.toLocaleString()}</td><td>{egp(t.price)}</td><td>{egp(t.fee)}</td>
                <td className="dim">{t.note ?? ""}</td>
                <td><form action={removeTransaction}><input type="hidden" name="id" value={t.id} /><button className="btn secondary" type="submit">Delete</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
