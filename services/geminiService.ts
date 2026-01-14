import { GoogleGenAI, Type } from "@google/genai";
import { DialogueLine, LessonData } from "../types";

// ==========================================
// 🔴 API Key Pool (Key Rotation)
// ==========================================
const API_KEYS = [
  "AIzaSyCexM5PMxV34DQFPBdzcmPo0Jo1Gk_vECc",
  "AIzaSyDfWB2zpDVWZwph-Wi_t3G_y0vEntT56dE",
  "AIzaSyBVlLsTERlOHDaPVwV3GdbD_i3NF-0bqV0",
  "AIzaSyDP-0RGpEZKjUHav7CP4cUdUnRm5Ny1eEI",
  "AIzaSyAO74npgaYWKs7klR2UlSQ2eN016DFZtLo",
  "AIzaSyBU5Z4n2od0-L1kMazTiXGxvVicNdIi7sg",
  "AIzaSyBZFQ4ldD-5lKTNu4I2KresXZpH_oKwjco",
  "AIzaSyAsYmJi4HmJcnVJDTFK1DF8DnfjRU3ydPw",
  "AIzaSyCJdIafYx7yeYd6U96u7JPmyxD6phlysxA",
  "AIzaSyCvtpuvH36VKkgjQGuIQRwPV64pOmcUKlQ",
  "AIzaSyB1I_Q2NDqFqxWjei0QdNunfIInUvvH_vo",
  "AIzaSyBl-W5rtbeajPlUF3wnJJNWKZ27GDTFxJg",
  "AIzaSyBv5s3UIr0QS4HkVUIVgDMUvt3zPbZWFvU",
  "AIzaSyDLYinf4AnRL1JfFJno1vKLsGqPcBovoR4",
  "AIzaSyD_HocW72xDLX-6nEXIKyc7weXpv8unqwc",
  "AIzaSyBd9LEdj4UOO6mE0nRIKA7bf9GoueH9sKc",
  "AIzaSyCTuvuXhkqV9Ct8CYQRuHDzO4K9UG1Sazk"
];

let currentKeyIndex = 0;

// Helper to get current API key
const getApiKey = (): string => {
  if (API_KEYS.length > 0) {
    return API_KEYS[currentKeyIndex];
  }

  // Fallback: Check environment variables
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
      // @ts-ignore
      if (import.meta.env.API_KEY) return import.meta.env.API_KEY;
    }
  } catch (e) {}

  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {}
  
  return ""; 
};

// Rotate to the next key
const rotateKey = () => {
  const oldIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(`API Key rotated: ${oldIndex} -> ${currentKeyIndex}`);
};

// Export a checker so UI knows we are ready
export const hasValidApiKey = (): boolean => {
  return API_KEYS.length > 0 || !!getApiKey();
};

// --- Key Rotation Wrapper ---
// Automatically switches keys if a 429/Quota error occurs
const withKeyRotation = async <T>(
  operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> => {
  let attempts = 0;
  // Try loop strictly limited by number of keys to prevent infinite loops
  const maxAttempts = API_KEYS.length; 

  while (attempts < maxAttempts) {
    const key = getApiKey();
    if (!key) throw new Error("API Key is missing.");

    const ai = new GoogleGenAI({ apiKey: key });

    try {
      return await operation(ai);
    } catch (error: any) {
      const status = error?.status || error?.code;
      const msg = error?.message || "";
      
      // Identify Rate Limit or Quota errors
      const isQuotaError = status === 429 || 
                           msg.includes("429") || 
                           msg.includes("Quota exceeded") || 
                           msg.includes("RESOURCE_EXHAUSTED");

      if (isQuotaError) {
        console.warn(`Key index ${currentKeyIndex} exhausted. Rotating...`);
        rotateKey();
        attempts++;
        // Continue loop to try next key immediately
      } else {
        // If it's another error (e.g., network error, invalid prompt), throw it immediately
        throw error;
      }
    }
  }
  
  throw new Error("所有 API Key 的配额都已耗尽，请稍后再试。");
};

// Generate random topic suggestions
export const generateTopicSuggestions = async (count: number, avoidTopics: string[]): Promise<string[]> => {
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
    return await withKeyRotation(async (ai) => {
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
    });
  } catch (e) {
    console.warn("Failed to fetch topics", e);
    return [];
  }
};

// Generate the script content
export const generateLessonScript = async (topic: string): Promise<LessonData> => {
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

  return await withKeyRotation(async (ai) => {
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
      return {
        ...parsed,
        id: crypto.randomUUID(),
        createdAt: Date.now()
      } as LessonData;
    } catch (e) {
      console.error("Failed to parse JSON", e);
      throw new Error("Failed to parse lesson data");
    }
  });
};