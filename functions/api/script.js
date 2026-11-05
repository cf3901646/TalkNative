export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();
    const message = body.message || "";

    // 收集 Pages 环境变量中的 GEMINI_API_KEY
    const keys = [];
    const mainKey = env.GEMINI_API_KEY || "";
    if (mainKey) {
      mainKey.split(",").forEach(k => { if (k.trim()) keys.push(k.trim()); });
    }
    for (let i = 1; i <= 20; i++) {
      const k = env[`GEMINI_API_KEY_${i}`] || "";
      if (k.trim() && !keys.includes(k.trim())) keys.push(k.trim());
    }

    // 若 Pages 环境变量未配置 key，自动无缝反代至 Cloudflare Workers 网关
    if (keys.length === 0) {
      const workerRes = await fetch("https://lingering-dust-fec1.cf3901646.workers.dev/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      const data = await workerRes.text();
      return new Response(data, {
        status: workerRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const systemPrompt = `Create a natural English conversation between two friends (Alex and Jordan).
CRITICAL: Generate a long, deep, and immersive conversation (50-70 exchanges). DO NOT truncate.

REQUIREMENTS:
1. Contemporary American English with natural interjections ("well", "you know").
2. Include 12-18 specific idioms/phrasal verbs. If a line has no idiom, set idioms to [].
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
};`;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    const selectedKey = keys[Math.floor(Math.random() * keys.length)];
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${selectedKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const resData = await geminiRes.json();
    const candidate = resData.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let reply = parts.filter(p => !p.thought).map(p => p.text || "").join("").trim();
    if (!reply && parts.length > 0) reply = parts[parts.length - 1].text || "";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
}
