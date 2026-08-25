import React from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../App";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  municipality: "Municipality · B2G",
  enterprise: "Enterprise · B2B",
  guide: "Certified Guide",
  elder: "Elder Contributor",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();

  const links = [
    { to: "/marketplace", label: "Marketplace" },
    ...(user?.role === "municipality" || user?.role === "super_admin"
      ? [{ to: "/dashboard", label: "Municipal Dashboard" }]
      : []),
    ...(user && ["elder", "guide", "super_admin"].includes(user.role)
      ? [{ to: "/elder", label: "Story Studio" }]
      : []),
    { to: "/developers", label: "Developer Portal" },
  ];

  return (
    <>
      <nav className="nav">
        <Link to="/" className="nav-logo">
          <span className="logo-mark">🏛️</span> Cultory
        </Link>
        <div className="nav-links">
          {links.map((l) =>
            l.to === "/developers" || l.to === "/marketplace" ? (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.label}
              </NavLink>
            ) : (
              loc.pathname !== "/" || user ? (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
                  {l.label}
                </NavLink>
              ) : null
            )
          )}
          {!loc.pathname.startsWith("/login") && (
            <>{!user ? (
              <>
                <NavLink to="/login" className={({ isActive }) => (isActive ? "active" : "")}>Sign in</NavLink>
                <Link to="/register" className="btn btn-primary" style={{ padding: "8px 16px" }}>Get started</Link>
              </>
            ) : (
              <span className="nav-user">
                <span className="role-chip">{ROLE_LABELS[user.role] ?? user.role}</span>
                {user.name}
                <button className="quick-login" onClick={logout}>Sign out</button>
              </span>
            )}</>
          )}
        </div>
      </nav>
      {children}
    </>
  );
}
