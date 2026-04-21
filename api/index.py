import sys
import os
from dotenv import load_dotenv

# 确保在 Vercel 环境下能正确读取同一目录内的 prompt_fortress
sys.path.append(os.path.dirname(__file__))

from prompt_fortress import ShieldServer, AISkill

load_dotenv()

server = ShieldServer(
    cors_origins=["*"],
    rate_limit="60/minute",
    title="LingoFlow Vercel Gateway"
)

@server.register_skill(route="/api/topics")
def topics_skill():
    return AISkill(
        model="gemini-1.5-flash", 
        system_prompt="""Generate creative, specific, and diverse conversation scenarios for English listening practice.
        CRITICAL REQUIREMENTS:
        1. Language: The topic descriptions MUST be in Simplified Chinese (Mandarin).
        2. Content: Scenes should be realistic (work, travel, social, emergency, academic, daily life).
        3. Specificity: Topics should be specific (e.g., use "解释简历上的空窗期" instead of just "面试").
        4. Return ONLY a JSON array of strings.""",
        temperature=0.8,
        stream=False,
        response_format={"type": "json_object"}
    )

@server.register_skill(route="/api/script")
def script_skill():
    return AISkill(
        model="gemini-1.5-flash",
        system_prompt="""Create a highly natural, native-level English conversation script between two friends (Alex and Jordan).
        The conversation should be comprehensive and last approximately 5-10 minutes in spoken duration (aim for 50-70 exchanges).
        
        CRITICAL REQUIREMENTS:
        1. Use contemporary American English with natural flow, interjections (like "you know", "like"), and contractions.
        2. Include at least 12-15 specific idioms, phrasal verbs, or slang terms.
        3. The conversation must have depth, nuance, and emotional engagement.
        4. Provide a Mandarin Chinese translation for each line.
        5. Idiom Analysis: For each idiom, provide a simple English definition AND a concise Chinese translation/explanation.

        Output STRICT JSON matching the required schema (topic string, lines array containing id, speaker, english, chinese, idioms array with phrase, definition, translation, usage).""",
        temperature=0.7,
        stream=False,
        response_format={"type": "json_object"}
    )

# Vercel serverless function expects a top-level `app` object representing the ASGI app
app = server.app
