"use client";

import { useState } from "react";

type ScriptLine = {
  speaker: "Peter" | "Stewie";
  line: string;
  emotion: string | null;
};

type TimelineEntry = {
  speaker: string;
  audio: string;
  start: number;
  duration: number;
};

type Step = "idle" | "parsing" | "topics" | "generating" | "done";

export default function Home() {
  const [step, setStep] = useState<Step>("idle");
  const [parsedText, setParsedText] = useState<string>("");
  const [topics, setTopics] = useState<string[]>([]);
  const [script, setScript] = useState<ScriptLine[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleGenerateAudio() {
    setError(null);
    setGeneratingAudio(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate audio");
      setTimeline(json.timeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
    setGeneratingAudio(false);
  }

  function reset() {
    setStep("idle");
    setParsedText("");
    setTopics([]);
    setScript([]);
    setError(null);
  }

  return (
    <main className="min-h-screen p-10 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">TrendHacker</h1>
      <p className="text-gray-500 mb-8 text-sm">Upload an educational PDF → pick a topic → get a Stewie & Peter podcast script</p>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {step === "idle" && (
        <input
          type="file"
          accept="application/pdf"
          onChange={handleUpload}
          className="block"
        />
      )}

      {step === "parsing" && (
        <p className="text-gray-500">Parsing PDF and extracting topics...</p>
      )}

      {step === "topics" && (
        <div>
          <p className="font-semibold mb-4">Pick a topic for your podcast script:</p>
          <div className="flex flex-col gap-2">
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => handleTopicSelect(topic)}
                className="text-left px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "generating" && (
        <p className="text-gray-500">Stewie and Peter are cooking up your script...</p>
      )}

      {step === "done" && (
        <div>
          <div className="flex flex-col gap-3 mb-6">
            {script.map((item, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 px-4 py-3 rounded-lg ${
                  item.speaker === "Stewie" ? "bg-blue-50 border border-blue-200" : "bg-yellow-50 border border-yellow-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wide ${item.speaker === "Stewie" ? "text-blue-600" : "text-yellow-600"}`}>
                    {item.speaker}
                  </span>
                  {item.emotion && (
                    <span className="text-xs text-gray-400 italic">{item.emotion}</span>
                  )}
                </div>
                <p className="text-sm">{item.line}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerateAudio}
              disabled={generatingAudio}
              className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800 transition-colors text-sm disabled:opacity-50"
            >
              {generatingAudio ? "Generating audio..." : timeline ? "Regenerate audio" : "Generate audio"}
            </button>
            <button
              onClick={() => setStep("topics")}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 transition-colors text-sm"
            >
              Pick a different topic
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 transition-colors text-sm"
            >
              Upload a new PDF
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
