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

      // 3. 带有“自动故障避让与静默重试”的 API Key 轮换调用算法
      // 如果某一个 Key 遇到 503（谷歌服务器繁忙）、429（限流）或 403（密钥禁用），
      // Worker 将会自动在后台静默更换下一个 Key 重试，直到成功或尝试完前 3 个 Key，保证前端用户绝对零感知！
      let lastError = "";
      let remainingKeys = [...keys];
      let response = null;
      let success = false;

      // 最多尝试 3 次（或候选池 Key 的总数次）
      const maxAttempts = Math.min(remainingKeys.length, 3);

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const randomIndex = Math.floor(Math.random() * remainingKeys.length);
        const selectedKey = remainingKeys[randomIndex];
        // 从候选池中移出，避免下次重试选到同一个
        remainingKeys.splice(randomIndex, 1);

        try {
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${selectedKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );

          if (response.ok) {
            success = true;
            break;
          } else {
            const errText = await response.text();
            lastError = `Key [${selectedKey.substring(0, 8)}...] 报错 (${response.status}): ${errText}`;
            console.warn(`第 ${attempt + 1} 次尝试失败，正在自动更换 Key 重试。错误详情: ${lastError}`);
          }
        } catch (fetchErr) {
          lastError = `Key [${selectedKey.substring(0, 8)}...] 网络异常: ${fetchErr.message}`;
          console.warn(`第 ${attempt + 1} 次网络请求异常，正在自动更换 Key 重试。`);
        }
      }

      if (!success || !response) {
        return new Response(JSON.stringify({ error: `所有 API Key 均尝试失败。最后一次报错详情: ${lastError}` }), {
          status: 502,
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
