import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { db, uid } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

const router = Router();

/** Real AI engine (OpenAI-compatible: OpenAI, Groq, etc.) — enabled when AI_API_KEY is set. */
const AI_BASE = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const AI_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
const STT_MODEL = process.env.AI_STT_MODEL || "whisper-1";
const CHAT_MODEL = process.env.AI_CHAT_MODEL || "gpt-4o-mini";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

/** Mock AI interviewer question bank */
const PROMPTS = [
  { id: "p1", text: "Γεια σας! Tell me about a tradition from your village that few people remember today.", icon: "🎙️" },
  { id: "p2", text: "Can you describe a festival or celebration from your childhood? What did it sound like?", icon: "🎊" },
  { id: "p3", text: "Was there a special craft, recipe or song passed down in your family?", icon: "🧵" },
  { id: "p4", text: "Tell us about an important place nearby — what stories live there?", icon: "⛰️" },
];

router.get("/prompts", (_req, res) => res.json({ prompts: PROMPTS, engine: AI_KEY ? "ai" : "mock" }));

router.post("/session", requireAuth, (req, res) => {
  const id = uid("ivw");
  db.prepare(
    `INSERT INTO interview_sessions (id, elder_id, municipality_id) VALUES (?, ?, ?)`
  ).run(id, req.user!.id, req.user!.municipality_id ?? null);
  res.status(201).json({ session_id: id, first_prompt: PROMPTS[0] });
});

const LANG_LABELS: Record<string, string> = {
  el: "Greek · Ελληνικά", fa: "Persian · فارسی", en: "English", de: "German · Deutsch",
  fr: "French · Français", it: "Italian · Italiano", pt: "Portuguese · Português",
  es: "Spanish · Español", hu: "Hungarian · Magyar", tr: "Turkish · Türkçe",
  ar: "Arabic · العربية", nl: "Dutch · Nederlands", ru: "Russian · Русский",
};
const langLabel = (code?: string | null) =>
  (code && LANG_LABELS[code]) || (code ? `Language · ${code}` : "Undetected language");

const MOCK_TRANSCRIPTS = [
  {
    raw: "Κάθε Αύγουστο, το βράδυ, μαζευόμαστε στην πλατεία και τα γεροντότερα έλεγαν το τραγούδι του ποταμού...",
    lang_code: "el",
    en: "Every August evening we gathered in the square and the eldest would sing the song of the river — the same song their grandmothers sang before the bridge was built in 1932.",
    place: "Old Stone Bridge", lat: 39.7667, lng: 20.9667,
    category: "folklore", people: ["Eleni V.", "the village choir"], year: 1932,
  },
  {
    raw: "Ο παππούς μου έφτιαχνε καμπάνα για τα πρόβατα. Χτυπούσε το χαλκό με σφυρί μέχρι να ακουστεί σε όλο το βουνό...",
    lang_code: "el",
    en: "My grandfather cast bells for the sheep, hammering the bronze until its ring could be heard across the whole mountain. Each bell had a voice of its own.",
    place: "Bell Founders' Lane", lat: 39.7695, lng: 21.1797,
    category: "crafts_music", people: ["grandfather Dimitris"], year: 1954,
  },
  {
    raw: "Την Μεγάλη Πέμπτη ψήναμε το ψωμί με το κόκκινο αυγό στη χόβολη...",
    lang_code: "el",
    en: "On Holy Thursday we baked bread with red-dyed eggs pressed into the crust, right on the embers. The whole village smelled of mastic and orange peel.",
    place: "Panagia Square", lat: 35.3333, lng: 25.1333,
    category: "cuisine", people: ["yiayia Maria"], year: 1968,
  },
];

function mockResult(durationSec: number, aiError?: string) {
  const mock = MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
  return {
    mode: "mock" as const,
    ai_error: aiError,
    pipeline: [
      { stage: "speech_to_text", model: "whisper-large-v3 (mock)", confidence: 0.94, ms: 690 },
      { stage: "translate", model: "gpt-4o-mini (mock)", target: "en", confidence: 0.97, ms: 210 },
      { stage: "structure", model: "cultory-structurer (mock)", confidence: 0.91, ms: 180 },
    ],
    transcript_raw: mock.raw,
    language_detected: mock.lang_code,
    language_label: langLabel(mock.lang_code),
    translation_en: mock.en,
    suggested: {
      title: `${mock.place} — ${mock.category.replace("_", " ")}`,
      category: mock.category,
      place_name: mock.place,
      geotag: { lat: mock.lat, lng: mock.lng },
      people: mock.people,
      era: mock.year,
      duration_sec: durationSec,
    },
    needs_review: true,
  };
}

