import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { euro, type Tour } from "../types";

export default function Marketplace() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [region, setRegion] = useState("all");

  useEffect(() => {
    api<{ tours: Tour[] }>("/marketplace/tours").then((r) => setTours(r.tours));
  }, []);

  const regions = useMemo(
    () => Array.from(new Set(tours.map((t) => t.municipality_name))),
    [tours]
  );
  const visible = region === "all" ? tours : tours.filter((t) => t.municipality_name === region);

  return (
    <div className="container">
      <div className="page-head">
        <h1>Experience Marketplace</h1>
        <p>
          Walking tours powered by the memories of local elders — every stop is a real story,
          every guide is Cultory Certified.
        </p>
      </div>

      <div className="filter-row">
        <button className={`filter-chip ${region === "all" ? "active" : ""}`} onClick={() => setRegion("all")}>
          All regions ({tours.length})
        </button>
        {regions.map((r) => (
          <button key={r} className={`filter-chip ${region === r ? "active" : ""}`} onClick={() => setRegion(r)}>
            {r}
          </button>
        ))}
      </div>

      <div className="tour-grid">
        {visible.map((t) => (
          <Link key={t.id} to={`/tours/${t.id}`} className="glass card card-hover" style={{ display: "block", overflow: "hidden" }}>
            <div className="tour-cover">{t.cover_emoji}</div>
            <h3 style={{ margin: "14px 0 4px" }}>{t.title}</h3>
            <p style={{ color: "var(--muted)", fontSize: 13.5 }}>
              📍 {t.municipality_name}, {t.country}
            </p>
            <p style={{ fontSize: 14, margin: "8px 0", minHeight: 42 }}>{t.description}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {t.certified === 1 && <span className="badge green">✓ Certified guide</span>}
              <span className="badge">⏱ {Math.floor(t.duration_min / 60)}h {t.duration_min % 60}m</span>
              <span className="badge">{t.difficulty}</span>
              {typeof t.stops === "number" && <span className="badge accent">{t.stops} story stops</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <span className="price-tag">{euro(t.price_cents)}<small> / person</small></span>
              <span style={{ color: "#fbbf24", fontWeight: 700 }}>★ {t.rating.toFixed(1)}</span>
            </div>
          </Link>
        ))}
        {!visible.length && (
          <p style={{ color: "var(--muted)" }}>Loading experiences…</p>
        )}
      </div>

      <p className="footer-note">
        Every booking supports local guides directly (75%) and funds further heritage digitization.
      </p>
    </div>
  );
}
