import os
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# 直接使用 Google Gemini REST API，不依赖任何 SDK
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
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
    """直接调用 Google Gemini REST API，零 SDK 依赖"""
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

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            GEMINI_API_URL,
            params={"key": GEMINI_API_KEY},
            json=payload
        )

        if resp.status_code != 200:
            raise Exception(f"Gemini API error ({resp.status_code}): {resp.text}")

        data = resp.json()
        # 从 Gemini REST API 响应中提取文本
        return data["candidates"][0]["content"]["parts"][0]["text"]


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
