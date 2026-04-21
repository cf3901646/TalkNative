from typing import Optional
from pydantic import BaseModel, Field

class AISkill(BaseModel):
    model: str = Field(..., description="The underlying LLM, e.g., 'gemini-1.5-flash', 'gpt-4o-mini'")
    system_prompt: str = Field(..., description="The system prompt locked securely in the backend.")
    temperature: float = Field(0.7, description="Model temperature.")
    stream: bool = Field(True, description="Whether to stream the response (Server-Sent Events).")
    response_format: Optional[dict] = Field(None, description="Optional structured format, e.g., {'type': 'json_object'}")
