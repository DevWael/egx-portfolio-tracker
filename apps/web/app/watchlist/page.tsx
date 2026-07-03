import { data } from "@/lib/data";
import { egp } from "@/lib/format";
import { createAlert, toggleAlert, removeAlert } from "./actions";

export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  const alerts = data.alerts();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <h1>Watchlist</h1>
      <form action={createAlert} className="panel row">
        <label>Ticker<input name="ticker" placeholder="COMI.EGX" required /></label>
        <label>Direction<select name="direction"><option value="above">Above</option><option value="below">Below</option></select></label>
        <label>Target (EGP)<input name="target" type="number" step="0.01" min="0" required /></label>
        <label>Note<input name="note" /></label>
        <button className="btn" type="submit">Add alert</button>
      </form>
      <div className="panel overflow-x">
        <table>
          <thead><tr><th>Ticker</th><th>Direction</th><th>Target</th><th>Status</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr><td colSpan={6} className="dim">No alerts yet.</td></tr>
            ) : alerts.map((a) => (
              <tr key={a.id}>
                <td>{a.ticker}</td><td>{a.direction}</td><td>{egp(a.targetPrice)}</td>
                <td>{a.triggeredAt ? <span className="gain">crossed {a.triggeredAt}</span> : a.active ? "watching" : <span className="dim">inactive</span>}</td>
                <td className="dim">{a.note ?? ""}</td>
                <td className="row" style={{ gap: 6 }}>
                  <form action={toggleAlert}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="active" value={a.active ? "0" : "1"} /><button className="btn secondary" type="submit">{a.active ? "Disable" : "Enable"}</button></form>
                  <form action={removeAlert}><input type="hidden" name="id" value={a.id} /><button className="btn secondary" type="submit">Delete</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