const structuredSchema = z.object({
  translation_en: z.string().min(1),
  title: z.string().min(1).max(120),
  category: z
    .enum(["oral_history", "crafts_music", "cuisine", "folklore", "rituals", "nature_wisdom"])
    .catch("oral_history"),
  place_name: z.string().min(1).catch("Unknown place"),
  lat: z.number().nullable().catch(null),
  lng: z.number().nullable().catch(null),
  era_year: z.number().nullable().catch(null),
  people: z.array(z.string()).catch([]),
});

const CURATOR_PROMPT = `You are Cultory's heritage curator. An elderly contributor told a story in their own language.
Return STRICT JSON only (no markdown) with this shape:
{
  "translation_en": "faithful, natural English translation of the whole story",
  "title": "short evocative English title, max 60 chars",
  "category": one of ["oral_history","crafts_music","cuisine","folklore","rituals","nature_wisdom"],
  "place_name": "the most specific place (village, landmark, street) the story is tied to",
  "lat": number or null,
  "lng": number or null,
  "era_year": number or null (the year/decade the story is set in),
  "people": ["names or roles of people mentioned"]
}
For lat/lng give your best-guess coordinates for place_name; use null if truly unknown.`;

async function transcribeWithAI(audio: { buffer: Buffer; mimetype: string; originalname?: string }) {
  // 1) Speech-to-text (Whisper-compatible endpoint)
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new Uint8Array(audio.buffer)], { type: audio.mimetype || "audio/webm" }),
    audio.originalname || "story.webm"
  );
  fd.append("model", STT_MODEL);
  fd.append("response_format", "verbose_json");

  const sttRes = await fetch(`${AI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${AI_KEY}` },
    body: fd,
    signal: AbortSignal.timeout(55_000),
  });
  if (!sttRes.ok)
    throw new Error(`STT failed (${sttRes.status}): ${(await sttRes.text()).slice(0, 300)}`);
  const stt = (await sttRes.json()) as { text?: string; language?: string; duration?: number };
  const transcript = (stt.text || "").trim();
  if (!transcript) throw new Error("Speech-to-text returned an empty transcript");

  // 2) Translate + structure with a chat model
  const chatRes = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${AI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CURATOR_PROMPT },
        { role: "user", content: `Transcript:\n${transcript}` },
      ],
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!chatRes.ok)
    throw new Error(`Structuring failed (${chatRes.status}): ${(await chatRes.text()).slice(0, 300)}`);
  const chat = (await chatRes.json()) as any;
  const parsed = structuredSchema.parse(JSON.parse(chat.choices?.[0]?.message?.content ?? "{}"));

  return { transcript, sttLang: stt.language, sttDuration: stt.duration, parsed };
}

router.post(
  "/transcribe",
  requireAuth,
  requireRole("elder", "guide", "super_admin"),
  upload.single("audio"),
  async (req, res) => {
    const sessionId = String(req.body?.session_id || "");
    const durationSec = Math.min(Number(req.body?.duration_sec) || 45, 3600);
    if (!sessionId.startsWith("ivw_"))
      return res.status(400).json({ error: "Unknown interview session" });
    const audio = (req as any).file as
      | { buffer: Buffer; mimetype: string; originalname?: string; size: number }
      | undefined;

    // Demo mode: no audio uploaded or no AI key configured
    if (!audio || !AI_KEY) {
      await new Promise((r) => setTimeout(r, 700));
      db.prepare(`UPDATE interview_sessions SET stage='structured' WHERE id=?`).run(sessionId);
      return res.json(mockResult(durationSec, audio ? undefined : "no audio"));
    }

    try {
      const { transcript, sttLang, sttDuration, parsed } = await transcribeWithAI(audio);
      db.prepare(`UPDATE interview_sessions SET stage='structured' WHERE id=?`).run(sessionId);
      res.json({
        mode: "ai" as const,
        pipeline: [
          { stage: "speech_to_text", model: STT_MODEL, confidence: null, ms: null },
          { stage: "translate", model: CHAT_MODEL, target: "en", confidence: null, ms: null },
          { stage: "structure", model: CHAT_MODEL, confidence: null, ms: null },
        ],
        transcript_raw: transcript,
        language_detected: sttLang || null,
        language_label: langLabel(sttLang),
        translation_en: parsed.translation_en,
        suggested: {
          title: parsed.title,
          category: parsed.category,
          place_name: parsed.place_name,
          geotag: { lat: parsed.lat, lng: parsed.lng },
          people: parsed.people,
          era: parsed.era_year,
          duration_sec: Math.round(sttDuration || durationSec),
        },
        needs_review: true,
      });
    } catch (err: any) {
      console.error("[interview] AI pipeline failed:", err?.message);
      // Keep the elder's flow unbroken: fall back to the demo pipeline.
      res.json(mockResult(durationSec, err?.message?.slice(0, 300)));
    }
  }
);

export default router;
