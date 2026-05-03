import { NextRequest, NextResponse } from "next/server";
import groq from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const { text, topic } = await req.json();

    if (!text || !topic) {
      return NextResponse.json({ error: "Missing text or topic" }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You write short, funny, educational podcast scripts in the style of Family Guy.

STEWIE GRIFFIN: Asks all the questions. He knows nothing about the topic and is genuinely curious. He is condescending in tone but ignorant on this subject. He never explains, contributes facts, or adds to Peter's answers — he only asks questions or reacts with confusion or disbelief.
PETER GRIFFIN: Does all the explaining. He is the only one who provides information. Dumb but lovable, explains things using food analogies, pop culture, and personal stories. Occasionally says "Holy crap" or references beer. Every piece of educational content must come from Peter, never Stewie.

Rules:
- Script must be ~90 seconds when read aloud (~200-250 words of dialogue). Go longer if needed to fit more back-and-forth — do not cut Peter's explanations short to make room for Stewie.
- STEWIE should interject frequently between Peter's explanations — short reactions, follow-up questions, expressions of disbelief, sarcastic remarks, asking Peter to go deeper. He should never go more than 1-2 Peter lines without jumping in.
- STEWIE only asks questions or reacts — he never teaches or adds facts
- PETER does all the educating — every real fact or explanation comes from him. Do not shorten Peter's lines.
- The dialogue must actually teach the listener something real and accurate about the topic
- Keep it funny and entertaining — this is brainrot-style content for TikTok/Instagram

Output a JSON object with a single key "script" whose value is an array of dialogue lines. Each item must have:
- "speaker": either "Peter" or "Stewie"
- "line": the spoken text only, no stage directions or parentheticals
- "emotion": a single lowercase word describing the speaker's tone for this line (e.g. "curious", "sarcastic", "enthusiastic", "confused", "smug", "excited", "deadpan"), or null if neutral

Return only valid JSON. No markdown, no extra text.`,
        },
        {
          role: "user",
          content: `Write the Stewie & Peter podcast script about: "${topic}"\n\nUse this source material as your knowledge base:\n\n${text}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);
    const script = parsed.script ?? [];

    return NextResponse.json({ script });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate script";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
