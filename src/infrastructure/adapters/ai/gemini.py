from __future__ import annotations

import base64
import json

import httpx


class GeminiQuotaError(RuntimeError):
    """Gemini devolvió 429 — cuota de API excedida."""


class GeminiClient:
    def __init__(self, api_key: str | None, model: str):
        self.api_key = api_key
        self.model = model

    async def analyze(self, prompt: dict) -> dict:
        if not self.api_key:
            return {
                "status": "configuration_required",
                "provider": "gemini",
                "model": self.model,
                "prompt_keys": list(prompt.keys()),
            }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload = {"contents": [{"parts": [{"text": json.dumps(prompt, ensure_ascii=False)}]}]}
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, params={"key": self.api_key}, json=payload)
            if not response.is_success:
                detail = response.text[:400]
                raise RuntimeError(f"Gemini API error {response.status_code}: {detail}")
            return response.json()

    async def analyze_document(
        self,
        *,
        instruction: str,
        file_bytes: bytes,
        mime_type: str,
        timeout_seconds: float = 75,
    ) -> dict:
        if not self.api_key:
            return {
                "status": "configuration_required",
                "provider": "gemini",
                "model": self.model,
                "prompt_keys": ["instruction", "inline_data"],
            }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": instruction},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64.b64encode(file_bytes).decode("ascii"),
                            }
                        },
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.05,
                "maxOutputTokens": 8192,
            },
        }
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(url, params={"key": self.api_key}, json=payload)
            if not response.is_success:
                detail = response.text[:400]
                if response.status_code == 429:
                    raise GeminiQuotaError(f"Gemini cuota excedida (429): {detail}")
                raise RuntimeError(f"Gemini API error {response.status_code}: {detail}")
            return response.json()

    @staticmethod
    def response_text(response: dict) -> str:
        parts = (
            response.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [])
        )
        return "".join(str(part.get("text", "")) for part in parts if isinstance(part, dict)).strip()
