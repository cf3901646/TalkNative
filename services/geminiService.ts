import { GoogleGenAI, Type } from "@google/genai";
import { DialogueLine, LessonData } from "../types";

// ==========================================
// 🔴 用户配置的 API Key
// ==========================================
const MANUAL_API_KEY = "AIzaSyBZFQ4ldD-5lKTNu4I2KresXZpH_oKwjco";

// Helper to get safe API key
const getApiKey = (): string => {
  // 1. 优先使用手动配置的 Key
  if (MANUAL_API_KEY && MANUAL_API_KEY.trim().length > 0) {
    return MANUAL_API_KEY;
  }

  try {
    // 2. Check Vite environment variables (standard for React/Vite apps)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
      // @ts-ignore
      if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
    }
  } catch (e) {
    // Ignore errors checking import.meta
  }

  try {
    // 3. Check process.env (Node.js / Standard environments)
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    console.warn("Error accessing process.env", e);
  }
  
  return ""; 
};

// Export a checker so UI knows we are ready
export const hasValidApiKey = (): boolean => {
  return !!getApiKey();
};

// Generate random topic suggestions
export const generateTopicSuggestions = async (count: number, avoidTopics: string[]): Promise<string[]> => {
  const key = getApiKey();
  if (!key) return []; // Fail silently for suggestions, don't crash app

  const ai = new GoogleGenAI({ apiKey: key });
  
  // Use a smaller context of recently seen topics to avoid repetition
  const avoidContext = avoidTopics.slice(-30).join("; ");
  
  const prompt = `
    Generate ${count} creative, specific, and diverse conversation scenarios for English listening practice.
    
    CRITICAL REQUIREMENTS:
    1. **Language**: The topic descriptions MUST be in **Simplified Chinese** (Mandarin).
    2. **Content**: Scenes should be realistic (work, travel, social, emergency, academic, daily life).
    3. **Specificity**: Topics should be specific (e.g., use "解释简历上的空窗期" instead of just "面试", use "投诉餐厅上菜慢" instead of "在餐厅").
    4. **Diversity**: Ensure topics are significantly different from the "Avoid" list.
    
    ${avoidContext ? `AVOID these recently used topics: ${avoidContext}` : ""}
    
    Return ONLY a JSON array of strings. Example: ["向邻居投诉噪音问题", "在海关回答签证问题"]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as string[];
  } catch (e) {
    console.error("Failed to fetch topics", e);
    return [];
  }
};

// Generate the script content
export const generateLessonScript = async (topic: string): Promise<LessonData> => {
  const key = getApiKey();
  if (!key) {
    throw new Error("API Key is missing. Please check your configuration.");
  }

  const ai = new GoogleGenAI({ apiKey: key });

  const prompt = `
    Create a highly natural, native-level English conversation script between two friends (Alex and Jordan) about: "${topic}".
    The conversation should be comprehensive and last approximately 5-10 minutes in spoken duration (aim for 50-70 exchanges).
    
    CRITICAL REQUIREMENTS:
    1. Use contemporary American English with natural flow, interjections (like "you know", "like", "I mean"), and contractions.
    2. Include at least 12-15 specific idioms, phrasal verbs, or slang terms that are useful for advanced learners.
    3. The conversation must have depth, nuance, and emotional engagement. Avoid robotic or textbook-style dialogue.
    4. Provide a Mandarin Chinese translation for each line.
    5. **Idiom Analysis**: For each idiom, provide a simple **English definition** AND a concise **Chinese translation/explanation**.

    Output STRICT JSON matching this schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          lines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                speaker: { type: Type.STRING, enum: ["Alex", "Jordan"] },
                english: { type: Type.STRING },
                chinese: { type: Type.STRING },
                idioms: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      phrase: { type: Type.STRING },
                      definition: { type: Type.STRING },
                      translation: { type: Type.STRING },
                      usage: { type: Type.STRING },
                    },
                    required: ["phrase", "definition", "translation", "usage"]
                  }
                }
              },
              required: ["id", "speaker", "english", "chinese", "idioms"]
            }
          }
        },
        required: ["topic", "lines"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  try {
    const parsed = JSON.parse(text);
    // Inject ID and Timestamp for persistence
    return {
      ...parsed,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    } as LessonData;
  } catch (e) {
    console.error("Failed to parse JSON", e);
    throw new Error("Failed to parse lesson data");
  }
};