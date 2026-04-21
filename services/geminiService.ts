import { LessonData } from "../types";

const cleanAndParseJSON = (text: string) => {
  try {
    const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(clean);
  } catch (err: any) {
    throw new Error(`JSON Parsing failed. Raw text snippet: ${text.substring(0, 50)}... Error: ${err.message}`);
  }
};

export const hasValidApiKey = (): boolean => {
  return true;
};

export const generateTopicSuggestions = async (count: number, avoidTopics: string[]): Promise<string[]> => {
  const avoidContext = avoidTopics.slice(-30).join("; ");
  const message = `Generate ${count} scenarios.\n${avoidContext ? `AVOID these recently used topics: ${avoidContext}` : ""}`;

  try {
    const response = await fetch("/api/topics", {  // Use relative path for Vercel
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend topic API failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return cleanAndParseJSON(data.reply);
  } catch (e: any) {
    console.error("Topics fetch error:", e);
    throw new Error(`Topic generation error: ${e.message}`);
  }
};

export const generateLessonScript = async (topic: string): Promise<LessonData> => {
  const message = `Topic to discuss: "${topic}"`;

  try {
    const response = await fetch("/api/script", {  // Use relative path for Vercel
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend script API failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.reply) throw new Error(`Backend script API response miss 'reply'. Data: ${JSON.stringify(data)}`);

    const parsed = cleanAndParseJSON(data.reply);

    return {
      ...parsed,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    } as LessonData;
  } catch (e: any) {
    console.error("Script fetch error:", e);
    throw new Error(`Script error: ${e.message}`);
  }
};
