import { NextRequest } from "next/server";
import { FishAudioClient } from "fish-audio";
import { parseBuffer } from "music-metadata";
import fs from "fs/promises";
import path from "path";

export const maxDuration = 300;

const VOICE_IDS = {
  Peter: "d75c270eaee14c8aa1e9e980cc37cf1b",
  Stewie: "fdffd3722cd040fcb3f95eec5a7f29f3",
};

const client = new FishAudioClient({ apiKey: process.env.FISH_AUDIO_API_KEY });

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function POST(req: NextRequest) {
  const { script } = await req.json();

  if (!Array.isArray(script) || script.length === 0) {
    return new Response(JSON.stringify({ type: "error", message: "No script provided" }), { status: 400 });
  }

  const audioDir = path.join(process.cwd(), "public", "audio");
  await fs.rm(audioDir, { recursive: true, force: true });
  await fs.mkdir(audioDir, { recursive: true });

  const enc = new TextEncoder();
  const enq = (controller: ReadableStreamDefaultController, obj: object) =>
    controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const timeline = [];
        let currentStart = 0;

        for (let i = 0; i < script.length; i++) {
          const { speaker, line, emotion } = script[i];
          const text = emotion ? `(${emotion}) ${line}` : line;
          const referenceId = VOICE_IDS[speaker as keyof typeof VOICE_IDS];

          const ttsStream = await client.textToSpeech.convert(
            { text, reference_id: referenceId, format: "mp3" },
            "s1"
          );

          const buffer = await streamToBuffer(ttsStream);
          const filename = `line_${i}.mp3`;
          await fs.writeFile(path.join(audioDir, filename), buffer);

          const metadata = await parseBuffer(buffer, { mimeType: "audio/mpeg" });
          const duration = metadata.format.duration ?? 0;

          timeline.push({
            speaker,
            line: script[i].line,
            audio: `/audio/${filename}`,
            start: Math.round(currentStart * 1000) / 1000,
            duration: Math.round(duration * 1000) / 1000,
          });

          currentStart += duration;
          enq(controller, { type: "progress", current: i + 1, total: script.length });
        }

        enq(controller, { type: "done", timeline });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate audio";
        enq(controller, { type: "error", message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
