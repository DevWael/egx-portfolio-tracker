import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { data } from "@/lib/data";

export const metadata: Metadata = { title: "EGX Folio", description: "EGX portfolio tracker" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  data.evaluate(); // keep alert statuses fresh on every load
  const badge = data.alerts().filter((a) => a.triggeredAt).length;
  const asOf = data.summary().asOf;
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="shell">
          <Sidebar watchlistBadge={badge} />
          <div className="main">
            <Topbar asOf={asOf} />
            <div className="content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
