import { NextRequest, NextResponse } from "next/server";
import groq from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You extract topics from educational text. Return ONLY a valid JSON object with a single key 'topics' whose value is an array of topic strings. Be exhaustive — list every distinct concept, subject, or theme covered.",
        },
        {
          role: "user",
          content: `Extract all topics from this educational text:\n\n${text}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);
    const topics: string[] = parsed.topics ?? Object.values(parsed)[0] ?? [];

    return NextResponse.json({ topics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to extract topics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
