import { LessonData } from "../types";

const cleanAndParseJSON = (text: string) => {
  if (!text || typeof text !== "string") {
    throw new Error("API 返回内容为空");
  }

  // 1. 去除 Markdown 代码块标记（如 ```json ... ```）
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // 2. 尝试直接解析纯 JSON
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 3. 寻找有效 JSON 起止边界（防止模型思维链或开头说明文本污染）
    try {
      const startIdx = cleaned.search(/[{\[]/);
      const endIdxMatch = cleaned.match(/[}\]][^}\]]*$/);

      if (startIdx !== -1 && endIdxMatch) {
        const candidate = cleaned.substring(startIdx, endIdxMatch.index! + 1);
        return JSON.parse(candidate);
      }
    } catch (innerErr: any) {
      console.error("Inner parsing failed:", innerErr);
    }
    
    throw new Error(`JSON 解析失败。原始内容片段: ${cleaned.substring(0, 100)}...`);
  }
};

/**
 * 健壮的剧本数据归一化器：
 * 无论大模型返回标准 lines、别名 dialogue/conversation、包裹对象还是纯数组，
 * 均百分之百清洗为符合严格接口契约的 LessonData，杜绝任何未定义属性引发的白屏渲染崩溃。
 */
export const normalizeLessonData = (raw: any, defaultTopic: string): LessonData => {
  let topic = defaultTopic;
  let rawLines: any[] = [];

  if (Array.isArray(raw)) {
    rawLines = raw;
  } else if (raw && typeof raw === "object") {
    topic = raw.topic || raw.title || defaultTopic;
    if (Array.isArray(raw.lines)) {
      rawLines = raw.lines;
    } else if (Array.isArray(raw.dialogue)) {
      rawLines = raw.dialogue;
    } else if (Array.isArray(raw.conversation)) {
      rawLines = raw.conversation;
    } else if (Array.isArray(raw.script)) {
      rawLines = raw.script;
    } else if (raw.data && Array.isArray(raw.data.lines)) {
      rawLines = raw.data.lines;
    }
  }

  // 极端兜底：如果模型返回文章段落或单条长文本
  if (rawLines.length === 0 && raw && typeof raw === "object") {
    const fallbackText = raw.text || raw.content || raw.article || "";
    if (fallbackText) {
      rawLines = [{
        speaker: "Alex",
        english: fallbackText,
        chinese: raw.translation || raw.chinese || "",
        idioms: []
      }];
    }
  }

  const lines = rawLines.map((item, index) => {
    const speaker = item?.speaker || (index % 2 === 0 ? "Alex" : "Jordan");
    const english = item?.english || item?.text || item?.dialogue || item?.sentence || item?.en || "";
    const chinese = item?.chinese || item?.translation || item?.meaning || item?.zh || item?.cn || "";
    const rawIdioms = Array.isArray(item?.idioms) ? item.idioms : [];
    const idioms = rawIdioms.map((idm: any) => ({
      phrase: idm?.phrase || idm?.word || "",
      definition: idm?.definition || "",
      translation: idm?.translation || "",
      usage: idm?.usage || idm?.example || ""
    })).filter((idm: any) => Boolean(idm.phrase));

    return {
      id: item?.id || `line-${index + 1}-${Math.random().toString(36).slice(2, 9)}`,
      speaker,
      english,
      chinese,
      idioms
    };
  }).filter(l => Boolean(l.english || l.chinese));

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `lesson-${Date.now()}`,
    createdAt: Date.now(),
    topic: topic || "英语精听练习",
    lines
  };
};

export const generateTopicSuggestions = async (count: number, avoidTopics: string[]): Promise<string[]> => {
  const avoidContext = avoidTopics.slice(-30).join("; ");
  const message = `Generate ${count} scenarios.\n${avoidContext ? `AVOID these recently used topics: ${avoidContext}` : ""}`;

  try {
    const response = await fetch("/api/topics", {
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

  // 跨平台环境变量与多重智能故障转移：
  // 1. 若配置了 VITE_BACKEND_URL，以此环境变量为第一优先级
  // 2. 若未配置，默认走方案 A 自定义域名网关 https://talknative.3901646.xyz/
  // 3. 若自定义域名未就绪或报错，自动平滑 fallback 至备用网关或当前同源 /api/script
  let primaryBackendUrl = "https://talknative.3901646.xyz/";
  try {
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      const envUrl = (import.meta as any).env.VITE_BACKEND_URL;
      if (envUrl) {
        primaryBackendUrl = envUrl;
      }
    }
  } catch (err) {}

  const fallbackUrls = [
    primaryBackendUrl,
    "/api/script",
    "https://lingering-dust-fec1.cf3901646.workers.dev/"
  ];

  // 去重候选 URL
  const uniqueUrls = Array.from(new Set(fallbackUrls));

  let lastError: Error | null = null;

  for (const targetUrl of uniqueUrls) {
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Endpoint ${targetUrl} failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      if (!data.reply) throw new Error(`Endpoint ${targetUrl} response missing 'reply'`);

      const parsed = cleanAndParseJSON(data.reply);
      const normalized = normalizeLessonData(parsed, topic);

      if (!normalized.lines || normalized.lines.length === 0) {
        throw new Error("AI 生成的剧本内容为空，请换个话题重试。");
      }

      return normalized;
    } catch (err: any) {
      console.warn(`[TalkNative] 尝试后端 ${targetUrl} 异常，准备尝试下一个备用线路:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`所有网关请求均失败。最后错误: ${lastError?.message || "网络连接异常"}`);
};
