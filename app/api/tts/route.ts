import { NextRequest, NextResponse } from "next/server";
import { FishAudioClient } from "fish-audio";
import { parseBuffer } from "music-metadata";
import fs from "fs/promises";
import path from "path";

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
  try {
    const { script } = await req.json();

    if (!Array.isArray(script) || script.length === 0) {
      return NextResponse.json({ error: "No script provided" }, { status: 400 });
    }

    const audioDir = path.join(process.cwd(), "public", "audio");
    await fs.rm(audioDir, { recursive: true, force: true });
    await fs.mkdir(audioDir, { recursive: true });

    const timeline = [];
    let currentStart = 0;

    for (let i = 0; i < script.length; i++) {
      const { speaker, line, emotion } = script[i];
      const text = emotion ? `(${emotion}) ${line}` : line;
      const referenceId = VOICE_IDS[speaker as keyof typeof VOICE_IDS];

      const stream = await client.textToSpeech.convert({
        text,
        reference_id: referenceId,
        format: "mp3",
      }, "s1");

      const buffer = await streamToBuffer(stream);
      const filename = `line_${i}.mp3`;
      await fs.writeFile(path.join(audioDir, filename), buffer);

      const metadata = await parseBuffer(buffer, { mimeType: "audio/mpeg" });
      const duration = metadata.format.duration ?? 0;

      timeline.push({
        speaker,
        audio: `/audio/${filename}`,
        start: Math.round(currentStart * 1000) / 1000,
        duration: Math.round(duration * 1000) / 1000,
      });

      currentStart += duration;
    }

    return NextResponse.json({ timeline });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
