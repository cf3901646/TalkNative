import { generateSecMsGec } from "./sec-ms-gec.js";

const READALOUD_BASE = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0];
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`;

/**
 * 纯血 Cloudflare 边缘运行的 Microsoft Edge 神经语音合成客户端
 * 支持真实毫秒级 WordBoundary 单词时间戳抓取与 Alex/Jordan 顶尖男女声线
 */
export async function synthesizeEdgeTTS(text, voice = "en-US-GuyNeural", rate = 1.0) {
  const secMsGec = generateSecMsGec(TRUSTED_CLIENT_TOKEN);
  const connectionId = crypto.randomUUID().replace(/-/g, "");
  const muid = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  const url = `https://${READALOUD_BASE}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`;

  const ratePercent = Math.round((rate - 1.0) * 100);
  const rateStr = (ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`);

  const resp = await fetch(url, {
    headers: {
      "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9",
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
      "Sec-WebSocket-Version": "13",
      Upgrade: "websocket",
      Cookie: `muid=${muid};`,
    },
  });

  if (resp.status !== 101 || !resp.webSocket) {
    throw new Error(`Edge TTS WebSocket upgrade 失败: HTTP ${resp.status}`);
  }

  const socket = resp.webSocket;
  socket.accept();

  return new Promise((resolve, reject) => {
    const audioChunks = [];
    const wordTimings = [];
    const requestId = crypto.randomUUID().replace(/-/g, "");
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, -1);
    let resolved = false;

    // 超时看门狗：防止极端情况下 WebSocket 挂起
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { socket.close(); } catch (_) {}
        reject(new Error("Edge TTS 请求超时 (8000ms)"));
      }
    }, 8000);

    // 1. 发送配置握手帧
    socket.send(
      `X-Timestamp:${timestamp}\r\n` +
      "Content-Type:application/json; charset=utf-8\r\n" +
      "Path:speech.config\r\n\r\n" +
      '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n'
    );

    // 2. 发送 SSML 发音指令帧
    const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='${rateStr}' volume='+0%'>${safeText}</prosody></voice></speak>`;
    socket.send(
      `X-RequestId:${requestId}\r\n` +
      "Content-Type:application/ssml+xml\r\n" +
      `X-Timestamp:${timestamp}Z\r\n` +
      "Path:ssml\r\n\r\n" +
      ssml
    );

    // 3. 监听二进制音频与 WordBoundary 元数据帧
    socket.addEventListener("message", async (event) => {
      const data = event.data;

      if (typeof data === "string") {
        if (data.includes("Path:audio.metadata")) {
          const bodyIdx = data.indexOf("\r\n\r\n");
          if (bodyIdx !== -1) {
            try {
              const meta = JSON.parse(data.slice(bodyIdx + 4));
              for (const m of (meta.Metadata || [])) {
                if (m.Type === "WordBoundary" && m.Data && m.Data.text) {
                  wordTimings.push({
                    word: m.Data.text.Text,
                    start: m.Data.Offset / 10000000,
                    duration: m.Data.Duration / 10000000,
                  });
                }
              }
            } catch (_) {}
          }
        } else if (data.includes("Path:turn.end")) {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          try { socket.close(); } catch (_) {}

          // 拼接二进制音频并转 Base64
          const totalLen = audioChunks.reduce((acc, c) => acc + c.byteLength, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of audioChunks) {
            merged.set(c, offset);
            offset += c.byteLength;
          }

          let binary = "";
          const len = merged.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(merged[i]);
          }
          const audioB64 = btoa(binary);

          resolve({
            audio: audioB64,
            words: wordTimings,
            engine: `Microsoft Edge Neural (${voice.includes("Guy") ? "Alex - Guy" : "Jordan - Jenny"})`
          });
        }
      } else {
        // 二进制音频数据帧解析
        let rawBuffer = data;
        if (data instanceof Blob) {
          rawBuffer = await data.arrayBuffer();
        }
        const buf = new Uint8Array(rawBuffer);
        if (buf.length >= 2) {
          const headerLen = (buf[0] << 8) | buf[1];
          if (buf.length >= headerLen + 2) {
            audioChunks.push(buf.slice(headerLen + 2));
          }
        }
      }
    });

    socket.addEventListener("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    socket.addEventListener("close", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        if (audioChunks.length > 0) {
          // 已经收到音频
          const totalLen = audioChunks.reduce((acc, c) => acc + c.byteLength, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of audioChunks) {
            merged.set(c, offset);
            offset += c.byteLength;
          }
          let binary = "";
          const len = merged.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(merged[i]);
          }
          resolve({
            audio: btoa(binary),
            words: wordTimings,
            engine: `Microsoft Edge Neural (${voice.includes("Guy") ? "Alex - Guy" : "Jordan - Jenny"})`
          });
        } else {
          reject(new Error("Edge TTS 连接提前关闭且未收到音频数据"));
        }
      }
    });
  });
}