import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text.trim();
}
