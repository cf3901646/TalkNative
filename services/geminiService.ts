import { LessonData } from "../types";

export const hasValidApiKey = (): boolean => {
  // Authentication is now safely pushed to backend.
  // Frontend is always ready to connect to gateway.
  return true;
};

export const generateTopicSuggestions = async (count: number, avoidTopics: string[]): Promise<string[]> => {
  const avoidContext = avoidTopics.slice(-30).join("; ");
  const message = `Generate ${count} scenarios.\n${avoidContext ? `AVOID these recently used topics: ${avoidContext}` : ""}`;

  try {
    const response = await fetch("http://localhost:8000/api/topics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) throw new Error("Backend API Error");

    const data = await response.json();
    // PromptFortress returns JSON string under `reply` field when not streaming
    return JSON.parse(data.reply);
  } catch (e) {
    console.warn("Failed to fetch topics from backend gateway", e);
    return [];
  }
};

export const generateLessonScript = async (topic: string): Promise<LessonData> => {
  const message = `Topic to discuss: "${topic}"`;

  try {
    const response = await fetch("http://localhost:8000/api/script", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) throw new Error("Backend API Error");

    const data = await response.json();
    const parsed = JSON.parse(data.reply);

    // Add UUIDs
    return {
      ...parsed,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    } as LessonData;
  } catch (e) {
    console.error("Failed to fetch/parse script from backend gateway", e);
    throw new Error("Failed to parse lesson data");
  }
};
