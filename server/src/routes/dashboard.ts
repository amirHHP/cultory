import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

const router = Router();

export const PACKAGES = {
  essential: { price_cents: 1_500_000, label: "Essential Heritage Digitization" },
  premium: { price_cents: 2_500_000, label: "Premium Heritage Digitization" },
} as const;

function monthsBack(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.toISOString().slice(0, 7)); // YYYY-MM
  }
  return out;
}

router.use(requireAuth);

/** KPI + chart data. ?range=3|6|12 */
router.get("/stats", (req, res) => {
  const range = z.coerce.number().refine((v) => [3, 6, 12].includes(v)).default(12).parse(req.query.range ?? 12);
  const munId = req.user!.role === "municipality" ? req.user!.municipality_id : null;

  const months = monthsBack(range);
  const firstMonth = `${months[0]}-01`;

  // Footfall = seats sold per month (paid bookings)
  const footfallRows = db
    .prepare(
      `SELECT strftime('%Y-%m', b.created_at) AS ym, SUM(b.seats) AS tourists, COUNT(*) AS bookings
       FROM bookings b JOIN itineraries i ON i.id = b.itinerary_id
       WHERE b.status = 'paid' AND b.created_at >= ?
       ${munId ? `AND i.municipality_id = '${munId}'` : ""}
       GROUP BY ym`
    )
    .all(firstMonth) as { ym: string; tourists: number; bookings: number }[];
  const footfallMap = new Map(footfallRows.map((r) => [r.ym, r]));

  const revenueRows = db
    .prepare(
      `SELECT strftime('%Y-%m', t.created_at) AS ym,
              SUM(t.amount_cents) AS gross, SUM(t.platform_fee_cents) AS fees
       FROM transactions t
       WHERE t.kind = 'booking' AND t.created_at >= ?
       GROUP BY ym`
    )
    .all(firstMonth) as any[];
  const revMap = new Map(revenueRows.map((r: any) => [r.ym, r]));

  const footfall = months.map((ym) => ({
    month: ym,
    label: new Date(`${ym}-01`).toLocaleString("en", { month: "short" }),
    tourists: footfallMap.get(ym)?.tourists ?? 0,
    bookings: footfallMap.get(ym)?.bookings ?? 0,
    revenue_eur: Math.round((revMap.get(ym)?.gross ?? 0) / 100),
    platform_fee_eur: Math.round((revMap.get(ym)?.fees ?? 0) / 100),
  }));

  const demographics = db
    .prepare(
      `SELECT b.age_group AS age_group, SUM(b.seats) AS value FROM bookings b
       JOIN itineraries i ON i.id = b.itinerary_id
       WHERE b.status='paid' ${munId ? `AND i.municipality_id='${munId}'` : ""}
       GROUP BY b.age_group ORDER BY value DESC`
    )
    .all();

  const topCountries = db
    .prepare(
      `SELECT b.tourist_country AS country, SUM(b.seats) AS value FROM bookings b
       JOIN itineraries i ON i.id = b.itinerary_id
       WHERE b.status='paid' ${munId ? `AND i.municipality_id='${munId}'` : ""}
       GROUP BY country ORDER BY value DESC LIMIT 6`
    )
    .all();

  const categories = db
    .prepare(
      `SELECT category, COUNT(*) AS value FROM stories
       ${munId ? `WHERE municipality_id='${munId}'` : ""} GROUP BY category`
    )
    .all();

  const kpis = {
    stories_total: (db.prepare(`SELECT COUNT(*) c FROM stories ${munId ? `WHERE municipality_id='${munId}'` : ""}`).get() as any).c,
    tours_total: (db.prepare(`SELECT COUNT(*) c FROM itineraries ${munId ? `WHERE municipality_id='${munId}'` : ""}`).get() as any).c,
    certified_guides: (db.prepare(`SELECT COUNT(*) c FROM users WHERE role='guide'`).get() as any).c,
    tourists_30d:
      (db
        .prepare(
          `SELECT COALESCE(SUM(b.seats),0) c FROM bookings b JOIN itineraries i ON i.id=b.itinerary_id
           WHERE b.status='paid' AND b.created_at >= datetime('now','-30 days') ${munId ? `AND i.municipality_id='${munId}'` : ""}`
        )
        .get() as any).c,
    revenue_ytd_eur: Math.round(
      ((db.prepare(`SELECT COALESCE(SUM(amount_cents),0) c FROM transactions WHERE kind='booking' AND created_at >= ?`).get(`${new Date().getFullYear()}-01-01`) as any).c || 0) / 100
    ),
    platform_fees_eur: Math.round(
      ((db.prepare(`SELECT COALESCE(SUM(platform_fee_cents),0) c FROM transactions WHERE kind='booking' AND created_at >= ?`).get(`${new Date().getFullYear()}-01-01`) as any).c || 0) / 100
    ),
  };

  res.json({ range, kpis, footfall, demographics, topCountries, categories });
});

/** B2G heritage package subscription (€15k / €25k) */
router.post("/package/subscribe", requireRole("municipality"), (req, res) => {
  const tier = z.enum(["essential", "premium"]).safeParse(req.body.tier);
  if (!tier.success) return res.status(400).json({ error: "tier must be 'essential' or 'premium'" });
  const pkg = PACKAGES[tier.data];
  const munId = req.user!.municipality_id!;
  db.prepare(`UPDATE municipalities SET plan_tier=?, plan_price_cents=?, package_status='active' WHERE id=?`)
    .run(tier.data, pkg.price_cents, munId);
  const txId = uid("txn");
  db.prepare(
    `INSERT INTO transactions (id, municipality_id, kind, payer, amount_cents, fee_pct, platform_fee_cents, payout_cents)
     VALUES (?, ?, 'package', ?, ?, 0, ?, 0)`
  ).run(txId, munId, req.user!.name, pkg.price_cents, pkg.price_cents); // full amount retained by platform
  res.json({
    ok: true,
    package: { tier: tier.data, ...pkg },
    transaction_id: txId,
    message: `${pkg.label} activated — invoice sent to your municipal finance office.`,
  });
});

router.get("/package", requireRole("municipality"), (req, res) => {
  const row = db.prepare(`SELECT name, country, plan_tier, plan_price_cents, package_status FROM municipalities WHERE id = ?`)
    .get(req.user!.municipality_id!);
  res.json({ packages: Object.entries(PACKAGES).map(([tier, p]) => ({ tier, ...p })), current: row });
});

export default router;
