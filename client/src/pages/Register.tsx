import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../App";

const ROLES = [
  { id: "municipality", label: "Municipality / Tourism board (B2G)" },
  { id: "enterprise", label: "Enterprise — OTA, hotel chain (B2B)" },
  { id: "guide", label: "Local guide (Cultory Certified)" },
  { id: "elder", label: "Elder / Heritage contributor" },
];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "municipality",
    municipality_name: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setBusy(true);
    try {
      const user = await register({
        ...form,
        email: form.email.trim(),
        municipality_name: form.role === "municipality" ? form.municipality_name || undefined : undefined,
      });
      nav(user.role === "enterprise" ? "/developers" : user.role === "municipality" ? "/dashboard" : "/elder");
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.details ?? {});
      } else setError("Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 50 }}>
      <div className="glass card">
        <h1 style={{ fontSize: 26 }}>Join Cultory</h1>
        <p style={{ color: "var(--muted)", margin: "6px 0 22px" }}>
          Choose how you want to work with cultural heritage data.
        </p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <label className="field">
            <span>I am a…</span>
            <select className="input" value={form.role} onChange={set("role")}>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Full name</span>
            <input className="input" required minLength={2} value={form.name} onChange={set("name")}
              placeholder="Kostas Zikos" />
            {fieldErrors.name && <div className="field-error">{fieldErrors.name.join(", ")}</div>}
          </label>
          {form.role === "municipality" && (
            <label className="field">
              <span>Municipality name</span>
              <input className="input" value={form.municipality_name} onChange={set("municipality_name")}
                placeholder="Metsovo" />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" required value={form.email} onChange={set("email")}
              placeholder="you@example.eu" />
            {fieldErrors.email && <div className="field-error">{fieldErrors.email.join(", ")}</div>}
          </label>
          <label className="field">
            <span>Password (min. 8 characters)</span>
            <input className="input" type="password" required minLength={8} value={form.password}
              onChange={set("password")} placeholder="••••••••" />
            {fieldErrors.password && <div className="field-error">{fieldErrors.password.join(", ")}</div>}
          </label>
          <button className="btn btn-primary btn-lg" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 18, textAlign: "center" }}>
          Already registered? <Link to="/login" style={{ color: "var(--accent)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
