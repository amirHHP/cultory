import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.js";

const router = Router();
export const PLATFORM_FEE_PCT = 0.25;

/**
 * MOCK payment gateway — test card 4242 4242 4242 4242 succeeds.
 * On success the booking is marked paid and a transaction recorded:
 * Cultory keeps 25%, guide/municipality receives 75%.
 */
router.post("/checkout", (req, res) => {
  const parsed = z
    .object({ booking_id: z.string(), card_number: z.string(), card_name: z.string().min(2), expiry: z.string().min(4), cvc: z.string().min(3) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

  const booking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(parsed.data.booking_id) as any;
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.status === "paid") return res.status(409).json({ error: "Booking already paid" });

  const digits = parsed.data.card_number.replace(/\s/g, "");
  if (!/^\d{12,19}$/.test(digits))
    return res.status(402).json({ error: "Invalid card number" });
  if (!digits.startsWith("4242"))
    return res.status(402).json({ error: "Card declined (mock gateway accepts test card 4242 4242 4242 4242)" });

  const fee = Math.round(booking.total_cents * PLATFORM_FEE_PCT);
  const txId = uid("txn");
  db.prepare(`UPDATE bookings SET status='paid' WHERE id=?`).run(booking.id);
  db.prepare(
    `INSERT INTO transactions (id, booking_id, municipality_id, kind, payer, amount_cents, fee_pct, platform_fee_cents, payout_cents)
     VALUES (?, ?, (SELECT municipality_id FROM itineraries WHERE id = ?), 'booking', ?, ?, ?, ?, ?)`
  ).run(txId, booking.id, booking.itinerary_id, booking.tourist_email, booking.total_cents, PLATFORM_FEE_PCT, fee, booking.total_cents - fee);

  res.json({
    receipt_id: txId,
    status: "settled",
    charged_eur: booking.total_cents / 100,
    cultory_fee_pct: PLATFORM_FEE_PCT * 100,
    cultory_fee_eur: fee / 100,
    local_payout_eur: (booking.total_cents - fee) / 100,
  });
});

router.get("/bookings/:id", (req, res) => {
  const row = db
    .prepare(`SELECT b.*, i.title AS tour_title FROM bookings b JOIN itineraries i ON i.id=b.itinerary_id WHERE b.id=?`)
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Booking not found" });
  res.json(row);
});

export default router;
