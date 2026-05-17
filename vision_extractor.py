from __future__ import annotations

import re
from pathlib import Path

import pytesseract
from PIL import Image, ImageOps, ImageEnhance


class InvoiceVisionAI:
    """IA OCR para extraer metadatos de facturas a partir de imagenes."""

    def extract_data(self, image_path: str):
        img_path = Path(image_path)
        if not img_path.exists():
            raise FileNotFoundError(f"No existe archivo de imagen: {image_path}")

        img = Image.open(img_path).convert("L")
        img = ImageOps.autocontrast(img)
        img = ImageEnhance.Contrast(img).enhance(1.4)

        raw_text = pytesseract.image_to_string(img, lang="spa")

        serie = self._find_pattern(raw_text, r"([F|E]\d{3})[-\s]?(\d+)")
        serie_numero = f"{serie[0]}-{serie[1]}" if isinstance(serie, tuple) else None

        data = {
            "ruc_emisor": self._find_pattern(raw_text, r"RUC[:\s]+(\d{11})"),
            "serie_numero": serie_numero,
            "fecha": self._find_pattern(raw_text, r"(\d{2}/\d{2}/\d{4})"),
            "total": self._find_money(raw_text, ["TOTAL", "NETO", "IMPORTE"]),
            "raw_text": raw_text,
        }
        return data

    @staticmethod
    def _find_pattern(text: str, pattern: str):
        match = re.search(pattern, text)
        if not match:
            return None
        if len(match.groups()) == 1:
            return match.group(1)
        if len(match.groups()) > 1:
            return match.groups()
        return match.group(0)

    @staticmethod
    def _find_money(text: str, keywords: list[str]) -> float:
        lines = text.split("\n")
        for line in lines:
            line_upper = line.upper()
            if any(key in line_upper for key in keywords):
                amounts = re.findall(r"(\d+[\.,]\d{2})", line.replace(" ", ""))
                if amounts:
                    return float(amounts[-1].replace(",", "."))
        return 0.0
