from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Callable, List
from pydantic import BaseModel
import uvicorn
import re

from .models import AISkill
from .security import MemoryRateLimiter, Guardrails
from .routing import route_llm_request

class ChatRequest(BaseModel):
    message: str

class ShieldServer:
    def __init__(self, cors_origins: List[str] = ["*"], rate_limit: str = "60/minute", title: str = "PromptFortress Gateway"):
        self.app = FastAPI(title=title)
        
        # Parse rate limit definition
        rpm = 60
        match = re.match(r"(\d+)/minute", rate_limit)
        if match:
            rpm = int(match.group(1))
            
        self.rate_limiter = MemoryRateLimiter(requests_per_minute=rpm)
        
        # Enable CORS for frontend applications to connect
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    def register_skill(self, route: str):
        """
        Decorator for API routing. It binds a specific route to an AISkill configuration.
        Provides rate limiting + prompt injection protection implicitly.
        """
        def decorator(func: Callable[[], AISkill]):
            skill_config = func()
            
            @self.app.post(route)
            async def handler(request: Request, body: ChatRequest):
                # 1. Rate Limiting Check
                self.rate_limiter.check(request)
                
                # 2. Guardrails Check
                if not Guardrails.is_safe(body.message):
                    raise HTTPException(status_code=400, detail="Security alert: Input blocked by Guardrails.")
                
                # 3. Proxy to LLM securely
                return await route_llm_request(body.message, skill_config)
                
            return func
        return decorator

    def run(self, host: str = "0.0.0.0", port: int = 8000):
        """Launch the ASGI server programmatically."""
        uvicorn.run(self.app, host=host, port=port)
