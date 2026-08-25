import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
export const PLATFORM_FEE_PCT = 0.25; // Cultory retains 25% of each booking

router.get("/tours", (_req, res) => {
  const tours = db
    .prepare(
      `SELECT i.*, m.name AS municipality_name, m.country,
              (SELECT COUNT(*) FROM itinerary_stops s WHERE s.itinerary_id = i.id) AS stops,
              (SELECT COUNT(*) FROM bookings b WHERE b.itinerary_id = i.id AND b.status='paid') AS bookings_count
       FROM itineraries i JOIN municipalities m ON m.id = i.municipality_id`
    )
    .all();
  res.json({ tours });
});

router.get("/tours/:id", (req, res) => {
  const tour = db
    .prepare(`SELECT i.*, m.name AS municipality_name, m.country, u.name AS guide_name
              FROM itineraries i JOIN municipalities m ON m.id=i.municipality_id LEFT JOIN users u ON u.id=i.guide_id
              WHERE i.id = ?`)
    .get(req.params.id) as any;
  if (!tour) return res.status(404).json({ error: "Tour not found" });
  const stops = db
    .prepare(
      `SELECT s.position, st.title, st.category, st.place_name, st.lat, st.lng, st.translation_en
       FROM itinerary_stops s JOIN stories st ON st.id = s.story_id
       WHERE s.itinerary_id = ? ORDER BY s.position`
    )
    .all(req.params.id);
  res.json({ tour, stops });
});

/** Create a pending booking */
router.post("/bookings", (req, res) => {
  const parsed = z
    .object({
      itinerary_id: z.string().min(4),
      tourist_name: z.string().min(2).max(80),
      tourist_email: z.string().email(),
      tourist_country: z.string().length(2).default("DE"),
      age_group: z.enum(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]).default("35-44"),
      seats: z.number().int().min(1).max(12).default(2),
      tour_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

  const tour = db.prepare(`SELECT * FROM itineraries WHERE id = ?`).get(parsed.data.itinerary_id) as any;
  if (!tour) return res.status(404).json({ error: "Tour not found" });

  const total = tour.price_cents * parsed.data.seats;
  const id = uid("bkg");
  db.prepare(
    `INSERT INTO bookings (id, itinerary_id, user_id, tourist_name, tourist_email, tourist_country, age_group, seats, tour_date, total_cents, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(id, tour.id, req.user?.id ?? null, parsed.data.tourist_name, parsed.data.tourist_email,
        parsed.data.tourist_country, parsed.data.age_group, parsed.data.seats, parsed.data.tour_date, total);
  res.status(201).json({
    booking_id: id,
    total_cents: total,
    platform_fee_cents: Math.round(total * PLATFORM_FEE_PCT),
    guide_payout_cents: total - Math.round(total * PLATFORM_FEE_PCT),
    status: "pending_payment",
  });
});

// Some marketplace endpoints are public, others need auth context for keys — keep open read access.
export default router;
