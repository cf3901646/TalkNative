import os
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# 收集所有可用的 API Key
# 支持三种配置方式：
#   1. GEMINI_API_KEY="key1,key2,key3" （逗号分隔）
#   2. GEMINI_API_KEY_1="key1"  GEMINI_API_KEY_2="key2" ...（编号后缀）
#   3. GEMINI_API_KEY="single_key" （单个 key，向后兼容）
def _load_api_keys() -> list[str]:
    keys: list[str] = []
    
    # 方式 1 & 3：从 GEMINI_API_KEY 读取（可能逗号分隔）
    main_key = os.environ.get("GEMINI_API_KEY", "")
    if main_key:
        keys.extend([k.strip() for k in main_key.split(",") if k.strip()])
    
    # 方式 2：从 GEMINI_API_KEY_1, GEMINI_API_KEY_2 ... 读取
    for i in range(1, 21):  # 最多支持 20 个
        k = os.environ.get(f"GEMINI_API_KEY_{i}", "")
        if k and k.strip() not in keys:
            keys.append(k.strip())
    
    return keys

API_KEYS = _load_api_keys()
# 用于轮换的索引（每次 429 后切换到下一个 key）
_current_key_index = 0

MODEL_NAME = "gemini-2.5-flash"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent"

app = FastAPI(title="LingoFlow Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TOPICS_SYSTEM_PROMPT = """Generate creative, specific, and diverse conversation scenarios for English listening practice.
CRITICAL REQUIREMENTS:
1. Language: The topic descriptions MUST be in Simplified Chinese (Mandarin).
2. Content: Scenes should be realistic (work, travel, social, emergency, academic, daily life).
3. Specificity: Topics should be specific (e.g., use "解释简历上的空窗期" instead of just "面试").
4. Return ONLY a JSON array of strings."""

SCRIPT_SYSTEM_PROMPT = """Create a highly natural, native-level English conversation script between two friends (Alex and Jordan).
The conversation should be comprehensive and last approximately 5-10 minutes in spoken duration (aim for 50-70 exchanges).

CRITICAL REQUIREMENTS:
1. Use contemporary American English with natural flow, interjections (like "you know", "like"), and contractions.
2. Include at least 12-15 specific idioms, phrasal verbs, or slang terms.
3. The conversation must have depth, nuance, and emotional engagement.
4. Provide a Mandarin Chinese translation for each line.
5. Idiom Analysis: For each idiom, provide a simple English definition AND a concise Chinese translation/explanation.
6. In the "english" field, wrap idioms/slang with <b> tags (e.g. "I need to <b>bite the bullet</b> and do it"). Do NOT use ** or any other markdown formatting. ONLY use <b></b> HTML tags.

Output STRICT JSON matching the required schema (topic string, lines array containing id, speaker, english, chinese, idioms array with phrase, definition, translation, usage)."""


async def call_gemini(system_prompt: str, user_message: str, temperature: float = 0.7):
    """调用 Gemini API，遇到 429 自动切换 Key，遇到 503 自动重试"""
    import asyncio
    global _current_key_index

    if not API_KEYS:
        raise Exception("未配置任何 GEMINI_API_KEY，请在 Vercel 环境变量中添加。")

    payload = {
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {"role": "user", "parts": [{"text": user_message}]}
        ],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json"
        }
    }

    last_error = None
    tried_keys = 0
    total_keys = len(API_KEYS)
    max_503_retries = 3  # 每个 key 遇到 503 最多重试 3 次

    async with httpx.AsyncClient(timeout=120.0) as client:
        while tried_keys < total_keys:
            current_key = API_KEYS[_current_key_index % total_keys]
            key_label = f"Key#{_current_key_index % total_keys + 1}"

            # 503 重试循环
            for attempt in range(max_503_retries + 1):
                resp = await client.post(
                    GEMINI_API_URL,
                    params={"key": current_key},
                    json=payload
                )

                if resp.status_code == 200:
                    data = resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]

                if resp.status_code == 503:
                    if attempt < max_503_retries:
                        wait_time = (attempt + 1) * 3  # 3秒、6秒、9秒递增等待
                        print(f"[LingoFlow] {key_label} 触发 503 服务繁忙，{wait_time}秒后第{attempt+1}次重试...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        # 503 重试用完，切换到下一个 key
                        print(f"[LingoFlow] {key_label} 503 重试{max_503_retries}次仍失败，切换 Key...")
                        break

                if resp.status_code == 429:
                    break  # 跳出 503 重试循环，进入 key 切换逻辑

                # 其他错误直接抛出
                raise Exception(f"Gemini API error ({resp.status_code}): {resp.text}")

            # 429 或 503 耗尽重试 → 切换到下一个 key
            if resp.status_code in (429, 503):
                reason = "限流" if resp.status_code == 429 else "服务繁忙"
                print(f"[LingoFlow] {key_label} {reason}，切换到下一个 Key...")
                _current_key_index = (_current_key_index + 1) % total_keys
                tried_keys += 1
                last_error = f"Gemini API {resp.status_code} ({key_label}): {reason}"
                await asyncio.sleep(1)
                continue

    # 所有 key 都用完了
    raise Exception(f"所有 {total_keys} 个 API Key 均不可用，请稍后重试。最后错误: {last_error}")


@app.post("/api/topics")
async def generate_topics(request: Request):
    try:
        body = await request.json()
        message = body.get("message", "")
        reply = await call_gemini(TOPICS_SYSTEM_PROMPT, message, temperature=0.8)
        return JSONResponse(content={"reply": reply})
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Topics generation error: {str(e)}"}
        )


@app.post("/api/script")
async def generate_script(request: Request):
    try:
        body = await request.json()
        message = body.get("message", "")
        reply = await call_gemini(SCRIPT_SYSTEM_PROMPT, message, temperature=0.7)
        return JSONResponse(content={"reply": reply})
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Script generation error: {str(e)}"}
        )
