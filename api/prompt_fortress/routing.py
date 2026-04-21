from fastapi import HTTPException
from fastapi.responses import StreamingResponse
import litellm

async def route_llm_request(user_message: str, skill):
    """
    Combines system prompts with user input, and securely proxies the request to the target LLM.
    Returns standard SSE StreamingResponse or plain JSON depending on the skill configuration.
    """
    messages = [
        {"role": "system", "content": skill.system_prompt},
        {"role": "user", "content": user_message}
    ]
    
    completion_kwargs = {
        "model": skill.model,
        "messages": messages,
        "temperature": skill.temperature,
    }
    if getattr(skill, "response_format", None):
        completion_kwargs["response_format"] = skill.response_format
    
    try:
        if skill.stream:
            # LiteLLM allows identical syntax for virtually any target LLM provider.
            response = litellm.completion(
                stream=True,
                **completion_kwargs
            )
            
            async def generate():
                for chunk in response:
                    content = chunk.choices[0].delta.content or ""
                    if content:
                        # Yield standard SSE data lines
                        yield f"data: {content}\n\n"
                        
            return StreamingResponse(generate(), media_type="text/event-stream")
        else:
            response = litellm.completion(
                stream=False,
                **completion_kwargs
            )
            return {"reply": response.choices[0].message.content}
            
    except Exception as e:
        import logging
        logging.error(f"LiteLLM routing error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal LLM Gateway proxy error.")
