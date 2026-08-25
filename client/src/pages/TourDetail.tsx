import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { euro, CATEGORY_LABELS, type Tour, type TourStop } from "../types";

interface BookingDraft {
  booking_id: string;
  total_cents: number;
  platform_fee_cents: number;
  guide_payout_cents: number;
}

interface Receipt {
  receipt_id: string;
  charged_eur: number;
  cultory_fee_pct: number;
  cultory_fee_eur: number;
  local_payout_eur: number;
}

export default function TourDetail() {
  const { id } = useParams<{ id: string }>();
  const [tour, setTour] = useState<Tour | null>(null);
  const [stops, setStops] = useState<TourStop[]>([]);
  const [booking, setBooking] = useState<BookingDraft | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    tourist_name: "",
    tourist_email: "",
    tourist_country: "DE",
    age_group: "25-34",
    seats: 2,
    tour_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    card_number: "4242 4242 4242 4242",
    card_name: "",
    expiry: "12/28",
    cvc: "123",
  });

  useEffect(() => {
    api<{ tour: Tour; stops: TourStop[] }>(`/marketplace/tours/${id}`)
      .then((r) => { setTour(r.tour); setStops(r.stops); })
      .catch((e) => setError(e.message));
  }, [id]);

  const createBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<BookingDraft>("/marketplace/bookings", {
        method: "POST",
        body: {
          itinerary_id: id,
          tourist_name: form.tourist_name,
          tourist_email: form.tourist_email,
          tourist_country: form.tourist_country,
          age_group: form.age_group,
          seats: Number(form.seats),
          tour_date: form.tour_date,
        },
      });
      setBooking(res);
      setForm({ ...form, card_name: form.tourist_name });
    } catch (err: any) {
      setError(err.details ? Object.values(err.details).flat().join(" · ") : err.message);
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<Receipt>("/payments/checkout", {
        method: "POST",
        body: {
          booking_id: booking.booking_id,
          card_number: form.card_number,
          card_name: form.card_name || form.tourist_name,
          expiry: form.expiry,
          cvc: form.cvc,
        },
      });
      setReceipt(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!tour) return <div className="container" style={{ color: "var(--muted)" }}>{error ?? "Loading tour…"}</div>;

  return (
    <div className="container">
      <p style={{ marginTop: 20 }}><Link to="/marketplace" style={{ color: "var(--accent)" }}>← Back to marketplace</Link></p>
      <div className="page-head">
        <h1>{tour.cover_emoji} {tour.title}</h1>
        <p>📍 {tour.municipality_name}, {tour.country} · guided by{" "}
          <b>{tour.guide_name ?? "a Cultory Certified local"}</b>
          {tour.certified === 1 && <> <span className="badge green">✓ Certified</span></>}
        </p>
      </div>

      <div className="grid-2">
        <div>
          <div className="glass card">
            <h3>About this experience</h3>
            <p style={{ color: "var(--muted)", margin: "10px 0 16px" }}>{tour.description}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge accent">{euro(tour.price_cents)} / person</span>
              <span className="badge">⏱ {Math.floor(tour.duration_min / 60)}h {tour.duration_min % 60}m</span>
              <span className="badge">🥾 {tour.difficulty}</span>
              <span className="badge">★ {tour.rating.toFixed(1)}</span>
            </div>
          </div>

          <h2 className="section-title">🗺️ Story stops</h2>
          <div className="glass card">
            <div className="timeline">
              {stops.map((s) => (
                <div key={s.position} className="timeline-item">
                  <div className="timeline-place">STOP {s.position} · {s.place_name}</div>
                  <b style={{ fontSize: 15.5 }}>{s.title}</b>
                  <span className="badge" style={{ marginLeft: 8 }}>{CATEGORY_LABELS[s.category] ?? s.category}</span>
                  <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
                    “{s.translation_en?.slice(0, 180)}{(s.translation_en?.length ?? 0) > 180 ? "…" : ""}”
                  </p>
                  <span className="mono" style={{ color: "rgba(167,139,250,.6)", fontSize: 11.5 }}>
                    geo:{s.lat.toFixed(4)},{s.lng.toFixed(4)}
                  </span>
                </div>
              ))}
              {!stops.length && <p style={{ color: "var(--muted)" }}>Stops loading…</p>}
            </div>
          </div>
        </div>

        <div>
          {!booking ? (
            <div className="glass card">
              <h3>Book this tour</h3>
              {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
              <form onSubmit={createBooking}>
                <label className="field"><span>Full name</span>
                  <input className="input" required minLength={2} value={form.tourist_name}
                    onChange={(e) => setForm({ ...form, tourist_name: e.target.value })} placeholder="Anna Müller" />
                </label>
                <label className="field"><span>Email</span>
                  <input className="input" type="email" required value={form.tourist_email}
                    onChange={(e) => setForm({ ...form, tourist_email: e.target.value })} placeholder="anna@example.com" />
                </label>
                <div className="grid-half">
                  <label className="field"><span>Country</span>
                    <select className="input" value={form.tourist_country}
                      onChange={(e) => setForm({ ...form, tourist_country: e.target.value })}>
                      {["DE", "FR", "GB", "NL", "US", "IT", "SE", "ES"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="field"><span>Age group</span>
                    <select className="input" value={form.age_group}
                      onChange={(e) => setForm({ ...form, age_group: e.target.value })}>
                      {["18-24", "25-34", "35-44", "45-54", "55-64", "65+"].map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid-half">
                  <label className="field"><span>Participants</span>
                    <input className="input" type="number" min={1} max={12} value={form.seats}
                      onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} />
                  </label>
                  <label className="field"><span>Tour date</span>
                    <input className="input" type="date" required min={new Date().toISOString().slice(0, 10)}
                      value={form.tour_date} onChange={(e) => setForm({ ...form, tour_date: e.target.value })} />
                  </label>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid rgba(255,255,255,.08)", marginBottom: 14 }}>
                  <span style={{ color: "var(--muted)" }}>Total ({form.seats} × {euro(tour.price_cents)})</span>
                  <b className="price-tag">{euro(tour.price_cents * form.seats)}</b>
                </div>
                <button className="btn btn-primary btn-lg" disabled={busy} style={{ width: "100%" }}>
                  {busy ? "Reserving…" : "Reserve & continue to payment"}
                </button>
              </form>
            </div>
          ) : !receipt ? (
            <div className="glass card">
              <h3>💳 Payment</h3>
              <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "8px 0 16px" }}>
                Mock gateway — use test card <span className="mono">4242 4242 4242 4242</span>.
              </p>
              {error && <div className="error-box">{error}</div>}
              <label className="field"><span>Card number</span>
                <input className="input mono" value={form.card_number}
                  onChange={(e) => setForm({ ...form, card_number: e.target.value })} />
              </label>
              <label className="field"><span>Name on card</span>
                <input className="input" value={form.card_name}
                  onChange={(e) => setForm({ ...form, card_name: e.target.value })} />
              </label>
              <div className="grid-half">
                <label className="field"><span>Expiry</span>
                  <input className="input mono" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
                </label>
                <label className="field"><span>CVC</span>
                  <input className="input mono" value={form.cvc} onChange={(e) => setForm({ ...form, cvc: e.target.value })} />
                </label>
              </div>
              <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 12, padding: "12px 14px", fontSize: 13.5, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total charge</span><b>{euro(booking.total_cents)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                  <span>Cultory platform fee (25%)</span><span>{euro(booking.platform_fee_cents)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#a7f3d0" }}>
                  <span>To your guide</span><span>{euro(booking.guide_payout_cents)}</span>
                </div>
              </div>
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={pay} style={{ width: "100%" }}>
                {busy ? "Processing…" : `Pay ${euro(booking.total_cents)} securely`}
              </button>
            </div>
          ) : (
            <div className="glass card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 54, margin: "8px 0" }}>🎟️</div>
              <h3>Booking confirmed!</h3>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: "8px 0 16px" }}>
                Receipt <span className="mono">{receipt.receipt_id}</span> — a confirmation was sent to {form.tourist_email}.
              </p>
              <div style={{ background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.35)", borderRadius: 12, padding: 14, textAlign: "left", fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Charged</span><b>{euro(Math.round(receipt.charged_eur * 100))}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                  <span>Cultory fee ({receipt.cultory_fee_pct}%)</span><span>{euro(Math.round(receipt.cultory_fee_eur * 100))}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#a7f3d0" }}>
                  <span>Guide payout</span><span>{euro(Math.round(receipt.local_payout_eur * 100))}</span>
                </div>
              </div>
              <Link to="/marketplace" className="btn btn-ghost" style={{ marginTop: 18 }}>Browse more experiences</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
