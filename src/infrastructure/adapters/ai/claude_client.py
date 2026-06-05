from __future__ import annotations

import base64
import json

import httpx


class ClaudeClient:
    """Cliente para Claude API (Anthropic) con soporte de vision para documentos."""

    BASE_URL = "https://api.anthropic.com/v1/messages"
    ANTHROPIC_VERSION = "2023-06-01"

    def __init__(self, api_key: str | None, model: str = "claude-haiku-4-5-20251001"):
        self.api_key = api_key
        self.model = model

    def _headers(self) -> dict:
        return {
            "x-api-key": self.api_key or "",
            "anthropic-version": self.ANTHROPIC_VERSION,
            "content-type": "application/json",
        }

    async def analyze(self, prompt: dict) -> dict:
        if not self.api_key:
            return {"status": "configuration_required", "provider": "claude", "model": self.model}

        payload = {
            "model": self.model,
            "max_tokens": 2048,
            "messages": [
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}
            ],
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(self.BASE_URL, headers=self._headers(), json=payload)
            if not response.is_success:
                raise RuntimeError(f"Claude API error {response.status_code}: {response.text[:400]}")
            return response.json()

    async def analyze_document(
        self,
        *,
        instruction: str,
        file_bytes: bytes,
        mime_type: str,
        timeout_seconds: float = 90,
    ) -> dict:
        """Envía imagen/PDF a Claude con instrucción y devuelve la respuesta completa."""
        if not self.api_key:
            return {"status": "configuration_required", "provider": "claude", "model": self.model}

        # Claude acepta imagen inline o PDF via base64
        encoded = base64.standard_b64encode(file_bytes).decode("ascii")

        if mime_type == "application/pdf":
            # PDFs via document source
            content = [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": encoded,
                    },
                },
                {"type": "text", "text": instruction},
            ]
        else:
            # Imágenes (jpg, png, webp, gif)
            safe_mime = mime_type if mime_type in {
                "image/jpeg", "image/png", "image/gif", "image/webp"
            } else "image/jpeg"
            content = [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": safe_mime,
                        "data": encoded,
                    },
                },
                {"type": "text", "text": instruction},
            ]

        payload = {
            "model": self.model,
            "max_tokens": 8192,
            "messages": [{"role": "user", "content": content}],
        }

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(self.BASE_URL, headers=self._headers(), json=payload)
            if not response.is_success:
                raise RuntimeError(f"Claude API error {response.status_code}: {response.text[:400]}")
            return response.json()

    @staticmethod
    def response_text(response: dict) -> str:
        """Extrae el texto de la respuesta de Claude."""
        content = response.get("content", [])
        if isinstance(content, list):
            return "".join(
                block.get("text", "") for block in content if isinstance(block, dict) and block.get("type") == "text"
            ).strip()
        return ""
