import time
from collections import defaultdict
from fastapi import Request, HTTPException

class MemoryRateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)
        
    def check(self, request: Request, identifier: str = None):
        """Simple token bucket tracking requests per minute per identifier."""
        if self.requests_per_minute <= 0:
            return
            
        client_id = identifier or (request.client.host if request.client else "unknown")
        now = time.time()
        
        # Clean up timestamps older than 60 seconds
        self.requests[client_id] = [t for t in self.requests[client_id] if now - t < 60]
        
        if len(self.requests[client_id]) >= self.requests_per_minute:
            raise HTTPException(status_code=429, detail="Too Many Requests. Rate limit exceeded.")
            
        self.requests[client_id].append(now)

class Guardrails:
    @staticmethod
    def is_safe(prompt: str) -> bool:
        """Basic Prompt Injection Guardrails."""
        # A foundational denylist to prevent basic prompt jailbreaks (can be freely extended)
        danger_words = ["ignore previous", "system prompt", "bypass", "jailbreak", "you are now"]
        lower_prompt = prompt.lower()
        for word in danger_words:
            if word in lower_prompt:
                return False
        return True
