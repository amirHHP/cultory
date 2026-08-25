import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, sha256 } from "./db.js";
import type { Role } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET || "cultory-dev-secret-change-me";
export const COOKIE_NAME = "cultory_token";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  municipality_id: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      apiKeyId?: string;
    }
  }
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = (req as any).cookies?.[COOKIE_NAME];
  return cookie ?? null;
}

export function signToken(u: AuthUser): string {
  return jwt.sign({ sub: u.id, role: u.role }, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const row = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, u.municipality_id FROM users u WHERE u.id = ?`
      )
      .get(payload.sub) as AuthUser | undefined;
    if (!row) return res.status(401).json({ error: "User not found" });
    req.user = row;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: `Requires role: ${roles.join(" or ")}` });
    next();
  };
}

/** B2B public-data API authentication: X-API-Key header or Bearer cul_... */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const raw =
    (req.headers["x-api-key"] as string | undefined) ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);
  if (!raw || !raw.startsWith("cul_"))
    return res.status(401).json({ error: "Missing API key. Get one at /developers" });
  const row = db
    .prepare(`SELECT * FROM api_keys WHERE key_hash = ? AND status = 'active'`)
    .get(sha256(raw)) as any;
  if (!row)
    return res.status(401).json({ error: "Invalid or revoked API key" });
  db.prepare(`UPDATE api_keys SET request_count = request_count + 1, last_used_at = datetime('now') WHERE id = ?`).run(row.id);
  req.apiKeyId = row.id;
  next();
}
