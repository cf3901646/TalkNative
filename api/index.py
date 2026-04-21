import os
import json
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai

# 配置 Gemini API
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

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

Output STRICT JSON matching the required schema (topic string, lines array containing id, speaker, english, chinese, idioms array with phrase, definition, translation, usage)."""


@app.post("/api/topics")
async def generate_topics(request: Request):
    try:
        body = await request.json()
        message = body.get("message", "")

        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=TOPICS_SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                temperature=0.8,
                response_mime_type="application/json",
            ),
        )

        response = model.generate_content(message)
        return JSONResponse(content={"reply": response.text})

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

        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=SCRIPT_SYSTEM_PROMPT,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                response_mime_type="application/json",
            ),
        )

        response = model.generate_content(message)
        return JSONResponse(content={"reply": response.text})

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Script generation error: {str(e)}"}
        )
