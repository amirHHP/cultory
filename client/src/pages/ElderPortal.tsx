import { useEffect, useRef, useState } from "react";
import { api, getToken } from "../api";
import { CATEGORY_LABELS } from "../types";

interface Prompt { id: string; text: string; icon: string }
interface TranscribeResult {
  mode: "ai" | "mock";
  ai_error?: string;
  pipeline: { stage: string; model: string; confidence: number | null; ms: number | null }[];
  transcript_raw: string;
  language_detected: string | null;
  language_label: string;
  translation_en: string;
  suggested: {
    title: string;
    category: string;
    place_name: string;
    geotag: { lat: number | null; lng: number | null };
    people: string[];
    era: number | null;
    duration_sec: number;
  };
}

type Phase = "choose" | "record" | "processing" | "review" | "saved";

const PIPELINE_STEPS = [
  ["speech_to_text", "🎙️ Transcribing your voice"],
  ["translate", "🌍 Translating to English"],
  ["structure", "📍 Structuring & geotagging the story"],
] as const;

const MAX_RECORD_MS = 5 * 60 * 1000; // serverless upload limit safety

export default function ElderPortal() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [engine, setEngine] = useState<"ai" | "mock">("mock");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const [form, setForm] = useState({ title: "", category: "folklore", place_name: "" });

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    api<{ prompts: Prompt[]; engine: "ai" | "mock" }>("/interview/prompts")
      .then((r) => { setPrompts(r.prompts); setEngine(r.engine); })
      .catch(() => {});
    return () => {
      if (timer.current) clearInterval(timer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startInterview = async () => {
    setMicError(null);
    setSaveError(null);
    const res = await api<{ session_id: string }>("/interview/session", { method: "POST" });
    setSessionId(res.session_id);
    setSeconds(0);
    setPhase("record");
  };

  const beginRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (m) => MediaRecorder.isTypeSupported(m)
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = onRecorderStop;
      rec.start(1000);
      recorderRef.current = rec;
      setRecording(true);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      // safety auto-stop
      setTimeout(() => {
        if (recorderRef.current?.state === "recording") stopRecording();
      }, MAX_RECORD_MS);
    } catch (e: any) {
      setMicError(
        e?.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser, or continue in demo mode below."
          : "No microphone was found. You can still continue in demo mode."
      );
    }
  };

  const stopRecording = () => {
    if (timer.current) clearInterval(timer.current);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setRecording(false);
    } else {
      processAudio(null);
    }
  };

  const onRecorderStop = () => {
    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || "audio/webm" });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    processAudio(blob.size > 0 ? blob : null);
  };

  const processAudio = async (blob: Blob | null) => {
    setPhase("processing");
    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      setStepIdx(i);
      await new Promise((r) => setTimeout(r, 500));
    }
    try {
      const fd = new FormData();
      fd.append("session_id", sessionId!);
      fd.append("duration_sec", String(Math.max(seconds, 5)));
      if (blob) fd.append("audio", blob, "story.webm");
      const res = await fetch("/api/interview/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Transcription failed");
      setResult(data as TranscribeResult);
      setForm({
        title: data.suggested.title,
        category: CATEGORY_LABELS[data.suggested.category] ? data.suggested.category : "folklore",
        place_name: data.suggested.place_name,
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
          language: result.language_detected || "und",
          place_name: form.place_name || result.suggested.place_name,
          lat: result.suggested.geotag?.lat ?? undefined,
          lng: result.suggested.geotag?.lng ?? undefined,
          duration_sec: Math.max(seconds, 5),
        },
      });
      setPhase("saved");
    } catch (e: any) {
      setSaveError(e.details ? Object.values(e.details).flat().join(" · ") : e.message);
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
    setMicError(null);
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="elder-wrap">
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <h1 className="elder-huge">🎙️ Story Studio</h1>
        <p style={{ color: "var(--muted)", fontSize: 18, marginTop: 8 }}>
          Talk with our AI interviewer. Your memories become part of your village's living history.
        </p>
        <span className={`badge ${engine === "ai" ? "green" : ""}`} style={{ marginTop: 10 }}>
          {engine === "ai" ? "⚡ Live AI engine connected" : "🧪 Demo engine — no AI key configured"}
        </span>
      </div>

      {phase === "choose" && (
        <div style={{ display: "grid", gap: 14 }}>
          <button className="elder-big-btn primary" onClick={startInterview}>
            <span style={{ fontSize: 34 }}>🎤</span> Record my story (uses microphone)
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
          {!recording && micError && <div className="error-box" style={{ marginTop: 14 }}>{micError}</div>}
          {recording ? (
            <>
              <div
                className="mic-orb recording"
                onClick={stopRecording}
                role="button"
                aria-label="Stop recording"
              >
                ⏹
              </div>
              <div className="rec-timer">{mmss}</div>
              <button className="btn btn-ghost btn-lg" onClick={stopRecording} style={{ marginTop: 22, width: "100%" }}>
                ✅ I'm finished — process my story
              </button>
            </>
          ) : (
            <>
              <div className="mic-orb" onClick={beginRecording} role="button" aria-label="Start recording">
                🎤
              </div>
              {micError && (
                <button className="btn btn-ghost btn-lg" onClick={() => processAudio(null)} style={{ width: "100%" }}>
                  ▶ Continue in demo mode (no microphone)
                </button>
              )}
              {!micError && (
                <button className="btn btn-primary btn-lg" onClick={beginRecording} style={{ width: "100%" }}>
                  Start recording
                </button>
              )}
            </>
          )}
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
          {result.mode === "mock" && result.ai_error && result.ai_error !== "no audio" && (
            <div className="error-box">AI engine unavailable ({result.ai_error}) — showing demo data instead.</div>
          )}
          <div className="glass card">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <h2 className="elder-huge" style={{ fontSize: 26 }}>✨ We heard this story</h2>
              <span className={`badge ${result.mode === "ai" ? "green" : ""}`}>
                {result.mode === "ai" ? `⚡ ${result.pipeline[0].model}` : "🧪 demo engine"}
              </span>
            </div>
            <p style={{ fontSize: 19, marginTop: 14, lineHeight: 1.6 }}>{result.translation_en}</p>
            <p style={{ color: "var(--muted)", fontSize: 17, marginTop: 14, fontStyle: "italic" }}>
              “{result.transcript_raw}”
            </p>
            <div style={{ marginTop: 8 }}>
              <span className="badge accent">🌍 Original · {result.language_label}</span>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge accent">📍 {result.suggested.place_name}</span>
              {result.suggested.era && <span className="badge">🗓️ around {result.suggested.era}</span>}
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
