export async function onRequestPost(context) {
  const { request } = context;
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();
    const text = (body.text || "").trim();
    if (!text) {
      return new Response(JSON.stringify({ audio: "", words: [] }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 采用 Google 官方高质量纯正美式口语合成流（彻底杜绝国产安卓手机自带机械杂音）
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en-US&client=tw-ob&q=${encodeURIComponent(text)}`;
    const ttsRes = await fetch(googleTtsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (!ttsRes.ok) {
      throw new Error(`Google TTS status: ${ttsRes.status}`);
    }

    const audioArrayBuffer = await ttsRes.arrayBuffer();
    
    // 转换为 base64
    let binary = '';
    const bytes = new Uint8Array(audioArrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const audioB64 = btoa(binary);

    // 构造词汇时间轴用于荧光笔同步高亮
    const words = text.split(/\s+/);
    const wordsCount = words.length;
    // 粗估单句总时长（秒），MP3 约 32kbps
    const estimatedTotalSec = Math.max(1.5, wordsCount * 0.35);
    const wordTimings = words.map((w, idx) => ({
      word: w,
      start: (idx / wordsCount) * estimatedTotalSec,
      duration: (1 / wordsCount) * estimatedTotalSec
    }));

    return new Response(JSON.stringify({ audio: audioB64, words: wordTimings }), {
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
