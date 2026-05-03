"use client";

import { useState } from "react";
import Image from "next/image";

type ScriptLine = {
  speaker: "Peter" | "Stewie";
  line: string;
  emotion: string | null;
};

type TimelineEntry = {
  speaker: string;
  line: string;
  audio: string;
  start: number;
  duration: number;
};

type Step = "idle" | "parsing" | "topics" | "generating" | "done";

async function readNDJSON(res: Response, onMessage: (msg: Record<string, unknown>) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      if (line.trim()) onMessage(JSON.parse(line));
    }
  }
  if (buf.trim()) onMessage(JSON.parse(buf));
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5 mt-2 overflow-hidden">
      <div
        className="h-1.5 rounded-full transition-all duration-300"
        style={{
          width: `${percent}%`,
          background: "linear-gradient(90deg, #818cf8, #c084fc)",
        }}
      />
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("idle");
  const [parsedText, setParsedText] = useState<string>("");
  const [topics, setTopics] = useState<string[]>([]);
  const [script, setScript] = useState<ScriptLine[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [audioProgress, setAudioProgress] = useState<{ current: number; total: number } | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStep("parsing");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const parseRes = await fetch("/api/parse", { method: "POST", body: formData });
      const parseJson = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseJson.error ?? "Failed to parse PDF");
      const text: string = parseJson.text;
      setParsedText(text);
      const topicsRes = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const topicsJson = await topicsRes.json();
      if (!topicsRes.ok) throw new Error(topicsJson.error ?? "Failed to extract topics");
      setTopics(topicsJson.topics);
      setStep("topics");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("idle");
    }
  }

  async function handleTopicSelect(topic: string) {
    setError(null);
    setStep("generating");
    try {
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: parsedText, topic }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate script");
      setScript(json.script);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("topics");
    }
  }

  async function handleGenerate() {
    setError(null);
    setAudioProgress(null);
    setVideoProgress(null);
    let currentTimeline = timeline;

    if (!currentTimeline) {
      setGeneratingAudio(true);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.message ?? "Failed to generate audio");
        }
        await readNDJSON(res, (msg) => {
          if (msg.type === "progress") {
            setAudioProgress({ current: msg.current as number, total: msg.total as number });
          } else if (msg.type === "done") {
            currentTimeline = msg.timeline as TimelineEntry[];
            setTimeline(currentTimeline);
          } else if (msg.type === "error") {
            throw new Error(msg.message as string);
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setGeneratingAudio(false);
        setAudioProgress(null);
        return;
      }
      setGeneratingAudio(false);
      setAudioProgress(null);
    }

    setGeneratingVideo(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline: currentTimeline }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message ?? "Failed to render video");
      }
      await readNDJSON(res, (msg) => {
        if (msg.type === "progress") {
          setVideoProgress(msg.percent as number);
        } else if (msg.type === "done") {
          setVideoUrl(msg.videoUrl as string);
        } else if (msg.type === "error") {
          throw new Error(msg.message as string);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setGeneratingVideo(false);
    setVideoProgress(null);
  }

  function reset() {
    setStep("idle");
    setParsedText("");
    setTopics([]);
    setScript([]);
    setTimeline(null);
    setVideoUrl(null);
    setError(null);
    setScriptOpen(false);
    setAudioProgress(null);
    setVideoProgress(null);
  }

  const busy = generatingAudio || generatingVideo;

  function generateLabel() {
    if (generatingAudio) return "Generating audio...";
    if (generatingVideo) return "Rendering video...";
    return "Generate video";
  }

  return (
    <div className="min-h-screen" style={{ background: "#0d0d0f", color: "#e8e8f0" }}>
      {/* Header */}
      <header
        className="border-b px-8 py-6 flex flex-col items-center justify-center gap-3"
        style={{ borderColor: "#1e1e2e", background: "#0d0d0f" }}
      >
        <div className="flex items-center gap-4">
          <Image
            src="/peter/peter.png"
            alt="Peter Griffin"
            width={64}
            height={64}
            className="rounded-full object-cover"
            style={{ border: "2px solid #4f46e5" }}
          />
          <h1
            className="text-5xl font-extrabold tracking-tight leading-none"
            style={{
              background: "linear-gradient(90deg, #818cf8, #c084fc)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            GriffinGPT
          </h1>
        </div>
        <p className="text-base" style={{ color: "#6b6b8a" }}>
          Made by Piyush Chopra and Sidak Sethi
        </p>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* Subheading */}
        <p className="text-sm mb-10" style={{ color: "#6b6b8a" }}>
          Upload a PDF → pick a topic → watch Peter and Stewie explain it
        </p>

        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-lg text-sm"
            style={{ background: "#2a0a0a", border: "1px solid #7f1d1d", color: "#fca5a5" }}
          >
            {error}
          </div>
        )}

        {step === "idle" && (
          <label
            className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all duration-200"
            style={{
              border: "2px dashed #2e2e4e",
              background: "#11111b",
              padding: "56px 24px",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "#4f46e5")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "#2e2e4e")}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4 text-2xl"
              style={{ background: "#1e1e3f" }}
            >
              📄
            </div>
            <p className="text-sm font-medium" style={{ color: "#a5a5c0" }}>
              Drop your PDF here or <span style={{ color: "#818cf8" }}>browse</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "#4a4a6a" }}>PDF files only</p>
            <input type="file" accept="application/pdf" onChange={handleUpload} className="hidden" />
          </label>
        )}

        {step === "parsing" && (
          <div className="flex items-center gap-3" style={{ color: "#6b6b8a" }}>
            <span className="animate-spin text-lg">⚙️</span>
            <span className="text-sm">Parsing PDF and extracting topics...</span>
          </div>
        )}

        {step === "topics" && (
          <div>
            <p className="text-sm font-semibold mb-4" style={{ color: "#a5a5c0" }}>
              Pick a topic for your video:
            </p>
            <div className="flex flex-col gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleTopicSelect(topic)}
                  className="text-left px-4 py-3 rounded-xl text-sm transition-all duration-150"
                  style={{
                    background: "#11111b",
                    border: "1px solid #2e2e4e",
                    color: "#c5c5e0",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "#4f46e5";
                    e.currentTarget.style.background = "#1a1a2e";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "#2e2e4e";
                    e.currentTarget.style.background = "#11111b";
                  }}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="flex items-center gap-3" style={{ color: "#6b6b8a" }}>
            <span className="animate-spin text-lg">✨</span>
            <span className="text-sm">Stewie and Peter are cooking up your script...</span>
          </div>
        )}

        {step === "done" && (
          <div>
            {/* Collapsible script */}
            <button
              onClick={() => setScriptOpen(o => !o)}
              className="flex items-center gap-2 mb-4 text-sm font-semibold transition-colors"
              style={{ color: "#6b6b8a" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#a5a5c0")}
              onMouseLeave={e => (e.currentTarget.style.color = "#6b6b8a")}
            >
              <span
                className="inline-block transition-transform duration-200 text-xs"
                style={{ transform: scriptOpen ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                ▶
              </span>
              Script ({script.length} lines)
            </button>

            {scriptOpen && (
              <div
                className="flex flex-col gap-2 mb-6 rounded-xl p-4 max-h-72 overflow-y-auto"
                style={{ background: "#11111b", border: "1px solid #1e1e2e" }}
              >
                {script.map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 px-3 py-2 rounded-lg"
                    style={{
                      background: item.speaker === "Stewie" ? "#0f172a" : "#1a120a",
                      border: `1px solid ${item.speaker === "Stewie" ? "#1e3a5f" : "#3d2008"}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: item.speaker === "Stewie" ? "#60a5fa" : "#fb923c" }}
                      >
                        {item.speaker}
                      </span>
                      {item.emotion && (
                        <span className="text-xs italic" style={{ color: "#4a4a6a" }}>
                          {item.emotion}
                        </span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: "#c5c5e0" }}>{item.line}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleGenerate}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  color: "#fff",
                  boxShadow: "0 0 20px rgba(79,70,229,0.35)",
                }}
              >
                {generateLabel()}
              </button>
              <button
                onClick={() => setStep("topics")}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl text-sm transition-all duration-150 disabled:opacity-40"
                style={{
                  background: "#11111b",
                  border: "1px solid #2e2e4e",
                  color: "#a5a5c0",
                }}
              >
                Pick different topic
              </button>
              <button
                onClick={reset}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl text-sm transition-all duration-150 disabled:opacity-40"
                style={{
                  background: "#11111b",
                  border: "1px solid #2e2e4e",
                  color: "#a5a5c0",
                }}
              >
                Upload new PDF
              </button>
            </div>

            {/* Progress */}
            {generatingAudio && audioProgress && (
              <div className="mt-5 max-w-sm">
                <p className="text-xs" style={{ color: "#6b6b8a" }}>
                  Generating audio clips ({audioProgress.current} / {audioProgress.total})
                </p>
                <ProgressBar percent={Math.round((audioProgress.current / audioProgress.total) * 100)} />
              </div>
            )}
            {generatingVideo && (
              <div className="mt-5 max-w-sm">
                <p className="text-xs" style={{ color: "#6b6b8a" }}>
                  Rendering video{videoProgress !== null ? ` — ${videoProgress}%` : "..."}
                </p>
                {videoProgress !== null && <ProgressBar percent={videoProgress} />}
              </div>
            )}

            {/* Video output */}
            {videoUrl && !busy && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <video
                  src={videoUrl}
                  controls
                  className="rounded-2xl"
                  style={{
                    width: "280px",
                    aspectRatio: "9/16",
                    border: "1px solid #2e2e4e",
                    background: "#000",
                  }}
                />
                <a
                  href={videoUrl}
                  download="griffin-gpt.mp4"
                  className="text-xs font-medium transition-colors"
                  style={{ color: "#818cf8" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#c084fc")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#818cf8")}
                >
                  Download video
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
