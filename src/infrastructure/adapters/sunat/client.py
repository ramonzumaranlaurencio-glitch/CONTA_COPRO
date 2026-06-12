from __future__ import annotations
import httpx

class SunatClient:
    def __init__(self, endpoint: str, nit: str, sol_user: str, sol_password: str, timeout: int = 30):
        self.endpoint = endpoint
        self.nit = nit
        self.sol_user = sol_user
        self.sol_password = sol_password
        self.timeout = timeout

    async def send_bill(self, signed_xml: bytes) -> dict:
        if not self.endpoint:
            return {"success": False, "error": "SUNAT_ENDPOINT no configurado"}
        envelope = self._soap_envelope(signed_xml)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(self.endpoint, content=envelope, headers={"Content-Type": "text/xml; charset=utf-8"})
            if response.status_code >= 500:
                return {"success": False, "error": f"SUNAT unavailable {response.status_code}"}
            if response.status_code >= 400:
                return {"success": False, "error": response.text[:500]}
            return {"success": True, "cdr": response.text}

    def _soap_envelope(self, signed_xml: bytes) -> bytes:
        import base64

        filename = f"{self.nit or '00000000000'}-01.xml"
        content = base64.b64encode(signed_xml).decode("ascii")
        username = f"{self.nit}{self.sol_user}" if self.nit and self.sol_user else (self.sol_user or "")
        password = self.sol_password or ""
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe">
  <soapenv:Header>
    <wsse:Security xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/12/secext">
      <wsse:UsernameToken>
        <wsse:Username>{username}</wsse:Username>
        <wsse:Password>{password}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendBill>
      <fileName>{filename}</fileName>
      <contentFile>{content}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>""".encode("utf-8")
