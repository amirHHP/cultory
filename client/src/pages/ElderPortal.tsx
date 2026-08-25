import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { CATEGORY_LABELS } from "../types";

interface Prompt { id: string; text: string; icon: string }
interface TranscribeResult {
  pipeline: { stage: string; model: string; confidence: number; ms: number }[];
  transcript_raw: string;
  language_detected: string;
  language_label: string;
  translation_en: string;
  suggested: {
    title: string;
    category: string;
    place_name: string;
    geotag: { lat: number; lng: number };
    people: string[];
    era: number;
    duration_sec: number;
  };
}

type Phase = "choose" | "record" | "processing" | "review" | "saved";

const PIPELINE_STEPS = [
  ["speech_to_text", "🎙️ Transcribing your voice"],
  ["translate", "🌍 Translating to English"],
  ["structure", "📍 Structuring & geotagging the story"],
] as const;

export default function ElderPortal() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState({ title: "", category: "folklore", place_name: "" });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api<{ prompts: Prompt[] }>("/interview/prompts").then((r) => setPrompts(r.prompts));
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const startInterview = async () => {
    const res = await api<{ session_id: string }>("/interview/session", { method: "POST" });
    setSessionId(res.session_id);
    setSeconds(0);
    setPhase("record");
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopAndProcess = async () => {
    if (timer.current) clearInterval(timer.current);
    setPhase("processing");
    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      setStepIdx(i);
      await new Promise((r) => setTimeout(r, 650));
    }
    try {
      const res = await api<TranscribeResult>("/interview/transcribe", {
        method: "POST",
        body: { session_id: sessionId, duration_sec: Math.max(seconds, 5) },
      });
      setResult(res);
      setForm({
        title: res.suggested.title,
        category: CATEGORY_LABELS[res.suggested.category] ? res.suggested.category : "folklore",
        place_name: res.suggested.place_name,
      });
      setPhase("review");
    } catch (e: any) {
      setSaveError(e.message);
      setPhase("review");
    }
  };

  const saveStory = async () => {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api("/stories", {
        method: "POST",
        body: {
          title: form.title || result.suggested.title,
          transcript: result.transcript_raw,
          translation_en: result.translation_en,
          category: form.category,
          language: result.language_detected || "el",
          place_name: form.place_name || result.suggested.place_name,
          lat: result.suggested.geotag.lat,
          lng: result.suggested.geotag.lng,
          duration_sec: Math.max(seconds, 5),
        },
      });
      setPhase("saved");
    } catch (e: any) {
      setSaveError(
        e.details
          ? Object.values(e.details).flat().join(" · ")
          : e.message
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setPhase("choose");
    setResult(null);
    setSeconds(0);
    setStepIdx(0);
    setSaveError(null);
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="elder-wrap">
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <h1 className="elder-huge">🎙️ Story Studio</h1>
        <p style={{ color: "var(--muted)", fontSize: 18, marginTop: 8 }}>
          Talk with our AI interviewer. Your memories become part of your village's living history.
        </p>
      </div>

      {phase === "choose" && (
        <div style={{ display: "grid", gap: 14 }}>
          <button className="elder-big-btn primary" onClick={startInterview}>
            <span style={{ fontSize: 34 }}>▶</span> Start a new interview
          </button>
          {prompts.map((p) => (
            <button key={p.id} className="elder-big-btn" onClick={startInterview}>
              <span style={{ fontSize: 30 }}>{p.icon}</span>
              <span>{p.text}</span>
            </button>
          ))}
        </div>
      )}

      {phase === "record" && (
        <div className="glass card" style={{ textAlign: "center" }}>
          <p className="elder-huge" style={{ marginBottom: 6 }}>Tell us your story</p>
          <p style={{ color: "var(--muted)", fontSize: 19 }}>
            Speak freely. Tap the circle when you are finished.
          </p>
          <div
            className={`mic-orb ${seconds > 0 ? "recording" : ""}`}
            onClick={stopAndProcess}
            role="button"
            aria-label="Stop recording"
          >
            🎤
          </div>
          <div className="rec-timer">{mmss}</div>
          <button className="btn btn-ghost btn-lg" onClick={stopAndProcess} style={{ marginTop: 22, width: "100%" }}>
            ✅ I'm finished — process my story
          </button>
        </div>
      )}

      {phase === "processing" && (
        <div className="glass card">
          <p className="elder-huge" style={{ textAlign: "center", marginBottom: 20 }}>Working on your story…</p>
          <div className="pipeline">
            {PIPELINE_STEPS.map(([id, label], i) => (
              <div key={id} className={`pipeline-step ${i < stepIdx ? "done" : i === stepIdx ? "active" : ""}`}>
                <span>{label}</span>
                {i < stepIdx ? <span className="check">✓</span> : i === stepIdx ? <span className="spinner" /> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "review" && result && (
        <div style={{ display: "grid", gap: 16 }}>
          {saveError && <div className="error-box">{saveError}</div>}
          <div className="glass card">
            <h2 className="elder-huge" style={{ fontSize: 26 }}>✨ We heard this story</h2>
            <p style={{ fontSize: 19, marginTop: 14, lineHeight: 1.6 }}>{result.translation_en}</p>
            <p style={{ color: "var(--muted)", fontSize: 17, marginTop: 14, fontStyle: "italic" }}>
              “{result.transcript_raw}”
            </p>
            <div style={{ marginTop: 8 }}>
              <span className="badge accent">🌍 Original · {result.language_label}</span>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge accent">📍 {result.suggested.place_name}</span>
              <span className="badge">🗓️ around {result.suggested.era}</span>
              <span className="badge green">confidence {(result.pipeline[2].confidence * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="glass card">
            <label className="field" style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 16 }}>Story title</span>
              <input className="input" style={{ fontSize: 20, padding: "16px 18px" }}
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <div className="grid-half">
              <label className="field">
                <span style={{ fontSize: 16 }}>Category</span>
                <select className="input" style={{ fontSize: 18, padding: "16px 18px" }}
                  value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="field">
                <span style={{ fontSize: 16 }}>Place</span>
                <input className="input" style={{ fontSize: 18, padding: "16px 18px" }}
                  value={form.place_name} onChange={(e) => setForm({ ...form, place_name: e.target.value })} />
              </label>
            </div>
            <button className="btn btn-primary btn-lg" disabled={saving} onClick={saveStory} style={{ width: "100%" }}>
              {saving ? "Saving…" : "💾 Save to my village archive"}
            </button>
          </div>
        </div>
      )}

      {phase === "saved" && (
        <div className="glass card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, margin: "12px 0" }}>🎉</div>
          <h2 className="elder-huge">Efharistó! Your story is saved.</h2>
          <p style={{ color: "var(--muted)", fontSize: 18, marginTop: 10 }}>
            It is now part of your municipality's cultural archive and may appear on guided tours.
          </p>
          <button className="btn btn-primary btn-lg" onClick={reset} style={{ marginTop: 24 }}>
            Record another story
          </button>
        </div>
      )}
    </div>
  );
}
