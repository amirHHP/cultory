import { Link } from "react-router-dom";
import { useAuth } from "../App";

const DEMO = [
  { label: "Municipality (B2G)", email: "metsovo@cultory.eu", target: "/dashboard" },
  { label: "Enterprise / OTA (B2B)", email: "partners@getyourguide.example", target: "/developers" },
  { label: "Elder Contributor", email: "maria@elders.cultory.eu", target: "/elder" },
  { label: "Super Admin", email: "admin@cultory.eu", target: "/dashboard" },
];

export default function Landing() {
  const { login } = useAuth();

  return (
    <div className="container">
      <section className="hero">
        <h1>
          Keep culture alive.
          <br />
          <em>Digitally, and forever.</em>
        </h1>
        <p className="sub">
          Cultory turns the memories of Europe's elders into structured, geotagged heritage
          data — monetized by municipalities, licensed to travel platforms, and lived by
          curious travellers.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/marketplace" className="btn btn-primary btn-lg">Explore experiences</Link>
          <Link to="/register" className="btn btn-ghost btn-lg">Partner with us</Link>
        </div>

        <div className="pillar-grid">
          <div className="glass card card-hover">
            <div className="pillar-icon">🏛️</div>
            <h3>B2G · Heritage Digitization</h3>
            <p style={{ color: "var(--muted)", fontSize: 14.5, marginTop: 8 }}>
              Rural municipalities subscribe to €15,000–€25,000 packages: AI-assisted elder
              interviews, a live cultural dashboard and tourism analytics for their region.
            </p>
            <div style={{ marginTop: 12 }}>
              <span className="badge accent">€15k – €25k / package</span>{" "}
              <span className="badge">Live KPIs</span>
            </div>
          </div>
          <div className="glass card card-hover">
            <div className="pillar-icon">🔌</div>
            <h3>B2B · Cultural Data API</h3>
            <p style={{ color: "var(--muted)", fontSize: 14.5, marginTop: 8 }}>
              OTAs and hotel chains license our structured dataset through tiered SaaS plans,
              from Starter at €500/mo to Scale at €2,000/mo with SLA & bulk export.
            </p>
            <div style={{ marginTop: 12 }}>
              <span className="badge accent">€500 – €2,000 / mo</span>{" "}
              <span className="badge">REST API</span>
            </div>
          </div>
          <div className="glass card card-hover">
            <div className="pillar-icon">🥾</div>
            <h3>B2B2C · Experience Marketplace</h3>
            <p style={{ color: "var(--muted)", fontSize: 14.5, marginTop: 8 }}>
              Gamified walking tours built on elder-sourced stories, led by Cultory Certified
              local guides. The platform retains a 20–30% transaction fee per booking.
            </p>
            <div style={{ marginTop: 12 }}>
              <span className="badge accent">20–30% platform fee</span>{" "}
              <span className="badge green">Guides earn 75%</span>
            </div>
          </div>
        </div>
      </section>

      <h2 className="section-title">🔑 Try the demo accounts</h2>
      <div className="glass card" style={{ padding: 10 }}>
        <table className="table demo-table">
          <thead>
            <tr><th>Role</th><th>Email</th><th>Password</th><th></th></tr>
          </thead>
          <tbody>
            {DEMO.map((d) => (
              <tr key={d.email}>
                <td style={{ fontWeight: 600 }}>{d.label}</td>
                <td className="mono">{d.email}</td>
                <td className="mono">cultory123</td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="quick-login"
                    onClick={async () => {
                      try {
                        await login(d.email, "cultory123");
                        window.location.href = d.target;
                      } catch (e: any) {
                        alert(e.message);
                      }
                    }}
                  >
                    Sign in →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="footer-note">Cultory © {new Date().getFullYear()} — intangible cultural heritage infrastructure.</p>
    </div>
  );
}
