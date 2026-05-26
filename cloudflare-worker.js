export default {
  async fetch(request, env) {
    // 1. 处理 CORS 跨域请求（允许你的 Vercel 网页直接请求此接口）
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    try {
      const { message } = await request.json();

      // 2. 收集 Cloudflare 环境变量中配置的所有 API Keys
      const keys = [];
      const mainKey = env.GEMINI_API_KEY || "";
      if (mainKey) {
        mainKey.split(",").forEach(k => {
          if (k.trim()) keys.push(k.trim());
        });
      }
      
      // 兼容单独配置的 Key (GEMINI_API_KEY_1 到 GEMINI_API_KEY_20)
      for (let i = 1; i <= 20; i++) {
        const k = env[`GEMINI_API_KEY_${i}`] || "";
        if (k.trim() && !keys.includes(k.trim())) {
          keys.push(k.trim());
        }
      }

      if (keys.length === 0) {
        return new Response(JSON.stringify({ error: "未在 Cloudflare 环境变量中配置任何 GEMINI_API_KEY！" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // 3. 随机选择一个 API Key 进行轮换，规避 429 限流
      const selectedKey = keys[Math.floor(Math.random() * keys.length)];

      const systemPrompt = `Create a natural English conversation between two friends (Alex and Jordan).
CRITICAL: Generate a long, deep conversation (50-70 exchanges).

REQUIREMENTS:
1. Contemporary American English with natural interjections ("well", "you know").
2. Include 12-15 specific idioms/phrasal verbs.
3. Return ONLY a valid JSON object. 
4. DO NOT use any markdown formatting (**bold**, <i>italic</i>) in any text field.
5. Provide Mandarin translation for each line.

JSON SCHEMA:
{
  "topic": "string",
  "lines": [
    {
      "id": "string",
      "speaker": "Alex|Jordan",
      "english": "string (PLAIN TEXT ONLY)",
      "chinese": "string",
      "idioms": [{"phrase": "...", "definition": "...", "translation": "...", "usage": "..."}]
    }
  ]
}`;

      const payload = {
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          { role: "user", parts: [{ text: message }] }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json"
        }
      };

      // 4. 调用 Google Gemini 官方 API（CF Workers 没有 10 秒超时限制，可以直接等待完整返回）
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${selectedKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        return new Response(JSON.stringify({ error: `Gemini API 错误: ${errText}` }), {
          status: response.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const resData = await response.json();
      const reply = resData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // 5. 成功返回剧本 JSON 数据给前端
      return new Response(JSON.stringify({ reply }), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
  },
};
