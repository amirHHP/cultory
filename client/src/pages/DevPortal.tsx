import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../App";
import { TIER_LABELS, euro, type ApiKeyRow, type Tier } from "../types";

const ENDPOINTS = [
  ["GET", "/api/v1/stories?limit=50&category=folklore", "Geotagged story feed (translated excerpts)"],
  ["GET", "/api/v1/itineraries", "Bookable cultural itineraries with pricing & availability"],
  ["GET", "/api/v1/municipalities", "Coverage list with per-region story counts"],
];

export default function DevPortal() {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftTier, setDraftTier] = useState("starter");
  const [draftLabel, setDraftLabel] = useState("Production");
  const [tryKey, setTryKey] = useState("");
  const [tryResult, setTryResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setTiers((await api<{ tiers: Tier[] }>("/dev/tiers")).tiers);
    try {
      setKeys((await api<{ keys: ApiKeyRow[] }>("/dev/keys")).keys);
    } catch {
      /* enterprise-only endpoint for key listing */
    }
  }, [user]);

  useEffect(() => { load().catch(console.error); }, [load]);

  const createKey = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ api_key: string }>("/dev/keys", {
        method: "POST",
        body: { tier: draftTier, label: draftLabel || "Production" },
      });
      setNewKey(res.api_key);
      setTryKey(res.api_key);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await api(`/dev/keys/${id}`, { method: "DELETE" });
    await load();
  };

  const testKey = async () => {
    setTryResult(null);
    try {
      const res = await fetch("/api/v1/stories?limit=3", { headers: { "X-API-Key": tryKey.trim() } });
      const json = await res.json();
      setTryResult(JSON.stringify(json, null, 2).slice(0, 1200));
    } catch (e: any) {
      setTryResult(String(e));
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <h1>Developer Portal</h1>
        <p>
          License Cultory's structured heritage dataset for your booking platform or hotel app.
          REST + JSON, geotagged stories, itineraries and coverage data — authenticated with API keys.
        </p>
      </div>

      <h2 className="section-title">💳 Subscription tiers</h2>
      <div className="pillar-grid" style={{ marginTop: 0 }}>
        {(tiers.length ? tiers : []).map((t, i) => (
          <div key={t.id} className={`glass card card-hover ${t.id === "growth" ? "" : ""}`} style={t.id === "growth" ? { borderColor: "rgba(167,139,250,.5)" } : undefined}>
            {i === 1 && <span className="badge accent">MOST POPULAR</span>}
            <h3 style={{ marginTop: i === 1 ? 10 : 0 }}>{TIER_LABELS[t.id] ?? t.label}</h3>
            <div className="tier-price" style={{ margin: "8px 0" }}>
              {euro(t.price_cents)}<small> / month</small>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 13.5 }}>{t.calls.toLocaleString()} API calls included</p>
            <ul className="feature-list">
              {t.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
        ))}
        {!user && <div className="glass card"><p style={{ color: "var(--muted)" }}>Sign in with an enterprise account to subscribe and generate keys.</p></div>}
      </div>

      <div className="grid-2" style={{ marginTop: 34 }}>
        <div className="glass card">
          <h3 style={{ marginBottom: 12 }}>🔑 Your API keys</h3>
          {!user && <p style={{ color: "var(--muted)" }}>Sign in as an enterprise partner to manage keys.</p>}
          {user && !["enterprise", "super_admin"].includes(user.role) && (
            <p style={{ color: "var(--muted)" }}>
              Key management requires an enterprise account. You are signed in as <b>{user.role}</b>.
            </p>
          )}
          {["enterprise", "super_admin"].includes(user?.role ?? "") && (
            <>
              <div className="filter-row" style={{ marginBottom: 14 }}>
                <input className="input mono" style={{ maxWidth: 220 }} value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)} placeholder="Key label" />
                <select className="input" style={{ maxWidth: 150 }} value={draftTier} onChange={(e) => setDraftTier(e.target.value)}>
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="scale">Scale</option>
                </select>
                <button className="btn btn-primary" onClick={createKey} disabled={busy}>Generate key</button>
              </div>
              {newKey && (
                <div className="key-reveal" style={{ marginBottom: 16 }}>
                  <b>Your new API key</b> <span style={{ color: "#a7f3d0" }}>(shown once — copy now)</span>
                  <button
                    style={{ float: "right", cursor: "pointer" }}
                    onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); }}
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                  <div className="mono" style={{ marginTop: 8 }}>{newKey}</div>
                </div>
              )}
              <table className="table">
                <thead><tr><th>Prefix</th><th>Tier</th><th>Calls</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id}>
                      <td className="mono">{k.key_prefix}…</td>
                      <td>{TIER_LABELS[k.tier] ?? k.tier}</td>
                      <td>{k.request_count.toLocaleString()}</td>
                      <td>{k.status === "active" ? <span className="badge green">active</span> : <span className="badge red">revoked</span>}</td>
                      <td style={{ textAlign: "right" }}>
                        {k.status === "active" && (
                          <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={() => revoke(k.id)}>
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {keys.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No keys yet.</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="glass card">
          <h3 style={{ marginBottom: 12 }}>🚀 Quick start</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 10 }}>
            Authenticate with either header: <span className="mono">X-API-Key</span> or <span className="mono">Authorization: Bearer cul_live_…</span>
          </p>
          <div className="codeblock">{`curl "https://api.cultory.eu/v1/stories?limit=20" \\
  -H "X-API-Key: cul_live_YOUR_KEY"`}</div>
          <table className="table" style={{ marginTop: 14 }}>
            <tbody>
              {ENDPOINTS.map(([m, path, desc]) => (
                <tr key={path}>
                  <td><span className="badge accent">{m}</span></td>
                  <td><span className="mono">{path}</span><br /><span style={{ color: "var(--muted)", fontSize: 13 }}>{desc}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <div className="error-box" style={{ marginTop: 14 }}>{error}</div>}
        </div>
      </div>

      <h2 className="section-title">🧪 Test your key against the live sandbox</h2>
      <div className="glass card">
        <div className="filter-row">
          <input className="input mono" style={{ flex: 2, minWidth: 260 }} value={tryKey}
            onChange={(e) => setTryKey(e.target.value)} placeholder="cul_live_…" />
          <button className="btn btn-primary" disabled={!tryKey.startsWith("cul_")} onClick={testKey}>
            Send request → /v1/stories?limit=3
          </button>
        </div>
        {tryResult && <div className="codeblock" style={{ marginTop: 8 }}>{tryResult}</div>}
      </div>
    </div>
  );
}
