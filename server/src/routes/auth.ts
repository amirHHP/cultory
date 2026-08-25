import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, uid } from "../db.js";
import { signToken, requireAuth, COOKIE_NAME } from "../auth.js";
import type { Role } from "../types.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(80),
  role: z.enum(["municipality", "enterprise", "guide", "elder"]),
  municipality_name: z.string().max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

  const { email, password, name, role, municipality_name } = parsed.data;
  const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: "An account with this email already exists" });

  let municipality_id: string | null = null;
  if (role === "municipality") {
    municipality_id = uid("mun");
    db.prepare(
      `INSERT INTO municipalities (id, name, country, region) VALUES (?, ?, '—', '—')`
    ).run(municipality_id, municipality_name || name);
  }

  const id = uid("usr");
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, municipality_id) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, email.toLowerCase(), bcrypt.hashSync(password, 10), name, role as Role, municipality_id);

  const user = { id, email: email.toLowerCase(), name, role, municipality_id };
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 3600 * 1000,
  });
  res.status(201).json({ user, token });
});

router.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

  const row = db
    .prepare(
      `SELECT u.*, m.name AS mun_name FROM users u LEFT JOIN municipalities m ON m.id = u.municipality_id WHERE u.email = ?`
    )
    .get(parsed.data.email.toLowerCase()) as any;
  if (!row || !bcrypt.compareSync(parsed.data.password, row.password_hash))
    return res.status(401).json({ error: "Invalid email or password" });

  const user = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    municipality_id: row.municipality_id,
    municipality_name: row.mun_name ?? undefined,
  };
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 3600 * 1000,
  });
  res.json({ user, token });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

export default router;
