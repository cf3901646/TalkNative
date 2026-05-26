import { LessonData } from "../types";

const cleanAndParseJSON = (text: string) => {
  try {
    // 首先尝试直接解析，如果大模型很乖，直接返回了纯 JSON
    return JSON.parse(text);
  } catch (e) {
    // 如果直接解析失败，尝试寻找 JSON 结构的边界
    try {
      const startIdx = text.search(/[{\[]/);
      const endIdxMatch = text.match(/[}\]][^}\]]*$/);

      if (startIdx !== -1 && endIdxMatch) {
        const clean = text.substring(startIdx, endIdxMatch.index! + 1);
        return JSON.parse(clean);
      }
    } catch (innerErr: any) {
      console.error("Inner parsing failed:", innerErr);
    }
    
    throw new Error(`JSON 解析失败。原始内容片段: ${text.substring(0, 100)}...`);
  }
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

  // 优先使用环境变量 VITE_BACKEND_URL；若未配置，则默认直接回落至您专属的 Cloudflare Worker 高性能网关。
  // 这实现了最极致的“开箱即用”体验，即使不在 Vercel 网页上配置任何环境变量，也能够一键完美运行！
  const backendUrl = (
    (import.meta as any).env?.VITE_BACKEND_URL || 
    "https://lingering-dust-fec1.cf3901646.workers.dev"
  ).replace(/\/$/, "");

  try {
    const response = await fetch(backendUrl, {
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
