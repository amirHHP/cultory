import { Router } from "express";
import { requireApiKey } from "../auth.js";
import { db } from "../db.js";

const router = Router();

/** Public B2B data API consumed by OTA / hotel partners via API key. */

router.get("/stories", requireApiKey, (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const category = req.query.category as string | undefined;
  const rows = db
    .prepare(
      `SELECT s.id, s.title, s.translation_en, s.category, s.place_name, s.lat, s.lng, s.language,
              m.name AS municipality, m.country
       FROM stories s JOIN municipalities m ON m.id = s.municipality_id
       WHERE s.status = 'published' ${category ? "AND s.category = @category" : ""}
       ORDER BY s.created_at DESC LIMIT @limit`
    )
    .all({ limit, ...(category ? { category } : {}) } as any);
  res.json({
    object: "list",
    count: rows.length,
    data: rows.map((r: any) => ({
      type: "story",
      attributes: r,
      links: { geo: r.lat && r.lng ? `geo:${r.lat},${r.lng}` : null },
    })),
  });
});

router.get("/itineraries", requireApiKey, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT i.id, i.title, i.description, i.price_cents, i.duration_min, i.difficulty, i.rating,
              m.name AS municipality, m.country,
              (SELECT COUNT(*) FROM itinerary_stops s WHERE s.itinerary_id = i.id) AS story_stops
       FROM itineraries i JOIN municipalities m ON m.id = i.municipality_id`
    )
    .all();
  res.json({ object: "list", count: rows.length, data: rows });
});

router.get("/municipalities", requireApiKey, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT m.id, m.name, m.country, m.region, m.lat, m.lng,
              (SELECT COUNT(*) FROM stories s WHERE s.municipality_id = m.id) AS stories_count
       FROM municipalities m`
    )
    .all();
  res.json({ object: "list", count: rows.length, data: rows });
});

export default router;
