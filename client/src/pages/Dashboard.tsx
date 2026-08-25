import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar, ComposedChart, Line,
} from "recharts";
import { api } from "../api";
import { useAuth } from "../App";
import type { Stats } from "../types";

const PIE_COLORS = ["#8b5cf6", "#d946ef", "#a78bfa", "#f0abfc", "#7c3aed", "#c084fc"];

interface PackageInfo {
  packages: { tier: string; label: string; price_cents: number }[];
  current: { name: string; plan_tier: string; plan_price_cents: number; package_status: string };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState<12 | 6 | 3>(12);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pkg, setPkg] = useState<PackageInfo | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s] = await Promise.all([api<Stats>(`/dashboard/stats?range=${range}`)]);
    setStats(s);
    if (user?.role === "municipality") setPkg(await api<PackageInfo>("/dashboard/package"));
  }, [range, user]);

  useEffect(() => { load().catch(console.error); }, [load]);

  const subscribe = async (tier: "essential" | "premium") => {
    setBusy(true);
    try {
      const res = await api<{ message: string }>("/dashboard/package/subscribe", { method: "POST", body: { tier } });
      setMsg(res.message);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!stats) return <div className="container" style={{ color: "var(--muted)" }}>Loading dashboard…</div>;

  const k = stats.kpis;
  return (
    <div className="container">
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1>Municipal heritage dashboard</h1>
          <p>
            Real-time impact of your Cultory digitization package — stories collected,
            tourist engagement and revenue flowing back to local guides.
          </p>
        </div>
        <div className="range-picker">
          {[3, 6, 12].map((r) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r as any)}>
              {r} months
            </button>
          ))}
        </div>
      </div>

      {msg && <div className="success-box">{msg}</div>}

      <div className="kpi-grid">
        <div className="glass kpi"><div className="kpi-label">Stories digitized</div><div className="kpi-value">{k.stories_total}</div><div className="kpi-sub">geotagged & translated</div></div>
        <div className="glass kpi"><div className="kpi-label">Tourists · 30 days</div><div className="kpi-value">{k.tourists_30d.toLocaleString()}</div><div className="kpi-sub">paid tour participants</div></div>
        <div className="glass kpi"><div className="kpi-label">Revenue YTD</div><div className="kpi-value">€{k.revenue_ytd_eur.toLocaleString()}</div><div className="kpi-sub">gross bookings</div></div>
        <div className="glass kpi"><div className="kpi-label">Platform fees</div><div className="kpi-value">€{k.platform_fees_eur.toLocaleString()}</div><div className="kpi-sub">Cultory share (25%)</div></div>
        <div className="glass kpi"><div className="kpi-label">Certified guides</div><div className="kpi-value">{k.certified_guides}</div><div className="kpi-sub">{k.tours_total} active itineraries</div></div>
      </div>

      <div className="grid-2">
        <div className="glass">
          <div className="chart-title">Tourist footfall</div>
          <div className="chart-sub">Paid participants per month</div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.footfall}>
                <defs>
                  <linearGradient id="gradTourists" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d946ef" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#d946ef" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" stroke="rgba(243,240,255,.5)" fontSize={12} />
                <YAxis stroke="rgba(243,240,255,.5)" fontSize={12} />
                <Tooltip contentStyle={{ background: "#231258ee", border: "1px solid rgba(167,139,250,.4)", borderRadius: 12, color: "#f3f0ff" }} />
                <Area type="monotone" dataKey="tourists" name="Tourists" stroke="#e879f9" strokeWidth={2.5} fill="url(#gradTourists)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass">
          <div className="chart-title">Audience demographics</div>
          <div className="chart-sub">Participants by age group</div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.demographics} dataKey="value" nameKey="age_group"
                  innerRadius={52} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                  {stats.demographics.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#231258ee", border: "1px solid rgba(167,139,250,.4)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <h2 className="section-title">📈 Revenue & visitor origins</h2>
      <div className="grid-half">
        <div className="glass">
          <div className="chart-title">Gross bookings vs platform fee</div>
          <div className="chart-sub">EUR per month</div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.footfall}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" stroke="rgba(243,240,255,.5)" fontSize={12} />
                <YAxis stroke="rgba(243,240,255,.5)" fontSize={12} />
                <Tooltip contentStyle={{ background: "#231258ee", border: "1px solid rgba(167,139,250,.4)", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue_eur" name="Gross €" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                <Line dataKey="platform_fee_eur" name="Cultory fee €" stroke="#f0abfc" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass">
          <div className="chart-title">Top visiting countries</div>
          <div className="chart-sub">Participants all-time</div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topCountries} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="country" stroke="rgba(243,240,255,.7)" fontSize={12} width={40} />
                <Tooltip contentStyle={{ background: "#231258ee", border: "1px solid rgba(167,139,250,.4)", borderRadius: 12 }} />
                <Bar dataKey="value" name="Tourists" fill="#d946ef" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {pkg && (
        <>
          <h2 className="section-title">🏛️ Heritage Digitization Package</h2>
          <div className="grid-half">
            <div className="glass card">
              <p style={{ color: "var(--muted)", fontSize: 13, textTransform: "uppercase", fontWeight: 700 }}>Current status</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0 4px" }}>
                <span style={{ fontSize: 26, fontWeight: 800 }}>{pkg.current.name}</span>
                {pkg.current.package_status === "active"
                  ? <span className="badge green">{pkg.current.plan_tier.toUpperCase()} · ACTIVE</span>
                  : <span className="badge red">NO PACKAGE</span>}
              </div>
              <p style={{ color: "var(--muted)", fontSize: 14 }}>
                {pkg.current.package_status === "active"
                  ? `Billed at €${(pkg.current.plan_price_cents / 100).toLocaleString()} per year — includes AI interviews, dashboards and API access for your region.`
                  : "Activate a digitization package to unlock AI elder-interviews at scale and this analytics dashboard."}
              </p>
            </div>
            <div className="glass card">
              <p style={{ color: "var(--muted)", fontSize: 13, textTransform: "uppercase", fontWeight: 700 }}>Upgrade / renew</p>
              {pkg.packages.map((p) => (
                <div key={p.tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                  <div>
                    <b>{p.label}</b>
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>
                      {p.tier === "essential" ? "Up to 50 elder interviews · core dashboard" : "Unlimited interviews · premium analytics · API included"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tier-price">€{(p.price_cents / 100000).toLocaleString()}</div>
                    <button className="btn btn-primary" disabled={busy} onClick={() => subscribe(p.tier as any)} style={{ marginTop: 6, padding: "8px 16px" }}>
                      Activate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
