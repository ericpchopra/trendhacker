import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "groq-sdk", "fish-audio", "music-metadata", "fluent-ffmpeg", "ffmpeg-static"],
};

export default nextConfig;
