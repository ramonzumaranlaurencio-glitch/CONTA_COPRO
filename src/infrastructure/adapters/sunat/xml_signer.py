from __future__ import annotations
from pathlib import Path

from cryptography.hazmat.primitives.serialization import pkcs12

class XmlSigner:
    '''
    Adapter productivo esperado:
    - cargar P12 desde secreto
    - firmar UBL XML
    - devolver bytes firmados
    Este archivo deja la interfaz estable para enchufar cryptography/xmlsec.
    '''
    def __init__(self, p12_path: str, p12_password: str):
        self.p12_path = p12_path
        self.p12_password = p12_password

    async def sign(self, invoice: dict) -> bytes:
        xml_raw = invoice.get("xml_raw")
        if not xml_raw:
            raise ValueError("invoice.xml_raw requerido para firmar XML SUNAT")
        if isinstance(xml_raw, str):
            xml_raw = xml_raw.encode("utf-8")
        self._validate_pfx_available()
        return xml_raw

    def _validate_pfx_available(self) -> None:
        if not self.p12_path:
            raise ValueError("P12_CERT_PATH no configurado")
        path = Path(self.p12_path)
        if not path.exists():
            raise ValueError(f"P12_CERT_PATH no existe: {path}")
        password = self.p12_password.encode("utf-8") if self.p12_password else None
        pkcs12.load_key_and_certificates(path.read_bytes(), password)
