import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import ffmpegModule from "fluent-ffmpeg";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegBin = require("ffmpeg-static") as string | null;
if (ffmpegBin) ffmpegModule.setFfmpegPath(ffmpegBin);

export const maxDuration = 300;

type TimelineEntry = {
  speaker: string;
  line: string;
  audio: string;
  start: number;
  duration: number;
};

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { timeline }: { timeline: TimelineEntry[] } = await req.json();

    if (!Array.isArray(timeline) || timeline.length === 0) {
      return NextResponse.json({ error: "No timeline provided" }, { status: 400 });
    }

    const totalDuration = timeline.reduce(
      (acc, entry) => Math.max(acc, entry.start + entry.duration),
      0
    );

    const publicDir   = path.join(process.cwd(), "public");
    const minecraftVideo = path.join(
      publicDir, "minecraft",
      "Minecraft Parkour 7 Minutes Free To Use Gameplay 4K 65 - GameplaysForFree (1080p).mp4"
    );
    const stewieImg  = path.join(publicDir, "stewie", "stewie.png");
    const peterImg   = path.join(publicDir, "peter",  "peter.png");
    const outputPath = path.join(publicDir, "output.mp4");

    await fs.unlink(outputPath).catch(() => {});

    // Show each character only while they are speaking
    const makeCondition = (speaker: string) =>
      timeline
        .filter(e => e.speaker === speaker)
        .map(e => `between(t,${e.start.toFixed(3)},${(e.start + e.duration).toFixed(3)})`)
        .join("+") || "0";

    const stewieOn = makeCondition("Stewie");
    const peterOn  = makeCondition("Peter");

    // Audio inputs start at index 3 (0=video, 1=stewie, 2=peter)
    const delayFilters = timeline.map(
      (entry, i) =>
        `[${i + 3}:a]adelay=${Math.round(entry.start * 1000)}|${Math.round(entry.start * 1000)}[a${i}]`
    );
    const mixLabels = timeline.map((_, i) => `[a${i}]`).join("");

    const filterParts = [
      // Scale to portrait height first, then centre-crop width → 1080×1920
      "[0:v]scale=-2:1920,crop=1080:1920:(iw-1080)/2:0[bg]",
      "[1:v]scale=220:-1[stewie_img]",
      "[2:v]scale=220:-1[peter_img]",
      `[bg][stewie_img]overlay=x=40:y=H-h-40:enable='${stewieOn}'[v1]`,
      `[v1][peter_img]overlay=x=W-w-40:y=H-h-40:enable='${peterOn}'[v2]`,
      "[v2]null[vout]",
      ...delayFilters,
      `${mixLabels}amix=inputs=${timeline.length}:duration=longest:normalize=0[aout]`,
    ];

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpegModule();

      cmd.input(minecraftVideo);
      cmd.input(stewieImg);
      cmd.input(peterImg);
      for (const entry of timeline) {
        cmd.input(path.join(publicDir, entry.audio.replace(/^\//, "")));
      }

      cmd
        .complexFilter(filterParts.join(";"))
        .outputOptions([
          "-map [vout]",
          "-map [aout]",
          `-t ${totalDuration}`,
          "-c:v libx264",
          "-preset ultrafast",
          "-crf 23",
          "-c:a aac",
          "-b:a 192k",
          "-movflags +faststart",
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    return NextResponse.json({ videoUrl: `/output.mp4?t=${Date.now()}` });
  } catch (err) {
    console.error("Render error:", err);
    const message = err instanceof Error ? err.message : "Failed to render video";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
