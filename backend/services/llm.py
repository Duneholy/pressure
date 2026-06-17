"""
LLM integration via OpenRouter API.
User provides their own API key and model name through the Settings UI.
"""

import json
from urllib import error as urlerror
from urllib import request as urlrequest

from fastapi import HTTPException

OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


def generate_message_with_llm(context_prompt: str, api_key: str, model: str) -> str:
    """Call OpenRouter chat completions and return the assistant message."""
    if not api_key:
        raise HTTPException(status_code=400, detail="API-ключ OpenRouter не настроен. Укажите его в Настройках → LLM.")
    if not model:
        raise HTTPException(status_code=400, detail="Модель не указана. Укажите её в Настройках → LLM.")

    payload = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": 200,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Ты PM ассистент. Верни ТОЛЬКО готовое сообщение сотруднику на русском языке. "
                    "Одно-два предложения. Без кавычек вокруг всего сообщения, без списков, без пояснений."
                ),
            },
            {"role": "user", "content": context_prompt},
        ],
    }
    data = json.dumps(payload).encode("utf-8")
    req = urlrequest.Request(
        OPENROUTER_ENDPOINT,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "THE PRESSURE",
        },
    )
    try:
        with urlrequest.urlopen(req, timeout=40) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urlerror.HTTPError as ex:
        detail = ex.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed ({ex.code}): {detail[:500]}")
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed: {str(ex)}")

    choices = body.get("choices") or []
    if not choices:
        raise HTTPException(status_code=502, detail="OpenRouter returned empty response")
    first_choice = choices[0] or {}
    message_obj = first_choice.get("message")
    message = ""
    if isinstance(message_obj, dict):
        message = (message_obj.get("content") or "").strip()
    elif isinstance(message_obj, str):
        message = message_obj.strip()
    if not message and "text" in first_choice:
        message = (first_choice.get("text") or "").strip()
    if not message:
        raise HTTPException(status_code=502, detail="OpenRouter returned empty message")
    return " ".join(message.split())
