import type { SectorSlice } from "@/lib/metrics";

const R = 52;
const C = 2 * Math.PI * R;

export function AllocationDonut({ allocation }: { allocation: SectorSlice[] }) {
  let offset = 0;
  return (
    <div className="panel panel-pad">
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Allocation by sector</div>
      {allocation.length === 0 ? (
        <div className="empty">No priced holdings yet.</div>
      ) : (
        <>
          <div style={{ display: "grid", placeItems: "center", padding: "8px 0" }}>
            <svg width="150" height="150" viewBox="0 0 130 130">
              <circle cx="65" cy="65" r={R} fill="none" stroke="var(--panel-2)" strokeWidth="15" />
              {allocation.map((s) => {
                const len = s.pct * C;
                const dash = `${len} ${C - len}`;
                const el = (
                  <circle
                    key={s.sector}
                    cx="65" cy="65" r={R} fill="none"
                    stroke={s.color} strokeWidth="15"
                    strokeDasharray={dash} strokeDashoffset={-offset}
                    transform="rotate(-90 65 65)"
                  />
                );
                offset += len;
                return el;
              })}
              <text x="65" y="61" textAnchor="middle" fill="var(--label)" fontSize="10" letterSpacing="1">TOTAL</text>
              <text x="65" y="76" textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="700">
                {allocation.length} sector{allocation.length === 1 ? "" : "s"}
              </text>
            </svg>
          </div>
          <div className="legend">
            {allocation.map((s) => (
              <div className="row" key={s.sector}>
                <span className="dot" style={{ background: s.color }} />
                {s.sector}
                <span className="pctv">{(s.pct * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
