from __future__ import annotations

from typing import Any

import cv2
import pytesseract
from pytesseract import Output


class GeometryAI:
    """IA que mapea coordenadas exactas (x, y, w, h) de cada dato contable."""

    def analyze_invoice_geometry(self, image_path: str) -> list[dict[str, Any]]:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"No se pudo leer la imagen: {image_path}")

        # Obtenemos texto, confianza y coordenadas por caja detectada.
        data = pytesseract.image_to_data(img, output_type=Output.DICT, lang="spa")

        extracted_metadata: list[dict[str, Any]] = []
        n_boxes = len(data.get("level", []))

        for i in range(n_boxes):
            conf_raw = str(data.get("conf", ["-1"])[i]).strip()
            try:
                confidence = float(conf_raw)
            except ValueError:
                confidence = -1.0

            text = str(data.get("text", [""])[i]).strip()

            # Solo procesamos si la confianza de la IA es > 60% y hay texto útil.
            if confidence > 60 and text:
                extracted_metadata.append(
                    {
                        "text": text,
                        "x": int(data["left"][i]),
                        "y": int(data["top"][i]),
                        "w": int(data["width"][i]),
                        "h": int(data["height"][i]),
                    }
                )

        return extracted_metadata
