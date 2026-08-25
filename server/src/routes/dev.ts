import { Router } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { db, uid, sha256 } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

const router = Router();

export const TIERS = {
  starter: { label: "Starter", price_cents: 500_00, calls: 10_000, features: ["Stories & geotags", "3 datasets", "Email support"] },
  growth: { label: "Growth", price_cents: 1_200_00, calls: 100_000, features: ["Everything in Starter", "Itineraries & availability", "Webhooks", "Priority support"] },
  scale: { label: "Scale", price_cents: 2_000_00, calls: 1_000_000, features: ["Everything in Growth", "Bulk export / S3 sync", "SLA 99.9%", "Dedicated CSM"] },
} as const;

router.use(requireAuth);

router.get("/tiers", (_req, res) =>
  res.json({ tiers: Object.entries(TIERS).map(([id, t]) => ({ id, ...t })) })
);

router.get("/keys", (req, res) => {
  const rows = db
    .prepare(`SELECT id, label, key_prefix, tier, environment, status, request_count, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user!.id);
  res.json({ keys: rows });
});

/** Generate a new key — plaintext is shown exactly once. */
router.post("/keys", requireRole("enterprise", "super_admin"), (req, res) => {
  const body = z
    .object({
      tier: z.enum(["starter", "growth", "scale"]).default("starter"),
      label: z.string().max(60).default("Production"),
      environment: z.enum(["live", "test"]).default("live"),
    })
    .safeParse(req.body ?? {});
  if (!body.success) return res.status(400).json({ error: "Validation failed" });

  const raw = `cul_${body.data.environment}_${crypto.randomBytes(24).toString("hex")}`;
  const id = uid("key");
  const prefix = raw.slice(0, 16);
  db.prepare(
    `INSERT INTO api_keys (id, user_id, label, key_hash, key_prefix, tier, environment) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user!.id, body.data.label, sha256(raw), prefix, body.data.tier, body.data.environment);
  res.status(201).json({
    id,
    api_key: raw,
    warning: "Store this key now — it will not be shown again.",
    tier: TIERS[body.data.tier],
  });
});

router.delete("/keys/:id", (req, res) => {
  const info = db
    .prepare(`UPDATE api_keys SET status='revoked' WHERE id = ? AND user_id = ? AND status='active'`)
    .run(req.params.id, req.user!.id);
  if (info.changes === 0) return res.status(404).json({ error: "Key not found or already revoked" });
  res.json({ ok: true });
});

export default router;
