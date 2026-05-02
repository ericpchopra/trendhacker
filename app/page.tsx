"use client";

import { useState } from "react";

export default function Home() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setText(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/parse", { method: "POST", body: formData });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error);
    } else {
      setText(json.text);
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen p-10 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">TrendHacker</h1>

      <input
        type="file"
        accept="application/pdf"
        onChange={handleUpload}
        className="block mb-4"
      />

      {loading && <p className="text-gray-500">Parsing PDF...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {text && (
        <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-4 rounded">
          {text}
        </pre>
      )}
    </main>
  );
}
