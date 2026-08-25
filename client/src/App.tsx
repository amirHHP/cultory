import React, { createContext, useContext, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { api, getToken, setToken } from "./api";
import type { User } from "./types";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ElderPortal from "./pages/ElderPortal";
import DevPortal from "./pages/DevPortal";
import Marketplace from "./pages/Marketplace";
import TourDetail from "./pages/TourDetail";

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: {
    email: string;
    password: string;
    name: string;
    role: string;
    municipality_name?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

function Protected({ roles, children }: { roles?: string[]; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="container" style={{ color: "var(--muted)" }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const res = await api<{ user: User }>("/auth/me");
          setUser(res.user);
        } catch {
          setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register: AuthCtx["register"] = async (body) => {
    const res = await api<{ user: User; token: string }>("/auth/register", {
      method: "POST",
      body,
    });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  return (
    <Ctx.Provider value={{ user, ready, login, register, logout }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <Protected roles={["municipality", "super_admin"]}>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/elder"
            element={
              <Protected roles={["elder", "guide", "super_admin"]}>
                <ElderPortal />
              </Protected>
            }
          />
          <Route path="/developers" element={<DevPortal />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/tours/:id" element={<TourDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Ctx.Provider>
  );
}
