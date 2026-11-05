import { synthesizeEdgeTTS } from "./edge-tts.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();
    const text = (body.text || "").trim();
    const speaker = body.speaker || "Alex";
    const rate = Math.max(0.6, Math.min(1.8, Number(body.rate) || 1.0));

    if (!text) {
      return new Response(JSON.stringify({ audio: "", words: [] }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 默认发音人映射：
    // Alex -> en-US-GuyNeural (沉稳自然的纯正美音男声)
    // Jordan -> en-US-JennyNeural (清晰灵动的纯正美音女声)
    const voice = speaker === "Alex" ? "en-US-GuyNeural" : "en-US-JennyNeural";

    // 【优先级 1】：纯血 Edge-TTS 边缘 WebSocket 直连（真男女声线 + 真实 WordBoundary 毫秒级字字对齐）
    try {
      const edgeResult = await synthesizeEdgeTTS(text, voice, rate);
      if (edgeResult && edgeResult.audio) {
        return new Response(JSON.stringify(edgeResult), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    } catch (edgeErr) {
      console.warn("[TTS] Edge-TTS 边缘连接异常，自动降级至 Google Cloud / 神经合成流:", edgeErr.message);
    }

    // 【优先级 2】：Google Cloud Text-to-Speech API (Journey 声线)
    const keys = [];
    const mainKey = env.GOOGLE_TTS_API_KEY || env.GEMINI_API_KEY || "";
    if (mainKey) {
      mainKey.split(",").forEach(k => { if (k.trim()) keys.push(k.trim()); });
    }
    for (let i = 1; i <= 20; i++) {
      const k = env[`GEMINI_API_KEY_${i}`] || env[`GOOGLE_TTS_API_KEY_${i}`] || "";
      if (k.trim() && !keys.includes(k.trim())) keys.push(k.trim());
    }

    let audioBase64 = null;
    let usedJourney = false;

    if (keys.length > 0) {
      const journeyVoice = speaker === "Alex" ? "en-US-Journey-D" : "en-US-Journey-F";
      for (const apiKey of keys) {
        try {
          const cloudTtsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
          const cloudRes = await fetch(cloudTtsUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: { text },
              voice: {
                languageCode: "en-US",
                name: journeyVoice,
              },
              audioConfig: {
                audioEncoding: "MP3",
                speakingRate: rate
              }
            })
          });

          if (cloudRes.ok) {
            const data = await cloudRes.json();
            if (data.audioContent) {
              audioBase64 = data.audioContent;
              usedJourney = true;
              break;
            }
          }
        } catch (_) {}
      }
    }

    // 【优先级 3】：高可用兜底分段拼接 Google 纯正美音流
    if (!audioBase64) {
      const chunks = splitIntoChunks(text, 120);
      const audioBuffers = [];

      for (const chunk of chunks) {
        const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-US&client=tw-ob&q=${encodeURIComponent(chunk)}`;
        const res = await fetch(googleUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          audioBuffers.push(new Uint8Array(buf));
        }
      }

      if (audioBuffers.length > 0) {
        const totalLen = audioBuffers.reduce((sum, b) => sum + b.byteLength, 0);
        const mergedBytes = new Uint8Array(totalLen);
        let offset = 0;
        for (const b of audioBuffers) {
          mergedBytes.set(b, offset);
          offset += b.byteLength;
        }

        let binary = '';
        const len = mergedBytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(mergedBytes[i]);
        }
        audioBase64 = btoa(binary);
      }
    }

    if (!audioBase64) {
      throw new Error("全部服务端 TTS 路线均不可用，转交前端 WebSpeech 引擎");
    }

    // 根据文本长度生成时间戳
    const words = text.split(/\s+/);
    const wordsCount = words.length;
    const estimatedTotalSec = Math.max(1.5, (wordsCount * 0.36) / rate);
    const wordTimings = words.map((w, idx) => ({
      word: w,
      start: (idx / wordsCount) * estimatedTotalSec,
      duration: (1 / wordsCount) * estimatedTotalSec
    }));

    return new Response(JSON.stringify({ 
      audio: audioBase64, 
      words: wordTimings,
      engine: usedJourney ? "Google Cloud Journey" : "Google Neural Standard (Fallback)"
    }), {
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

function splitIntoChunks(text, maxLength) {
  if (text.length <= maxLength) return [text];
  const parts = [];
  const sentences = text.match(/[^,.;?!]+[,.;?!]?/g) || [text];
  let cur = "";

  for (const s of sentences) {
    if ((cur + s).length <= maxLength) {
      cur += s;
    } else {
      if (cur.trim()) parts.push(cur.trim());
      if (s.length > maxLength) {
        const words = s.split(/\s+/);
        let sub = "";
        for (const w of words) {
          if ((sub + " " + w).length <= maxLength) {
            sub = sub ? sub + " " + w : w;
          } else {
            if (sub.trim()) parts.push(sub.trim());
            sub = w;
          }
        }
        if (sub.trim()) parts.push(sub.trim());
        cur = "";
      } else {
        cur = s;
      }
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.length > 0 ? parts : [text];
}