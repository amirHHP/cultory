import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api";
import { useAuth } from "../App";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      nav(
        user.role === "municipality" || user.role === "super_admin"
          ? "/dashboard"
          : user.role === "enterprise"
            ? "/developers"
            : user.role === "elder" || user.role === "guide"
              ? "/elder"
              : "/marketplace"
      );
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 440, paddingTop: 70 }}>
      <div className="glass card">
        <h1 style={{ fontSize: 26 }}>Welcome back</h1>
        <p style={{ color: "var(--muted)", margin: "6px 0 22px" }}>Sign in to your Cultory workspace.</p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@municipality.eu" />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
          <button className="btn btn-primary btn-lg" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 18, textAlign: "center" }}>
          No account? <Link to="/register" style={{ color: "var(--accent)" }}>Create one</Link> ·
          Demo password: <span className="mono">cultory123</span>
        </p>
      </div>
    </div>
  );
}
