import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

const router = Router();

/** Mock AI interviewer question bank */
const PROMPTS = [
  { id: "p1", text: "Γεια σας! Tell me about a tradition from your village that few people remember today.", icon: "🎙️" },
  { id: "p2", text: "Can you describe a festival or celebration from your childhood? What did it sound like?", icon: "🎊" },
  { id: "p3", text: "Was there a special craft, recipe or song passed down in your family?", icon: "🧵" },
  { id: "p4", text: "Tell us about an important place nearby — what stories live there?", icon: "⛰️" },
];

router.get("/prompts", (_req, res) => res.json({ prompts: PROMPTS }));

router.post("/session", requireAuth, (req, res) => {
  const id = uid("ivw");
  db.prepare(
    `INSERT INTO interview_sessions (id, elder_id, municipality_id) VALUES (?, ?, ?)`
  ).run(id, req.user!.id, req.user!.municipality_id ?? null);
  res.status(201).json({ session_id: id, first_prompt: PROMPTS[0] });
});

/**
 * MOCK voice-to-text → translate → structure pipeline.
 * In production this proxies to Whisper + GPT-4o; here we simulate stages with latency.
 */
const MOCK_TRANSCRIPTS = [
  {
    raw: "Κάθε Αύγουστο, το βράδυ, μαζευόμαστε στην πλατεία και τα γεροντότερα έλεγαν το τραγούδι του ποταμού...",
    en: "Every August evening we gathered in the square and the eldest would sing the song of the river — the same song their grandmothers sang before the bridge was built in 1932.",
    place: "Old Stone Bridge",
    lat: 39.7667, lng: 20.9667,
    category: "folklore",
    people: ["Eleni V.", "the village choir"],
    year: 1932,
  },
  {
    raw: "Ο παππούς μου έφτιαχνε καμπάνα για τα πρόβατα. Χτυπούσε το χαλκό με σφυρί μέχρι να ακουστεί σε όλο το βουνό...",
    en: "My grandfather cast bells for the sheep, hammering the bronze until its ring could be heard across the whole mountain. Each bell had a voice of its own.",
    place: "Bell Founders' Lane",
    lat: 39.7695, lng: 21.1797,
    category: "crafts_music",
    people: ["grandfather Dimitris"],
    year: 1954,
  },
  {
    raw: "Την Μεγάλη Πέμπτη ψήναμε το ψωμί με το κόκκινο αυγό στη χόβολη...",
    en: "On Holy Thursday we baked bread with red-dyed eggs pressed into the crust, right on the embers. The whole village smelled of mastic and orange peel.",
    place: "Panagia Square",
    lat: 35.3333, lng: 25.1333,
    category: "cuisine",
    people: ["yiayia Maria"],
    year: 1968,
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

router.post(
  "/transcribe",
  requireAuth,
  async (req, res) => {
    const body = z
      .object({
        session_id: z.string().min(4),
        duration_sec: z.number().min(1).max(600).default(45),
      })
      .safeParse(req.body);
    if (!body.success)
      return res.status(400).json({ error: "Validation failed", details: body.error.flatten() });
    if (!body.data.session_id.startsWith("ivw_"))
      return res.status(400).json({ error: "Unknown interview session" });

    const mock = MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
    await sleep(700); // simulate ASR latency

    db.prepare(`UPDATE interview_sessions SET stage = 'structured' WHERE id = ?`).run(body.data.session_id);

    res.json({
      pipeline: [
        { stage: "speech_to_text", model: "whisper-large-v3 (mock)", confidence: 0.94, ms: 690 },
        { stage: "translate", model: "gpt-4o-mini (mock)", target: "en", confidence: 0.97, ms: 210 },
        { stage: "structure", model: "cultory-structurer (mock)", confidence: 0.91, ms: 180 },
      ],
      transcript_raw: mock.raw,
      translation_en: mock.en,
      suggested: {
        title: `${mock.place} — ${mock.category.replace("_", " ")}`,
        category: mock.category,
        place_name: mock.place,
        geotag: { lat: mock.lat, lng: mock.lng },
        people: mock.people,
        era: mock.year,
        duration_sec: body.data.duration_sec,
      },
      needs_review: true,
    });
  }
);

export default router;
