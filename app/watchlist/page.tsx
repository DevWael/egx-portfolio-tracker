import { data } from "@/lib/data";
import { egp } from "@/lib/format";
import { createAlert, toggleAlert, removeAlert } from "./actions";

export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  data.evaluate(); // stamp any alerts crossed at the latest close before listing
  const alerts = data.alerts();
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div>
        <div className="page-title">Watchlist</div>
        <div className="page-sub">Price-target alerts, evaluated against the latest close.</div>
      </div>
      <form action={createAlert} className="panel panel-pad formcard">
        <label className="field">Ticker<input name="ticker" placeholder="COMI" required /></label>
        <label className="field">Direction<select name="direction"><option value="above">Above</option><option value="below">Below</option></select></label>
        <label className="field">Target (EGP)<input name="target" type="number" step="0.01" min="0" required /></label>
        <label className="field">Note<input name="note" /></label>
        <button className="btn primary" type="submit">Add alert</button>
      </form>
      <div className="panel">
        <div className="panel-head">Alerts <span className="hint">{alerts.length} total</span></div>
        <div className="overflow-x">
          <table>
            <thead><tr><th>Ticker</th><th>Direction</th><th>Target</th><th>Status</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr><td colSpan={6} className="empty">No alerts yet.</td></tr>
              ) : alerts.map((a) => (
                <tr key={a.id}>
                  <td>{a.ticker}</td>
                  <td>{a.direction}</td>
                  <td>{egp(a.targetPrice)}</td>
                  <td>
                    {a.triggeredAt
                      ? <span className="tag crossed">crossed {a.triggeredAt}</span>
                      : a.active
                        ? <span className="tag watch">watching</span>
                        : <span className="tag off">inactive</span>}
                  </td>
                  <td className="dim" style={{ textAlign: "left" }}>{a.note ?? ""}</td>
                  <td>
                    <div className="row-flex" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <form action={toggleAlert}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="active" value={a.active ? "0" : "1"} /><button className="btn" type="submit">{a.active ? "Disable" : "Enable"}</button></form>
                      <form action={removeAlert}><input type="hidden" name="id" value={a.id} /><button className="btn" type="submit">Delete</button></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
