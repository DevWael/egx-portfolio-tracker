"use client";
import { useRef, useState } from "react";
import { egp, pct } from "@/lib/format";
import type { SparkPoint } from "@/lib/metrics";

function fmtDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const RANGES: [string, number | null][] = [["1M", 30], ["3M", 90], ["6M", 180], ["1Y", 365], ["Max", null]];

function Area({ points, up, id, height, onZoom, onReset }: {
  points: SparkPoint[]; up: boolean; id: string; height: number;
  onZoom: (a: number, b: number) => void; onReset: () => void;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  if (points.length < 2) return <div className="dim" style={{ fontSize: 13, padding: "24px 0" }}>Not enough price history yet.</div>;

  const values = points.map((p) => p.close);
  const W = 640, H = height, pad = 8;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const X = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const Y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const line = values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = `M ${X(0).toFixed(1)},${H} L ` + values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L ") + ` L ${X(values.length - 1).toFixed(1)},${H} Z`;
  const color = up ? "var(--green)" : "var(--red)";
  const gid = `grad-${id}`;

  const idx = (e: React.MouseEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    return Math.round(f * (values.length - 1));
  };
  const onDown = (e: React.MouseEvent) => { const i = idx(e); setDragStart(i); setDragEnd(i); setHi(null); };
  const onMove = (e: React.MouseEvent) => { const i = idx(e); if (dragStart != null) setDragEnd(i); else setHi(i); };
  const onUp = () => { if (dragStart != null && dragEnd != null) { const a = Math.min(dragStart, dragEnd), b = Math.max(dragStart, dragEnd); if (b - a >= 2) onZoom(a, b); } setDragStart(null); setDragEnd(null); };
  const onLeave = () => { setHi(null); setDragStart(null); setDragEnd(null); };

  const dragging = dragStart != null && dragEnd != null && dragStart !== dragEnd;
  const a = dragging ? Math.min(dragStart!, dragEnd!) : 0;
  const b = dragging ? Math.max(dragStart!, dragEnd!) : 0;
  const dot = !dragging && hi != null ? { xPct: (X(hi) / W) * 100, yPct: (Y(values[hi]) / H) * 100 } : null;

  return (
    <div ref={wrapRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onLeave} onDoubleClick={onReset} style={{ position: "relative", cursor: "crosshair", userSelect: "none" }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill={`url(#${gid})`} />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {dragging ? <rect x={X(a)} y={0} width={X(b) - X(a)} height={H} fill="var(--accent)" fillOpacity="0.14" stroke="var(--accent)" strokeOpacity="0.4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          : hi != null ? <line x1={X(hi)} y1={0} x2={X(hi)} y2={H} stroke="var(--label)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      {dot ? (
        <>
          <div style={{ position: "absolute", left: `${dot.xPct}%`, top: `${dot.yPct}%`, width: 9, height: 9, marginLeft: -4.5, marginTop: -4.5, borderRadius: "50%", background: color, boxShadow: "0 0 0 3px var(--panel)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", left: `${dot.xPct}%`, top: -4, transform: `translateX(${dot.xPct > 60 ? "-106%" : "6%"})`, background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 9px", fontSize: 12, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 2 }}>
            <span className="muted">{fmtDate(points[hi!].date)}</span> · <b>{egp(values[hi!])}</b>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function PriceChart({ points, id, height = 150 }: { points: SparkPoint[]; id: string; height?: number }) {
  const [win, setWin] = useState<[number, number] | null>(null);
  const s = win ? win[0] : 0;
  const e = win ? win[1] : points.length - 1;
  const pts = points.slice(s, e + 1);
  const first = pts[0]?.close;
  const lastC = pts[pts.length - 1]?.close;
  const chg = pts.length >= 2 && first > 0 ? (lastC - first) / first : null;
  const isFull = !win || (win[0] === 0 && win[1] === points.length - 1);
  const presetActive = (days: number | null) => days === null ? isFull : !!win && win[1] === points.length - 1 && win[0] === Math.max(0, points.length - days);
  const setPreset = (days: number | null) => setWin(days === null ? null : [Math.max(0, points.length - days), points.length - 1]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12 }}>Last {pts.length} day{pts.length === 1 ? "" : "s"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="rng">{RANGES.map(([label, days]) => <button key={label} className={presetActive(days) ? "on" : ""} onClick={() => setPreset(days)}>{label}</button>)}</div>
          {chg !== null ? <span className={chg >= 0 ? "gain" : "loss"} style={{ fontSize: 13, fontWeight: 600 }}>{pct(chg)}</span> : null}
        </div>
      </div>
      <Area points={pts} up={(chg ?? 0) >= 0} id={id} height={height} onZoom={(la, lb) => setWin([s + la, s + lb])} onReset={() => setWin(null)} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>{pts.length >= 1 ? fmtDate(pts[0].date) : ""}</span>
        <span className="muted" style={{ fontSize: 12 }}>{pts.length >= 1 ? `${fmtDate(pts[pts.length - 1].date)} · ${egp(lastC)}` : ""}</span>
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>Drag to zoom · double-click to reset</div>
    </div>
  );
}
