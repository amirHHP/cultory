import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

const storySchema = z.object({
  title: z.string().min(3).max(120),
  transcript: z.string().min(10).max(5000),
  translation_en: z.string().max(5000).optional(),
  category: z.enum(["oral_history", "crafts_music", "cuisine", "folklore", "rituals", "nature_wisdom"]),
  language: z.string().default("el"),
  place_name: z.string().min(2).max(120),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  duration_sec: z.number().int().min(0).max(3600).default(0),
});

router.get("/", requireAuth, (req, res) => {
  const { municipality_id, category, limit = "100" } = req.query as Record<string, string>;
  let sql = `SELECT s.*, m.name AS municipality_name FROM stories s JOIN municipalities m ON m.id = s.municipality_id WHERE 1=1`;
  const params: any[] = [];
  if (municipality_id) { sql += ` AND s.municipality_id = ?`; params.push(municipality_id); }
  if (category) { sql += ` AND s.category = ?`; params.push(category); }
  sql += ` ORDER BY s.created_at DESC LIMIT ?`;
  params.push(Math.min(parseInt(limit), 200));
  res.json({ stories: db.prepare(sql).all(...params) });
});

router.post("/", requireAuth, (req, res) => {
  const parsed = storySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  const d = parsed.data;
  const id = uid("sto");
  db.prepare(
    `INSERT INTO stories (id, municipality_id, contributor_id, title, transcript, translation_en, category, language, place_name, lat, lng, duration_sec, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user!.municipality_id ?? "mun_seed_metsovo",
    req.user!.id,
    d.title,
    d.transcript,
    d.translation_en ?? null,
    d.category,
    d.language,
    d.place_name,
    d.lat ?? null,
    d.lng ?? null,
    d.duration_sec,
    "interview"
  );
  res.status(201).json(db.prepare(`SELECT * FROM stories WHERE id = ?`).get(id));
});

router.patch("/:id/status", requireAuth, (req, res) => {
  const status = z.enum(["draft", "published", "archived"]).safeParse(req.body.status);
  if (!status.success) return res.status(400).json({ error: "Invalid status" });
  const info = db.prepare(`UPDATE stories SET status = ? WHERE id = ?`).run(status.data, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Story not found" });
  res.json(db.prepare(`SELECT * FROM stories WHERE id = ?`).get(req.params.id));
});

export default router;
