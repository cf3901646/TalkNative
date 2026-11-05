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

  // 跨平台环境变量与双轨容灾路由：
  // 1. 若配置了 VITE_BACKEND_URL，以该环境变量为绝对第一优先级
  // 2. 若未配置，优先走当前同源 /api/script（适配 Vercel 或已配代理的本地环境）
  // 3. 若同源请求失败且处于生产环境，可尝试 Cloudflare Workers 备选网关
  let backendUrl = "/api/script";
  const workerFallbackUrl = "https://lingering-dust-fec1.cf3901646.workers.dev/";

  try {
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      const envUrl = (import.meta as any).env.VITE_BACKEND_URL;
      if (envUrl) {
        backendUrl = envUrl;
      }
    }
  } catch (err) {}

  const fetchScriptFromEndpoint = async (url: string) => {
    const response = await fetch(url, {
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
    return normalizeLessonData(parsed, topic);
  };

  try {
    return await fetchScriptFromEndpoint(backendUrl);
  } catch (firstErr: any) {
    // 若默认 /api/script 在静态托管或未启动本地后端时 404/500，无缝故障转移至 Cloudflare Workers 备用网关
    if (backendUrl === "/api/script") {
      try {
        console.warn("主接口 /api/script 响应异常，尝试切换至 Cloudflare Workers 备用网关...", firstErr);
        return await fetchScriptFromEndpoint(workerFallbackUrl);
      } catch (backupErr: any) {
        console.error("Cloudflare Worker 备用网关亦失败:", backupErr);
      }
    }
    console.error("Script fetch error:", firstErr);
    throw new Error(`Script error: ${firstErr.message}`);
  }
};
